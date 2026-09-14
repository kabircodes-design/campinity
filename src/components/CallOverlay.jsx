import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { getUserProfile } from '../firebase/profileService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'

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
    callError,
    durationSec,
    endCall,
    toggleMute,
    toggleCamera,
    resetCall
  } = call

  const [otherProfile, setOtherProfile] = useState(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const remoteAudioRef = useRef(null)

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
    if (type === 'video' && remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream || null
    if (type === 'voice' && remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream || null
  }, [remoteStream, type])

  const isEndedState = ['ended', 'declined', 'missed', 'failed'].includes(callState)

  // Auto-dismiss a terminal state after a moment, so "Call ended" /
  // "Call declined" / "No answer" / "Call failed" doesn't sit on screen
  // forever with no button to clear it.
  useEffect(() => {
    if (!isEndedState) return undefined
    const timer = window.setTimeout(() => resetCall(), 2000)
    return () => window.clearTimeout(timer)
  }, [isEndedState, resetCall])

  if (callState === 'idle') return null

  const displayName = otherProfile?.displayName || 'Student'
  const isVideo = type === 'video'
  const isOutgoing = callState === 'calling'
  const isConnecting = callState === 'connecting'
  const isActive = callState === 'active'

  let statusLabel = ''
  if (isOutgoing) statusLabel = 'Calling…'
  else if (isConnecting) statusLabel = 'Connecting…'
  else if (isActive) statusLabel = formatDuration(durationSec)
  else if (callState === 'declined') statusLabel = callError || 'Call declined'
  else if (callState === 'missed') statusLabel = 'No answer'
  else if (callState === 'failed') statusLabel = callError || 'Call failed'
  else if (callState === 'ended') statusLabel = 'Call ended'

  return (
    <div className="fixed inset-0 z-[10000] bg-gray-900 flex flex-col items-center justify-center text-white">
      {isVideo && isActive && (
        <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover bg-gray-900" />
      )}
      {!isVideo && <audio ref={remoteAudioRef} autoPlay />}

      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        {(!isVideo || !isActive) && (
          <Avatar
            initials={getInitials(displayName)}
            colorClass={getAvatarColor(otherUid)}
            size="xl"
            src={getProfileIdentityImage(otherProfile) || undefined}
          />
        )}
        <p className="mt-4 text-xl font-bold">{displayName}</p>
        <p className="mt-1 text-sm text-white/70">{statusLabel}</p>
      </div>

      {isVideo && isActive && (
        <div className="absolute bottom-28 right-4 w-28 h-40 rounded-2xl overflow-hidden bg-gray-800 border border-white/20 shadow-lg">
          {cameraOff ? (
            <div className="w-full h-full flex items-center justify-center">
              <VideoOff className="w-5 h-5 text-white/50" />
            </div>
          ) : (
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          )}
        </div>
      )}

      <div className="absolute bottom-10 left-0 right-0 flex items-center justify-center gap-4">
        {isEndedState ? null : (
          <>
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
            <button
              type="button"
              onClick={endCall}
              aria-label="End call"
              className="w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center active:scale-95 transition-all duration-200"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
