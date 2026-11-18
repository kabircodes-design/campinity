import { useEffect, useRef, useState } from 'react'
import { Maximize2, Mic, MicOff, Minimize2, PhoneOff, RefreshCw, Speaker, Video, VideoOff } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { getUserProfile } from '../firebase/profileService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { applySinkId, useAudioOutputDevices } from '../hooks/useAudioOutputDevices.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useSystemBarsOverride } from '../theme/systemBars.js'
import { useBackToClose } from '../navigation/overlayBackStack.js'

function formatDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Full-screen overlay for calling / connecting / active / terminal call
 * states. Deliberately minimal — "modern social calling, not Zoom" per
 * the brief — a single centered card for voice, a full-bleed remote
 * video + picture-in-picture local preview for video.
 *
 * Incoming calls are handled entirely by IncomingCallToast.jsx (a
 * compact, non-blocking card) instead — this component is only ever
 * rendered once callState has moved past 'incoming' (see
 * CallContext.jsx's conditional), so it never needs to render a ringing
 * state itself.
 */
export default function CallOverlay({ call }) {
  const {
    callState,
    activeCall,
    localStream,
    remoteStream,
    muted,
    cameraOff,
    remoteMuted,
    remoteCameraOff,
    callError,
    durationSec,
    endCall,
    toggleMute,
    toggleCamera,
    switchCamera,
    switchingCamera,
    facingMode,
    resetCall
  } = call

  const { profile: myProfile } = useAuth()
  const [otherProfile, setOtherProfile] = useState(null)
  const [minimized, setMinimized] = useState(false)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const remoteAudioRef = useRef(null)

  // Real, feature-detected audio-output switching (never a fake
  // speaker/earpiece toggle — see the hook's own header for why no such
  // control genuinely exists cross-platform). Cycles through whatever
  // navigator.mediaDevices actually reports; the button below only
  // renders when there's genuinely more than one real device to switch
  // between AND the platform supports setSinkId at all.
  const { supported: audioOutputSupported, devices: audioOutputDevices } = useAudioOutputDevices()
  const [audioOutputIndex, setAudioOutputIndex] = useState(0)
  const handleCycleAudioOutput = () => {
    if (audioOutputDevices.length < 2) return
    const nextIndex = (audioOutputIndex + 1) % audioOutputDevices.length
    const device = audioOutputDevices[nextIndex]
    applySinkId([remoteAudioRef.current, remoteVideoRef.current], device.deviceId)
    setAudioOutputIndex(nextIndex)
  }

  const otherUid = activeCall?.otherUid || null
  const type = activeCall?.type || 'voice'

  useEffect(() => {
    if (!otherUid) {
      setOtherProfile(null)
      return
    }
    let cancelled = false
    getUserProfile(otherUid)
      .then((p) => {
        if (!cancelled) setOtherProfile(p)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [otherUid])

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream || null
  }, [localStream])

  useEffect(() => {
    const el = type === 'video' ? remoteVideoRef.current : remoteAudioRef.current
    if (!el) return
    el.srcObject = remoteStream || null
    // Defensive reset, not a fake "earpiece" control (see
    // useAudioOutputDevices.js's own header for why no such control
    // genuinely exists on the web platform) — explicitly re-selects the
    // system default output the moment a new remote stream attaches, so
    // a call never silently inherits some OTHER page's or a PREVIOUS
    // call's manually-picked output device. Best-effort only: throws on
    // unsupported browsers (Safari/iOS), swallowed on purpose.
    if (remoteStream && 'setSinkId' in HTMLMediaElement.prototype) {
      el.setSinkId?.('default').catch(() => {})
    }
  }, [remoteStream, type])

  const isEndedState = ['ended', 'declined', 'missed', 'failed'].includes(callState)

  // A fresh call always starts full-screen — minimized is a per-call UI
  // preference, not something that should carry over from the last one.
  useEffect(() => {
    if (activeCall?.callId) setMinimized(false)
  }, [activeCall?.callId])

  // Auto-dismiss a terminal state after a moment, so "Call ended" /
  // "Call declined" / "No answer" / "Call failed" doesn't sit on screen
  // forever with no button to clear it.
  useEffect(() => {
    if (!isEndedState) return undefined
    const timer = window.setTimeout(() => resetCall(), 2000)
    return () => window.clearTimeout(timer)
  }, [isEndedState, resetCall])

  // Full-screen call UI is always dark; the minimized pill is not full-screen.
  useSystemBarsOverride('dark', callState !== 'idle' && !(minimized && !isEndedState))
  // Android Back on a full-screen call minimises it (the call keeps
  // running in the corner pill) instead of navigating the page beneath.
  useBackToClose(callState !== 'idle' && callState !== 'incoming' && !minimized && !isEndedState, () => setMinimized(true))

  if (callState === 'idle') return null

  const displayName = otherProfile?.displayName || 'Student'
  const isVideo = type === 'video'
  const isOutgoing = callState === 'calling'
  const isConnecting = callState === 'connecting'
  const isActive = callState === 'active'
  const isReconnecting = callState === 'reconnecting'
  // Treated the same as isActive for what's ON SCREEN (video/controls
  // stay visible — a network blip shouldn't suddenly hide the call UI)
  // — only the status label differs, so the user has an honest
  // "something's wrong, hang on" signal instead of a frozen "Connected"
  // that quietly stops updating.
  const isActiveish = isActive || isReconnecting

  let statusLabel = ''
  if (isOutgoing) statusLabel = 'Calling…'
  else if (isConnecting) statusLabel = 'Connecting…'
  else if (isReconnecting) statusLabel = 'Reconnecting…'
  else if (isActive) statusLabel = formatDuration(durationSec)
  else if (callState === 'declined') statusLabel = callError || 'Call declined'
  else if (callState === 'missed') statusLabel = 'No answer'
  else if (callState === 'failed') statusLabel = callError || 'Call failed'
  else if (callState === 'ended') statusLabel = 'Call ended'

  // Minimized: a small corner pill (avatar/name/status + end call), not
  // the full-bleed remote <video> — that element is only ever mounted
  // in the full-screen branch below, so toggling minimized on/off never
  // remounts/re-attaches the video ref (which only updates srcObject
  // when remoteStream itself changes, not on remount) and can't show a
  // stale blank frame either way. Never offered during a terminal state
  // — those already auto-dismiss in ~2s, minimizing one would be
  // pointless UI.
  if (minimized && !isEndedState) {
    return (
      <div className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-[10000] w-56 rounded-2xl bg-gray-900 text-white shadow-2xl px-3 py-2.5 flex items-center gap-2.5 [animation:modalIn_200ms_cubic-bezier(0.16,1,0.3,1)]">
        <Avatar initials={getInitials(displayName)} colorClass={getAvatarColor(otherUid)} size="sm" src={getProfileIdentityImage(otherProfile) || undefined} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate">{displayName}</p>
          <p className="text-[10px] text-white/60">{statusLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => setMinimized(false)}
          aria-label="Expand call"
          className="flex-shrink-0 w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors duration-200"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={endCall}
          aria-label="End call"
          className="flex-shrink-0 w-7 h-7 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center transition-colors duration-200"
        >
          <PhoneOff className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[10000] bg-gradient-to-b from-[#0f1b33] via-[#0b1222] to-[#05070d] flex flex-col items-center justify-center text-white">
      {!isEndedState && (
        <button
          type="button"
          onClick={() => setMinimized(true)}
          aria-label="Minimize call"
          className="absolute top-[calc(1rem+var(--app-safe-top))] left-4 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors duration-200"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      )}
      {/* CRITICAL FIX: this element used to only mount once isActive was
          true, but pc.ontrack (which calls setRemoteStream) can fire —
          and often does — before onconnectionstatechange ever reaches
          'connected'. The srcObject-assigning effect below only re-runs
          when `remoteStream` itself changes, not when this element
          remounts, so a stream that arrived while unmounted was silently
          dropped forever: connectionState said "connected", callState
          said 'active', and the video element existed with no
          srcObject ever set. Now always mounted for the life of a video
          call so the ref is guaranteed available whenever the track
          arrives; visually held behind the avatar card (z-10, opaque
          bg-gray-900 fills the screen) until isActive so "Connected" is
          never implied early — same requirement as Part 3. */}
      {isVideo && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          // ROOT-CAUSE FIX: previously only gated on `isActive` — if the
          // REMOTE party turned their camera off mid-call, this element
          // kept rendering their now-frozen/black last frame with
          // nothing telling the viewer why. remoteCameraOff (see
          // callService.js's setCallMediaState / the remote-state sync
          // in useCall.js) now hides the video the same way and falls
          // back to their avatar below instead of a blank frame.
          className={`absolute inset-0 w-full h-full object-cover bg-gray-900 ${isActiveish && !remoteCameraOff ? '' : 'opacity-0'}`}
        />
      )}
      {/* Always mounted for the whole voice-call lifetime (not gated on
          isActive) — same reasoning as above, and there's no premature
          "Connected" concern here since <audio> has no visible frame to
          leak early. */}
      {!isVideo && <audio ref={remoteAudioRef} autoPlay />}

      <div
        className={`relative z-10 flex flex-col items-center px-6 text-center ${
          isVideo && isActiveish && !remoteCameraOff ? 'self-stretch mt-[calc(4.5rem+var(--app-safe-top))] mb-auto' : ''
        }`}
      >
        {(!isVideo || !isActiveish || remoteCameraOff) && (
          <div className="relative">
            {(isOutgoing || isConnecting) && (
              <>
                <span className="absolute inset-0 rounded-full bg-blue-400/25 animate-ping motion-reduce:animate-none" aria-hidden="true" />
                <span className="absolute -inset-3 rounded-full border border-white/10" aria-hidden="true" />
              </>
            )}
            <span className="relative block rounded-full ring-4 ring-white/10">
              <Avatar
                initials={getInitials(displayName)}
                colorClass={getAvatarColor(otherUid)}
                size="xl"
                src={getProfileIdentityImage(otherProfile) || undefined}
              />
            </span>
          </div>
        )}
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">{isVideo ? 'Video call' : 'Voice call'}</p>
        <p className="mt-1 text-2xl font-bold drop-shadow">{displayName}</p>
        <p
          role="status"
          aria-live="polite"
          className={`mt-2 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium backdrop-blur-sm ${
            isReconnecting
              ? 'bg-amber-400/15 text-amber-200'
              : isEndedState
                ? 'bg-rose-500/15 text-rose-200'
                : isActive
                  ? 'bg-emerald-400/15 text-emerald-200'
                  : 'bg-white/10 text-white/80'
          }`}
        >
          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />}
          {isReconnecting && <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" aria-hidden="true" />}
          {isActive && remoteMuted && <MicOff className="w-3.5 h-3.5" aria-label="They are muted" />}
          {statusLabel}
        </p>
      </div>

      {isVideo && (
        <div className="absolute right-4 bottom-[calc(9.5rem+var(--app-safe-bottom,env(safe-area-inset-bottom)))] w-28 h-40 rounded-2xl overflow-hidden bg-gray-800 border border-white/20 shadow-lg">
          {/* Same fix as the remote element: this video used to unmount
              entirely on cameraOff (or before isActive), which threw
              away the DOM node the srcObject effect (keyed only on
              [localStream]) had already attached to — toggling the
              camera back on, or reaching 'active' after localStream was
              already set during 'calling'/'connecting', left this
              preview blank since the effect never re-ran on remount.
              Kept permanently mounted for the call's lifetime; camera-off
              is now a CSS overlay, not an unmount. */}
          {/* ROOT CAUSE of "camera feed appears inverted": neither video
              element ever applied a mirror transform at all. The REMOTE
              video (above) was already correct by omission — the other
              person's video should never be mirrored. This local
              self-preview is the one that needed it: browsers hand back
              the front camera feed exactly as the sensor sees it
              (unmirrored), which reads as "backwards" for a selfie-style
              preview — every real camera/video-call app mirrors ONLY the
              front-facing camera's own local preview, never the rear
              camera (flipping a rear/environment shot would make any
              text or signage in the scene read backwards, genuinely
              disorienting) and never the remote party's video. Same
              `-scale-x-100` convention CampusAvatarFlow.jsx's own camera
              preview already uses, applied conditionally on facingMode
              so switching to the rear camera correctly drops the mirror. */}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''} ${cameraOff ? 'hidden' : ''}`}
          />
          {cameraOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <Avatar
                initials={getInitials(myProfile?.displayName || 'You')}
                colorClass={getAvatarColor(myProfile?.uid || 'me')}
                size="md"
                src={getProfileIdentityImage(myProfile) || undefined}
              />
            </div>
          )}
        </div>
      )}

      <div className="absolute left-0 right-0 flex items-end justify-center gap-5 px-4" style={{ bottom: 'calc(2.5rem + var(--app-safe-bottom, env(safe-area-inset-bottom)))' }}>
        {isEndedState ? null : (
          <>
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
                className={`w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-all duration-200 ${
                  muted ? 'bg-[#ffffff] text-[#0f172a]' : 'bg-white/15 hover:bg-white/25 text-white'
                }`}
              >
                {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <span className="mt-1.5 block text-[11px] text-white/70">{muted ? 'Unmute' : 'Mute'}</span>
            </div>
            {isVideo && (
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={toggleCamera}
                  aria-label={cameraOff ? 'Turn camera on' : 'Turn camera off'}
                  className={`w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-all duration-200 ${
                    cameraOff ? 'bg-[#ffffff] text-[#0f172a]' : 'bg-white/15 hover:bg-white/25 text-white'
                  }`}
                >
                  {cameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </button>
                <span className="mt-1.5 block text-[11px] text-white/70">{cameraOff ? 'Camera on' : 'Camera'}</span>
              </div>
            )}
            {isVideo && isActiveish && !cameraOff && (
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={switchCamera}
                  disabled={switchingCamera}
                  aria-label="Switch camera"
                  className="w-12 h-12 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 text-white active:scale-95 disabled:opacity-50 transition-all duration-200"
                >
                  <RefreshCw className={`w-5 h-5 ${switchingCamera ? 'animate-spin' : ''}`} />
                </button>
                <span className="mt-1.5 block text-[11px] text-white/70">Flip</span>
              </div>
            )}
            {/* Only rendered when the platform genuinely exposes more
                than one real audio output — never a fake toggle. Tap
                cycles to the next real device (e.g. phone speaker vs a
                connected Bluetooth headset); its label is exactly what
                the OS reports, nothing invented. */}
            {audioOutputSupported && audioOutputDevices.length > 1 && (
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={handleCycleAudioOutput}
                  aria-label={`Audio output: ${audioOutputDevices[audioOutputIndex]?.label || 'switch'}`}
                  title={audioOutputDevices[audioOutputIndex]?.label || 'Switch audio output'}
                  className="w-12 h-12 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 text-white active:scale-95 transition-all duration-200"
                >
                  <Speaker className="w-5 h-5" />
                </button>
                <span className="mt-1.5 block text-[11px] text-white/70">Audio</span>
              </div>
            )}
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={endCall}
                aria-label="End call"
                className="w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center active:scale-95 transition-all duration-200"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
              <span className="mt-1.5 block text-[11px] text-white/70">End</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
