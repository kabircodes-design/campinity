import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'

/** open/onRemindLater props match HomePage.jsx's exact existing call site. Portal-based, matching the established fix for the SwipeablePage transform-trapping issue found earlier in this project. */
export default function CampusVerificationModal({ open, onRemindLater }) {
  const navigate = useNavigate()
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-6">
      <button type="button" aria-label="Close" onClick={onRemindLater} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-[340px] rounded-2xl bg-white p-5 shadow-xl text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
        </div>
        <p className="mt-3 text-base font-bold text-gray-900">Get Campus Verified</p>
        <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
          Upload your college/student ID and get a blue verification badge on your profile. Reviewed manually by a
          platform admin.
        </p>
        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={onRemindLater}
            className="flex-1 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold py-2.5 hover:border-gray-300 transition-all duration-300"
          >
            Remind Me Later
          </button>
          <button
            type="button"
            onClick={() => {
              onRemindLater()
              navigate('/verify-college')
            }}
            className="flex-1 rounded-full bg-blue-600 text-white text-sm font-semibold py-2.5 hover:bg-blue-700 transition-all duration-300"
          >
            Verify Now
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
