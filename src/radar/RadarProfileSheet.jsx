import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { X, MessageCircle, Users, Sparkles } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { auth } from '../firebase/firebase.js'
import { getOrCreateChat } from '../firebase/chatService.js'
import { matchTier } from './radarService.js'

const TIER_LABEL = { high: 'High match', medium: 'Medium match', low: 'Some overlap' }
const TIER_COLOR = { high: 'text-emerald-600 bg-emerald-50', medium: 'text-blue-600 bg-blue-50', low: 'text-gray-500 bg-gray-100' }

/** Same portal pattern as every other bottom sheet in this project — applied from the start, not re-learned. */
export default function RadarProfileSheet({ match, onClose }) {
  const navigate = useNavigate()
  const currentUid = auth.currentUser?.uid

  if (!match) return null

  const tier = matchTier(match.score)

  const handleMessage = async () => {
    try {
      const { chatId } = await getOrCreateChat(currentUid, match.uid)
      navigate(`/messages/${chatId}`)
    } catch (err) {
      console.error('Could not open or start this conversation:', err)
    }
  }

  const sheet = (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 animate-in fade-in duration-200" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 420, damping: 40 }}
        className="relative w-full max-w-[480px] lg:max-w-[520px] bg-white rounded-t-3xl max-h-[80vh] overflow-y-auto"
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-9 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="flex justify-end px-4">
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-all duration-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-6 text-center">
          <Avatar initials={getInitials(match.displayName)} colorClass={getAvatarColor(match.uid)} size="xl" src={getProfileIdentityImage(match) || undefined} />
          <p className="mt-3 text-lg font-bold text-gray-900">{match.displayName}</p>
          {match.username && <p className="text-sm text-gray-400">@{match.username}</p>}
          <p className="mt-1 text-[13px] text-gray-500">{[match.course, match.year].filter(Boolean).join(' · ')}</p>

          <span className={`inline-flex items-center gap-1 mt-3 rounded-full px-3 py-1 text-xs font-semibold ${TIER_COLOR[tier]}`}>
            <Sparkles className="w-3 h-3" />
            {TIER_LABEL[tier]}
          </span>

          {match.interests?.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {match.interests.slice(0, 6).map((interest) => (
                <span key={interest} className="rounded-full bg-gray-100 text-gray-600 text-[11px] px-2.5 py-1">
                  {interest}
                </span>
              ))}
            </div>
          )}

          {match.reasons?.length > 0 && (
            <div className="mt-4 text-left rounded-xl bg-gray-50 px-3.5 py-3">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Why you matched</p>
              <ul className="space-y-1">
                {match.reasons.map((reason) => (
                  <li key={reason} className="text-[13px] text-gray-700 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-blue-600" />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(match.mutualCommunityCount > 0 || match.mutualFriendCount > 0) && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-gray-500">
              <Users className="w-3.5 h-3.5" />
              {match.mutualCommunityCount > 0 && `${match.mutualCommunityCount} mutual communities`}
              {match.mutualCommunityCount > 0 && match.mutualFriendCount > 0 && ' · '}
              {match.mutualFriendCount > 0 && `${match.mutualFriendCount} mutual friends`}
            </p>
          )}

          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={handleMessage}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-blue-600 text-white text-sm font-semibold py-2.5 hover:bg-blue-700 transition-all duration-300"
            >
              <MessageCircle className="w-4 h-4" />
              Message
            </button>
            <button
              type="button"
              onClick={() => navigate(`/student/${match.username}`)}
              className="flex-1 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold py-2.5 hover:border-gray-300 transition-all duration-300"
            >
              View Profile
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )

  return createPortal(<AnimatePresence>{match && sheet}</AnimatePresence>, document.body)
}
