import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles } from 'lucide-react'

/**
 * Honest "not available yet" screen for routes whose feature isn't built
 * (or, for the Ads prototype, isn't backed by real data) — never a page
 * filled with sample content. Always offers a way back.
 */
export default function ComingSoon({ title, message }) {
  const navigate = useNavigate()
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/home', { replace: true }))
  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-white flex flex-col">
      <div className="h-14 flex items-center px-3">
        <button
          type="button"
          aria-label="Back"
          onClick={goBack}
          className="w-10 h-10 rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-100 active:scale-95 transition-all duration-200"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 text-center pb-24">
        <div>
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto text-blue-600">
            <Sparkles className="w-6 h-6" strokeWidth={1.7} />
          </div>
          <h1 className="mt-4 text-lg font-bold text-gray-900">{title}</h1>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
            {message || "This isn't available yet. We'll let you know when it is."}
          </p>
          <button
            type="button"
            onClick={goBack}
            className="mt-5 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-200"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  )
}
