import { useEffect, useRef, useState } from 'react'
import { Maximize2, Mic, MicOff, Minimize2, PhoneOff, RefreshCw, Video, VideoOff } from 'lucide-react'
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
    switchCamera,
    switchingCamera,
    resetCall
  } = call

  const [otherProfile, setOtherProfile] = useState(null)
  const [minimized, setMinimized] = useState(false)
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
    <div className="fixed inset-0 z-[10000] bg-gray-900 flex flex-col items-center justify-center text-white">
      {!isEndedState && (
        <button
          type="button"
          onClick={() => setMinimized(true)}
          aria-label="Minimize call"
          className="absolute top-4 left-4 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors duration-200"
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
          className={`absolute inset-0 w-full h-full object-cover bg-gray-900 ${isActive ? '' : 'opacity-0'}`}
        />
      )}
      {/* Always mounted for the whole voice-call lifetime (not gated on
          isActive) — same reasoning as above, and there's no premature
          "Connected" concern here since <audio> has no visible frame to
          leak early. */}
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

      {isVideo && (
        <div className="absolute bottom-28 right-4 w-28 h-40 rounded-2xl overflow-hidden bg-gray-800 border border-white/20 shadow-lg">
          {/* Same fix as the remote element: this video used to unmount
              entirely on cameraOff (or before isActive), which threw
              away the DOM node the srcObject effect (keyed only on
              [localStream]) had already attached to — toggling the
              camera back on, or reaching 'active' after localStream was
              already set during 'calling'/'connecting', left this
              preview blank since the effect never re-ran on remount.
              Kept permanently mounted for the call's lifetime; camera-off
              is now a CSS overlay, not an unmount. */}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${cameraOff ? 'hidden' : ''}`}
          />
          {cameraOff && (
            <div className="absolute inset-0 flex items-center justify-center">
              <VideoOff className="w-5 h-5 text-white/50" />
            </div>
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
