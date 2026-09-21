import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, PhoneOff, RefreshCw, Speaker, Users, Video, VideoOff } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { getUserProfile } from '../firebase/profileService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { useAuth } from '../context/AuthContext.jsx'
import { applySinkId, useAudioOutputDevices } from '../hooks/useAudioOutputDevices.js'

/**
 * ROOT-CAUSE FIX — group VOICE calls had no remote audio at all, and a
 * group VIDEO call lost a participant's audio the moment their camera
 * went off. Cause: this tile only ever attached `stream` to a <video>
 * element, and only rendered that <video> when `isVideo && !cameraOff`
 * — for a voice call (isVideo=false) or a camera-off video participant,
 * the branch fell through to a plain <Avatar> with nothing attaching
 * the stream to any playable element. Fixed by separating concerns:
 * a hidden <audio> element ALWAYS carries the remote stream (voice or
 * video, camera on or off) — never rendered for the local tile, to
 * avoid hearing yourself — while the VISIBLE video/avatar swap keeps
 * its exact previous behavior.
 */
function ParticipantTile({ uid, stream, participant, profile, isVideo, isLocal, facingMode, onRemoteAudioElement }) {
  const videoRef = useRef(null)
  const audioRef = useRef(null)
  const cameraOff = participant?.cameraOff
  const muted = participant?.muted

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream || null
  }, [stream])

  useEffect(() => {
    if (isLocal || !audioRef.current) return
    audioRef.current.srcObject = stream || null
  }, [stream, isLocal])

  // Hands the real <audio> DOM node up to the parent once, on mount —
  // that's what the output-device switcher (handleCycleAudioOutput)
  // calls setSinkId() on later.
  useEffect(() => {
    if (isLocal || !onRemoteAudioElement) return undefined
    onRemoteAudioElement(uid, audioRef.current)
    return () => onRemoteAudioElement(uid, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocal])

  const displayName = profile?.displayName || (isLocal ? 'You' : 'Student')
  const mirrored = isLocal && facingMode === 'user'
  const showVideo = isVideo && !cameraOff

  return (
    <div className="relative rounded-2xl overflow-hidden bg-gray-800 aspect-square sm:aspect-video flex items-center justify-center">
      {!isLocal && <audio ref={audioRef} autoPlay />}
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-cover ${mirrored ? '-scale-x-100' : ''}`}
        />
      ) : (
        <Avatar
          initials={getInitials(displayName)}
          colorClass={getAvatarColor(uid)}
          size="lg"
          src={getProfileIdentityImage(profile) || undefined}
        />
      )}
      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1">
        <span className="rounded-full bg-black/50 backdrop-blur px-2 py-0.5 text-[11px] font-medium text-white truncate">
          {isLocal ? 'You' : displayName}
        </span>
        {muted && (
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
            <MicOff className="w-3 h-3 text-white" />
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Real per-count grid, not one fixed column count for every call size —
 * 2 tiles side by side, 3 in a balanced 2-up row (third spans below on
 * narrow screens, 3-across on wider ones), 4 as a clean 2x2, 5+ as an
 * adaptive 3-wide grid that scrolls rather than shrinking tiles into
 * unusable slivers. Voice-call tiles (avatar-only, no video framing
 * need) can comfortably fit one extra column at each size.
 */
function gridColsClass(tileCount, isVideo) {
  if (tileCount <= 2) return isVideo ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
  if (tileCount === 3) return isVideo ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-3'
  if (tileCount === 4) return 'grid-cols-2'
  return isVideo ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-3 sm:grid-cols-4'
}

/**
 * Active group call — participant grid. Real media, real N peer
 * connections (useGroupCall.js) driving every tile; nothing here is
 * mock/placeholder data. Voice calls render as a compact avatar row
 * instead of a video grid, matching CallOverlay.jsx's own voice/video
 * layout split for 1:1 calls.
 */
export default function GroupCallOverlay({ call }) {
  const {
    groupCallState,
    activeGroupCall,
    localStream,
    participants,
    remoteStreams,
    muted,
    cameraOff,
    callError,
    facingMode,
    switchingCamera,
    leaveGroupCall,
    toggleMute,
    toggleCamera,
    switchCamera,
    resetCall
  } = call

  const { profile: myProfile } = useAuth()
  const [profiles, setProfiles] = useState({})
  const remoteAudioRefs = useRef(new Map())

  // Real, feature-detected audio-output switching — same honest
  // approach as CallOverlay.jsx (no fake earpiece control; only ever
  // rendered when the platform genuinely reports more than one real
  // output device). Previously missing from this component entirely —
  // a group call had zero way to move audio off whatever device the
  // browser defaulted to.
  const { supported: audioOutputSupported, devices: audioOutputDevices } = useAudioOutputDevices()
  const [audioOutputIndex, setAudioOutputIndex] = useState(0)
  const handleCycleAudioOutput = () => {
    if (audioOutputDevices.length < 2) return
    const nextIndex = (audioOutputIndex + 1) % audioOutputDevices.length
    const device = audioOutputDevices[nextIndex]
    applySinkId(Array.from(remoteAudioRefs.current.values()), device.deviceId)
    setAudioOutputIndex(nextIndex)
  }
  const handleRemoteAudioElement = (uid, el) => {
    if (el) remoteAudioRefs.current.set(uid, el)
    else remoteAudioRefs.current.delete(uid)
  }

  const isEndedState = groupCallState === 'ended' || groupCallState === 'failed'
  const isConnecting = groupCallState === 'connecting'
  const isActive = groupCallState === 'active'
  const type = activeGroupCall?.type || 'voice'
  const isVideo = type === 'video'

  const joinedParticipants = participants.filter((p) => p.state === 'joined')

  useEffect(() => {
    const missing = joinedParticipants.map((p) => p.uid).filter((uid) => !(uid in profiles))
    if (missing.length === 0) return
    missing.forEach((uid) => {
      setProfiles((prev) => ({ ...prev, [uid]: null }))
      getUserProfile(uid)
        .then((p) => setProfiles((prev) => ({ ...prev, [uid]: p })))
        .catch(() => {})
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinedParticipants.map((p) => p.uid).join(',')])

  useEffect(() => {
    if (!isEndedState) return undefined
    const timer = window.setTimeout(() => resetCall(), 2000)
    return () => window.clearTimeout(timer)
  }, [isEndedState, resetCall])

  if (groupCallState === 'idle' || groupCallState === 'incoming') return null

  let statusLabel = ''
  if (isConnecting) statusLabel = 'Connecting…'
  else if (isActive) statusLabel = `${joinedParticipants.length} ${joinedParticipants.length === 1 ? 'person' : 'people'}`
  else if (groupCallState === 'failed') statusLabel = callError || 'Call failed'
  else if (groupCallState === 'ended') statusLabel = 'Call ended'

  // We only ever render tiles we have real media/participant records
  // for — the local tile (via localStream) and every remoteStreams
  // entry (only ever populated once a real ontrack fires for that
  // peer). No placeholder tiles for someone who hasn't actually joined.
  const remoteUids = Object.keys(remoteStreams)
  const totalTiles = 1 + remoteUids.length

  return (
    <div className="fixed inset-0 z-[10000] bg-gray-900 flex flex-col text-white">
      <div className="flex-shrink-0 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 flex items-center gap-2.5 bg-black/20">
        {activeGroupCall?.groupAvatar ? (
          <img src={activeGroupCall.groupAvatar} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-white" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold truncate">{activeGroupCall?.groupName || 'Group call'}</p>
          <p className="text-xs text-white/60">{statusLabel}</p>
        </div>
      </div>

      {isEndedState ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-lg font-semibold">{statusLabel}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3">
          <div className={`grid gap-2 ${gridColsClass(totalTiles, isVideo)}`}>
            <ParticipantTile
              uid="local"
              stream={localStream}
              participant={{ muted, cameraOff }}
              profile={myProfile}
              isVideo={isVideo}
              isLocal
              facingMode={facingMode}
            />
            {remoteUids.map((uid) => (
              <ParticipantTile
                key={uid}
                uid={uid}
                stream={remoteStreams[uid]}
                participant={joinedParticipants.find((p) => p.uid === uid)}
                profile={profiles[uid]}
                isVideo={isVideo}
                isLocal={false}
                facingMode={facingMode}
                onRemoteAudioElement={handleRemoteAudioElement}
              />
            ))}
          </div>
        </div>
      )}

      {!isEndedState && (
        <div className="flex-shrink-0 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
            className={`w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-all duration-200 ${
              muted ? 'bg-white text-gray-900' : 'bg-white/15 hover:bg-white/25 text-white'
            }`}
          >
            {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          {isVideo && (
            <button
              type="button"
              onClick={toggleCamera}
              aria-label={cameraOff ? 'Turn camera on' : 'Turn camera off'}
              className={`w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-all duration-200 ${
                cameraOff ? 'bg-white text-gray-900' : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
            >
              {cameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>
          )}
          {isVideo && isActive && !cameraOff && (
            <button
              type="button"
              onClick={switchCamera}
              disabled={switchingCamera}
              aria-label="Switch camera"
              className="w-12 h-12 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 text-white active:scale-95 disabled:opacity-50 transition-all duration-200"
            >
              <RefreshCw className={`w-5 h-5 ${switchingCamera ? 'animate-spin' : ''}`} />
            </button>
          )}
          {audioOutputSupported && audioOutputDevices.length > 1 && (
            <button
              type="button"
              onClick={handleCycleAudioOutput}
              aria-label={`Audio output: ${audioOutputDevices[audioOutputIndex]?.label || 'switch'}`}
              title={audioOutputDevices[audioOutputIndex]?.label || 'Switch audio output'}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 text-white active:scale-95 transition-all duration-200"
            >
              <Speaker className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={leaveGroupCall}
            aria-label="Leave call"
            className="w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center active:scale-95 transition-all duration-200"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  )
}
