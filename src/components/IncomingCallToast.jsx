import { useEffect, useState } from 'react'
import { Phone, PhoneOff, Video } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { getUserProfile } from '../firebase/profileService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'

/**
 * Compact, non-blocking incoming-call card — deliberately NOT a
 * full-screen takeover. Per the explicit "recipient must receive a
 * proper incoming-call experience WITHOUT... navigating unexpectedly"
 * and "do not abruptly redirect the user away from their current
 * chat/app" instructions: whatever the recipient was doing (reading
 * Home, typing a post, browsing Marketplace) stays fully visible and
 * interactive underneath this. It only goes full-screen (CallOverlay)
 * once the recipient actually accepts — the same "toast while idle,
 * full-screen once in-call" pattern real chat apps use.
 */
export default function IncomingCallToast({ call }) {
  const { incomingCall, answerCall, declineCall } = call
  const [callerProfile, setCallerProfile] = useState(null)

  const callerUid = incomingCall?.callerUid || null

  useEffect(() => {
    if (!callerUid) {
      setCallerProfile(null)
      return undefined
    }
    let cancelled = false
    getUserProfile(callerUid)
      .then((p) => {
        if (!cancelled) setCallerProfile(p)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [callerUid])

  if (!incomingCall) return null

  const isVideo = incomingCall.type === 'video'
  const displayName = callerProfile?.displayName || 'Student'

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 lg:left-auto lg:right-6 lg:translate-x-0 z-[10000] w-[calc(100%-2rem)] max-w-[360px] animate-[incomingCallIn_0.25s_ease-out]">
      <style>{`@keyframes incomingCallIn { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div className="rounded-2xl bg-white border border-gray-100 shadow-[0_12px_32px_rgba(15,23,42,0.14)] p-4">
        <div className="flex items-center gap-3">
          <Avatar
            initials={getInitials(displayName)}
            colorClass={getAvatarColor(callerUid)}
            size="md"
            src={getProfileIdentityImage(callerProfile) || undefined}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900 truncate">{displayName}</p>
            <p className="flex items-center gap-1 text-xs text-blue-600 font-medium">
              {isVideo ? <Video className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
              Incoming {isVideo ? 'video' : 'voice'} call
            </p>
          </div>
        </div>

        {isVideo && (
          <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">Accepting will ask for camera access.</p>
        )}

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={declineCall}
            aria-label="Decline call"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold py-2.5 hover:bg-gray-200 active:scale-[0.98] transition-all duration-150"
          >
            <PhoneOff className="w-3.5 h-3.5" /> Decline
          </button>
          <button
            type="button"
            onClick={answerCall}
            aria-label="Accept call"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-emerald-500 text-white text-xs font-semibold py-2.5 hover:bg-emerald-600 active:scale-[0.98] transition-all duration-150"
          >
            <Phone className="w-3.5 h-3.5" /> Accept
          </button>
        </div>
      </div>
    </div>
  )
}
