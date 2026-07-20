import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'

export default function AddCollegePage() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const validate = () => {
    const next = {}
    if (!name.trim()) next.name = 'College name is required'
    if (!city.trim()) next.city = 'City is required'
    if (!state.trim()) next.state = 'State is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validate() || isSubmitting) return

    setIsSubmitting(true)
    // TODO(firebase): write to a "collegeRequests" collection for review once Firebase is wired up.
    await new Promise((resolve) => setTimeout(resolve, 600))
    setIsSubmitting(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
        <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm flex items-center justify-center px-6 text-center">
          <div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-7 h-7" strokeWidth={1.7} />
            </div>
            <p className="mt-4 text-sm font-semibold text-gray-900 max-w-[260px] mx-auto leading-relaxed">
              Thanks! We'll review your college and add it soon.
            </p>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-5 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-300"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900">Add Your College</span>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="px-4 py-5 space-y-5">
          <p className="text-sm text-gray-500 leading-relaxed">
            Can't find your college in our verified list? Tell us about it and we'll review and add it.
          </p>

          <div>
            <label
              htmlFor="add-college-name"
              className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
            >
              College name
            </label>
            <input
              id="add-college-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSubmitting}
              className={`w-full rounded-xl border bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all duration-300 ${
                errors.name ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'
              }`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          <div>
            <label
              htmlFor="add-college-city"
              className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
            >
              City
            </label>
            <input
              id="add-college-city"
              type="text"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              disabled={isSubmitting}
              className={`w-full rounded-xl border bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all duration-300 ${
                errors.city ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'
              }`}
            />
            {errors.city && <p className="mt-1 text-xs text-red-500">{errors.city}</p>}
          </div>

          <div>
            <label
              htmlFor="add-college-state"
              className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
            >
              State
            </label>
            <input
              id="add-college-state"
              type="text"
              value={state}
              onChange={(event) => setState(event.target.value)}
              disabled={isSubmitting}
              className={`w-full rounded-xl border bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all duration-300 ${
                errors.state ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'
              }`}
            />
            {errors.state && <p className="mt-1 text-xs text-red-500">{errors.state}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-blue-600 text-white text-sm font-semibold py-3 hover:bg-blue-700 disabled:opacity-50 transition-all duration-300"
          >
            {isSubmitting ? 'Submitting…' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  )
}