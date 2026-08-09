import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, ShieldCheck, Upload } from 'lucide-react'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { getUserProfile } from '../firebase/profileService.js'
import { submitVerificationRequest } from '../firebase/verificationService.js'

/**
 * Manual admin verification — stated in the UI itself, not just
 * internal comments, per "do not pretend that the app can
 * automatically determine whether an ID is genuine." Accepts the
 * user's already-selected collegeId from their profile (matching
 * "reference the real collegeId" — this page doesn't invent a second
 * college-selection flow, it reads what EditProfilePage already set).
 */
export default function VerifyCollegePage() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [alreadyVerified, setAlreadyVerified] = useState(false)
  const [collegeId, setCollegeId] = useState(null)

  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) {
      setLoading(false)
      return
    }
    getUserProfile(uid)
      .then((profile) => {
        setAlreadyVerified(Boolean(profile?.verifiedCampus))
        setCollegeId(profile?.collegeId || null)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleFileChange = (event) => {
    setFile(event.target.files?.[0] || null)
    setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!file || submitting) return

    const uid = auth.currentUser?.uid
    if (!uid) {
      setError('You need to be signed in.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await submitVerificationRequest({ uid, collegeId, file })
      setSubmitted(true)
    } catch (err) {
      setError(err?.message || 'Could not submit your document. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50 flex items-center justify-center">
        <Loader size="lg" tone="dark" />
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
            <span className="text-base font-bold tracking-tight text-gray-900">Campus Verification</span>
          </div>
        </header>

        {alreadyVerified ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
            </div>
            <p className="mt-3 text-sm font-semibold text-gray-900">You're already verified</p>
            <p className="mt-1 text-sm text-gray-400">Your account already has the Campus Verified badge.</p>
          </div>
        ) : submitted ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
              <Check className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="mt-3 text-sm font-semibold text-gray-900">Submitted for review</p>
            <p className="mt-1 text-sm text-gray-400 max-w-[280px] mx-auto">
              A platform admin will manually review your document. This isn't automatic — you'll see the badge on
              your profile once it's approved.
            </p>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-5 rounded-full bg-blue-600 text-white text-sm font-semibold px-6 py-2.5 hover:bg-blue-700 transition-all duration-300"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-4 py-5 space-y-5">
            <p className="text-sm text-gray-500">
              Upload your college/student ID to get the blue Campus Verified badge. A platform admin reviews every
              submission manually — this is not an automatic check.
            </p>

            <div>
              <label htmlFor="verification-file" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                ID document
              </label>
              <label
                htmlFor="verification-file"
                className="flex items-center gap-2.5 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 cursor-pointer hover:border-gray-400 transition-all duration-300"
              >
                <Upload className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-500 truncate">{file ? file.name : 'Choose a photo or PDF of your ID'}</span>
              </label>
              <input
                id="verification-file"
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                disabled={submitting}
                className="sr-only"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!file || submitting}
              className="w-full rounded-full bg-blue-600 text-white text-sm font-semibold py-3 hover:bg-blue-700 disabled:opacity-50 transition-all duration-300"
            >
              {submitting ? 'Submitting…' : 'Submit for Review'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
