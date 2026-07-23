import { useNavigate } from 'react-router-dom'
import { GraduationCap, X } from 'lucide-react'

export default function CampusVerificationBanner({ onDismiss }) {
  const navigate = useNavigate()

  return (
    <div className="flex items-center gap-2 bg-blue-50 border-b border-blue-100 px-4 py-2.5">
      <GraduationCap className="w-4 h-4 text-blue-600 flex-shrink-0" />
      <p className="flex-1 min-w-0 text-xs font-medium text-blue-700">
        🎓 Verify your campus to unlock all Campinity features.
      </p>
      <button
        type="button"
        onClick={() => navigate('/campus-verification')}
        className="flex-shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-all duration-300"
      >
        Verify Now
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-blue-400 hover:bg-blue-100 hover:text-blue-600 transition-all duration-300"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}