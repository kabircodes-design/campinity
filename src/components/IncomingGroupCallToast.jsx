import { Phone, PhoneOff, Users, Video } from 'lucide-react'

/**
 * Incoming group call — same compact, non-blocking toast pattern as
 * IncomingCallToast.jsx (1:1), not a full-screen takeover before the
 * user has actually accepted.
 */
export default function IncomingGroupCallToast({ call }) {
  const { incomingGroupCall, joinGroupCall, declineGroupCall } = call

  if (!incomingGroupCall) return null

  const isVideo = incomingGroupCall.type === 'video'

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 lg:left-auto lg:right-6 lg:translate-x-0 z-[10000] w-[calc(100%-2rem)] max-w-[360px] animate-[incomingCallIn_0.25s_ease-out]">
      <style>{`@keyframes incomingCallIn { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div className="rounded-2xl bg-white border border-gray-100 shadow-[0_12px_32px_rgba(15,23,42,0.14)] p-4">
        <div className="flex items-center gap-3">
          {incomingGroupCall.groupAvatar ? (
            <img src={incomingGroupCall.groupAvatar} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900 truncate">{incomingGroupCall.groupName || 'Group'}</p>
            <p className="flex items-center gap-1 text-xs text-blue-600 font-medium">
              {isVideo ? <Video className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
              Incoming group {isVideo ? 'video' : 'voice'} call
            </p>
          </div>
        </div>

        {isVideo && (
          <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">Accepting will ask for camera access.</p>
        )}

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={declineGroupCall}
            aria-label="Decline call"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold py-2.5 hover:bg-gray-200 active:scale-[0.98] transition-all duration-150"
          >
            <PhoneOff className="w-3.5 h-3.5" /> Decline
          </button>
          <button
            type="button"
            onClick={joinGroupCall}
            aria-label="Join call"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-emerald-500 text-white text-xs font-semibold py-2.5 hover:bg-emerald-600 active:scale-[0.98] transition-all duration-150"
          >
            <Phone className="w-3.5 h-3.5" /> Join
          </button>
        </div>
      </div>
    </div>
  )
}
