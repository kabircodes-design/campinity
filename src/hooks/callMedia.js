/**
 * Shared media-quality helpers for both 1:1 (useCall.js) and group
 * (useGroupCall.js) calling — one place for "what constraints/bitrate
 * do we ask for," not duplicated logic that could drift between the
 * two. Neither hook's signaling/peer-connection architecture changes;
 * this only tunes what getUserMedia() and RTCRtpSender ask for.
 *
 * Previously both hooks called getUserMedia({ audio: true, video:
 * type === 'video' }) — completely unconstrained. That lets the
 * browser pick ANY default (often 1080p+ on modern laptops/phones),
 * which wastes upload bandwidth and CPU precisely where it hurts most
 * (a mesh group call uploads its full-resolution stream once per OTHER
 * participant). All values below are "ideal"/"max", never "exact"/
 * "min" for resolution — the browser is free to hand back less if the
 * camera or current conditions can't provide it, so this degrades
 * gracefully instead of getUserMedia() failing outright on a modest
 * device.
 */

// Group calls intentionally target a lower per-stream resolution than
// 1:1 — a mesh group call already multiplies upload cost by
// (participants - 1), so keeping each individual stream modest is what
// actually keeps a group call usable, not a cosmetic choice.
const VIDEO_PROFILES = {
  '1to1': { width: { ideal: 960, max: 1280 }, height: { ideal: 540, max: 720 }, frameRate: { ideal: 24, max: 30 } },
  group: { width: { ideal: 640, max: 960 }, height: { ideal: 480, max: 640 }, frameRate: { ideal: 20, max: 24 } }
}

export function getMediaConstraints({ isVideo, isGroup = false }) {
  const profile = isGroup ? VIDEO_PROFILES.group : VIDEO_PROFILES['1to1']
  return {
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: isVideo ? { ...profile, facingMode: 'user' } : false
  }
}

// Sensible, not maximal, per-connection ceilings. Voice: Opus at 32kbps
// is already good voice quality (Opus's own useful range starts well
// below this). Video: scaled down as a group call grows, since total
// outgoing bandwidth for one mesh participant is
// (participantCount - 1) x this value — halving the per-connection
// target as the call doubles in size is what keeps upload bandwidth
// from blowing out on an ordinary home/campus connection.
const AUDIO_MAX_BITRATE = 32_000
const VIDEO_MAX_BITRATE_1TO1 = 900_000
const VIDEO_MAX_BITRATE_GROUP_BASE = 500_000
const VIDEO_MAX_BITRATE_GROUP_FLOOR = 150_000

function videoBitrateFor({ isGroup, otherParticipantCount }) {
  if (!isGroup) return VIDEO_MAX_BITRATE_1TO1
  const divisor = Math.max(1, otherParticipantCount)
  return Math.max(VIDEO_MAX_BITRATE_GROUP_FLOOR, Math.round(VIDEO_MAX_BITRATE_GROUP_BASE / divisor))
}

/**
 * Best-effort — setParameters() on a sender whose connection hasn't
 * finished its first negotiation can be a no-op or reject on some
 * browsers; every call site awaits this but never treats a failure as
 * fatal, since an unset bitrate cap just means "browser's own default
 * congestion control applies," not a broken call.
 */
export async function applyBitrateLimits(pc, { isGroup = false, otherParticipantCount = 1 } = {}) {
  const senders = pc.getSenders()
  for (const sender of senders) {
    if (!sender.track) continue
    try {
      const params = sender.getParameters()
      if (!params.encodings || params.encodings.length === 0) params.encodings = [{}]
      params.encodings[0].maxBitrate =
        sender.track.kind === 'video' ? videoBitrateFor({ isGroup, otherParticipantCount }) : AUDIO_MAX_BITRATE
      await sender.setParameters(params)
    } catch {
      // Non-fatal — see header comment.
    }
  }
}
