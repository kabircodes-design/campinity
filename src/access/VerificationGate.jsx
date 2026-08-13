import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Check, ShieldCheck } from 'lucide-react'

/**
 * Contextual, feature-specific gate — distinct from the existing
 * CampusVerificationModal.jsx (a generic one-time reminder shown on
 * Home). Deliberately reuses the exact same visual language (portal,
 * rounded-2xl white card, same button styling, same /verify-college
 * route) rather than inventing a competing design system, per the
 * explicit 'do not introduce a completely unrelated design system.'
 *
 * UI-layer only — this hides/explains the action, it does not enforce
 * anything. The actual enforcement is the service-layer check at each
 * call site plus the Firestore rule itself; see this feature's report
 * for exactly which restrictions are server-enforced today.
 */
const MESSAGES = {
  VIEW_CAMPUS_PDF: 'Verify your campus to unlock class notes, PDFs, important questions and study resources shared by your campus.',
  DOWNLOAD_CAMPUS_PDF: 'Verify your campus to download this resource.',
  SAVE_CAMPUS_RESOURCE: 'Save it for later — verify your campus first.',
  JOIN_PRIVATE_COMMUNITY: 'Private campus communities are available to verified members.',
  CREATE_COMMUNITY: 'Verify your campus before creating a community.'
}

export default function VerificationGate({ open, onClose, feature }) {
  const navigate = useNavigate()
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-6">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-[360px] rounded-2xl bg-white p-5 shadow-xl text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
        </div>
        <p className="mt-3 text-base font-bold text-gray-900">🔐 Unlock your campus</p>
        <p className="mt-1 text-xs text-gray-400">You're missing the full Campinity experience.</p>
        <p className="mt-2 text-sm text-gray-500 leading-relaxed">
          {MESSAGES[feature] || 'Verify your campus to unlock this feature.'}
        </p>

        <div className="mt-4 space-y-1.5 text-left">
          {['Join private communities', 'Access campus notes', 'Save campus resources', 'Create your own community'].map((line) => (
            <div key={line} className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
              <span className="text-xs text-gray-600">{line}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold py-2.5 hover:border-gray-300 transition-all duration-300"
          >
            Maybe later
          </button>
          <button
            type="button"
            onClick={() => {
              onClose()
              navigate('/verify-college')
            }}
            className="flex-1 rounded-full bg-blue-600 text-white text-sm font-semibold py-2.5 hover:bg-blue-700 transition-all duration-300"
          >
            Verify Campus
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
