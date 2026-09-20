import { createPortal } from 'react-dom'
import { BadgeCheck, X } from 'lucide-react'
import { formatTimeAgo } from '../firebase/postService.js'

/**
 * Detail view for a Verified Campus Achievement — deliberately styled
 * distinct from BadgeDetailModal.jsx (a real "Campinity Achievement"
 * card would use an emoji + progress bar; this one leads with a
 * verification mark and issuing institution, per the brief's explicit
 * "clear visual distinction between a Campinity-earned badge and a
 * verified external achievement" requirement). Never shows the
 * underlying certificate file or any Storage path — that data doesn't
 * even exist on this record (see firestore.rules' comment on
 * verifiedAchievements).
 */
export default function VerifiedAchievementDetailModal({ open, onClose, achievement, collegeName }) {
  if (!open || !achievement) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 [animation:fadeIn_200ms_ease-out]" />
      <div className="relative w-full sm:max-w-[380px] rounded-t-2xl sm:rounded-2xl bg-white p-5 pb-8 sm:pb-5 shadow-xl text-center [animation:modalIn_250ms_cubic-bezier(0.16,1,0.3,1)]">
        <button type="button" aria-label="Close" onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100">
          <X className="w-4 h-4" />
        </button>

        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
          <BadgeCheck className="w-8 h-8 text-blue-600" />
        </div>

        <p className="mt-3 text-lg font-bold text-gray-900">{achievement.title}</p>
        <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
          <BadgeCheck className="w-3 h-3" /> Verified Campus Achievement
        </span>

        <div className="mt-4 space-y-1.5 text-sm text-gray-600">
          <p className="font-semibold text-gray-900">{achievement.issuer}{collegeName ? ` · ${collegeName}` : ''}</p>
          <p>{achievement.category} {achievement.year ? `· ${achievement.year}` : ''}</p>
        </div>

        {achievement.description && <p className="mt-3 text-sm text-gray-500 leading-relaxed">{achievement.description}</p>}

        <p className="mt-4 text-xs text-gray-400">
          This achievement was submitted by the student and verified by Campinity administrators
          {achievement.verifiedAt ? ` · ${formatTimeAgo(achievement.verifiedAt)}` : ''}.
        </p>
      </div>
    </div>,
    document.body
  )
}
