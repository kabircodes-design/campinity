import { useNavigate } from 'react-router-dom'
import { ShieldCheck, X } from 'lucide-react'

/** onDismiss prop matches HomePage.jsx's exact existing call site. */
export default function CampusVerificationBanner({ onDismiss }) {
  const navigate = useNavigate()

  return (
    <div className="mx-4 mt-3 flex items-center gap-2.5 rounded-xl bg-blue-50 border border-blue-100 px-3.5 py-3">
      <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-semibold text-blue-900">Get Campus Verified</p>
        <p className="text-[11.5px] text-blue-700">Upload your student ID for a blue verification badge.</p>
      </div>
      <button
        type="button"
        onClick={() => navigate('/verify-college')}
        className="flex-shrink-0 rounded-full bg-blue-600 text-white text-[11px] font-semibold px-3 py-1.5 hover:bg-blue-700 transition-all duration-300"
      >
        Verify
      </button>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="flex-shrink-0 text-blue-400 hover:text-blue-600 transition-colors duration-200">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
