import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, PhoneOff, RefreshCw, Users, Video, VideoOff } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { getUserProfile } from '../firebase/profileService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'

function ParticipantTile({ uid, stream, participant, profile, isVideo, isLocal, facingMode }) {
  const videoRef = useRef(null)
  const cameraOff = participant?.cameraOff
  const muted = participant?.muted

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream || null
  }, [stream])

  const displayName = profile?.displayName || 'Student'
  const mirrored = isLocal && facingMode === 'user'

  return (
    <div className="relative rounded-2xl overflow-hidden bg-gray-800 aspect-square sm:aspect-video flex items-center justify-center">
      {isVideo && !cameraOff ? (
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

  const [profiles, setProfiles] = useState({})

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
          <div className={`grid gap-2 ${isVideo ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-3 sm:grid-cols-4'}`}>
            <ParticipantTile
              uid="local"
              stream={localStream}
              participant={{ muted, cameraOff }}
              profile={null}
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
