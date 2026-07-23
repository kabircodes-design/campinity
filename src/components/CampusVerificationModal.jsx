import { useState } from 'react'
import { ArrowLeft, ChevronDown, GraduationCap, ShieldCheck, X } from 'lucide-react'
import CampusVerificationOptions from '../auth/components/CampusVerificationOptions.jsx'

/**
 * Two-step modal. Step 1 is the reminder; clicking "Verify Now" expands
 * the same modal into step 2, which embeds the real verification
 * options (CampusVerificationOptions — the same component/logic used by
 * CampusVerificationPage.jsx, not a duplicate). No navigation to another
 * page happens anymore.
 */
export default function CampusVerificationModal({ open, onRemindLater }) {
  const [step, setStep] = useState('reminder') // 'reminder' | 'verify'
  const [whyExpanded, setWhyExpanded] = useState(false)

  if (!open) return null

  const handleClose = () => {
    setStep('reminder')
    setWhyExpanded(false)
    onRemindLater()
  }

  const handleVerifyNow = () => {
    setStep('verify')
  }

  const handleVerified = (method) => {
    // college_email completes immediately — close the reminder.
    // college_id goes to 'pending' — CampusVerificationOptions already
    // shows the pending message inline, so the modal stays open,
    // matching CampusVerificationPage.jsx's own behavior.
    if (method === 'college_email') {
      handleClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="campus-verify-title"
        className="relative w-full max-w-[400px] max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl p-6 animate-[modalIn_250ms_ease-out]"
      >
        {step === 'verify' && (
          <button
            type="button"
            aria-label="Back"
            onClick={() => setStep('reminder')}
            className="absolute top-4 left-4 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all duration-300"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          aria-label="Close"
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all duration-300"
        >
          <X className="w-4 h-4" />
        </button>

        {step === 'reminder' ? (
          <>
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
              <GraduationCap className="w-7 h-7" strokeWidth={1.7} />
            </div>

            <h2 id="campus-verify-title" className="mt-4 text-lg font-bold text-gray-900">
              🎓 Verify Your Campus
            </h2>
            <p className="mt-1 text-[15px] font-semibold text-gray-800 leading-snug">
              Verify your campus to unlock the full Campinity experience.
            </p>

            <p className="mt-3 text-sm text-gray-500 leading-relaxed">
              Your campus is still unverified. Campus verification helps us keep Campinity safe, trusted, and
              exclusive to real students.
            </p>

            <ul className="mt-4 space-y-2">
              <li className="flex items-center gap-2 text-sm text-gray-700">
                <span aria-hidden="true">✅</span> Verified Badge
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-700">
                <span aria-hidden="true">✅</span> Trusted Student Profile
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-700">
                <span aria-hidden="true">✅</span> Access to future premium campus features
              </li>
            </ul>

            <p className="mt-4 text-sm text-gray-500 leading-relaxed">
              Verify your account today to enjoy the complete Campinity experience.
            </p>

            <button
              type="button"
              onClick={() => setWhyExpanded((prev) => !prev)}
              aria-expanded={whyExpanded}
              className="mt-3 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-all duration-300"
            >
              Why verify?
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${whyExpanded ? 'rotate-180' : ''}`} />
            </button>

            <div
              className={`grid transition-all duration-300 ease-out ${
                whyExpanded ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <div className="rounded-xl bg-blue-50/60 p-3 space-y-1.5">
                  <p className="flex items-start gap-2 text-xs text-gray-600">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                    Prevents fake accounts
                  </p>
                  <p className="flex items-start gap-2 text-xs text-gray-600">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                    Builds trusted campus communities
                  </p>
                  <p className="flex items-start gap-2 text-xs text-gray-600">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                    Unlocks future verified-only features
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleVerifyNow}
                className="w-full rounded-full bg-blue-600 text-white text-sm font-semibold py-3 hover:bg-blue-700 transition-all duration-300"
              >
                Verify Now
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="w-full rounded-full text-gray-500 text-sm font-semibold py-2.5 hover:bg-gray-50 transition-all duration-300"
              >
                Remind Me Later
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="campus-verify-title" className="text-lg font-bold text-gray-900 pl-8 pr-8 text-center">
              Verify Your Campus
            </h2>
            <p className="mt-1 mb-5 text-sm text-gray-500 text-center">Choose one verification method.</p>

            <CampusVerificationOptions onVerified={handleVerified} />
          </>
        )}
      </div>
    </div>
  )
}