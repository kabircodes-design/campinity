import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase/firebase.js'

/**
 * College data in this app is local/static (dummyColleges.js), not a
 * Firestore collection — confirmed by tracing every real usage before
 * writing this page. That means this page cannot actually add to the
 * live college list; a real "creation" flow doesn't exist and inventing
 * one would mean fabricating authoritative data no other part of the
 * app would ever see, since dummyColleges.js is a static file, not
 * something this page could safely rewrite from the client.
 *
 * What's implemented instead: a genuine request/submission flow — the
 * user's suggestion is written to a new collegeRequests collection for
 * manual review, never merged into the authoritative list automatically.
 * This matches the explicit instruction: no arbitrary user should be
 * able to silently create/modify authoritative college records, and no
 * admin/moderation system exists for colleges to build a fake approval
 * flow on top of.
 *
 * New Firestore dependency, reported explicitly per the scope-lock
 * instruction: collegeRequests/{requestId} needs its own rule (create
 * by the authenticated requester only, no public read/write) since
 * nothing else in firestore.rules currently covers it — without this,
 * the default deny-all catch-all at the bottom of the rules file would
 * reject every submission.
 */
export default function AddCollegePage() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!name.trim() || submitting) return

    const uid = auth.currentUser?.uid
    if (!uid) {
      setError('You need to be signed in.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await addDoc(collection(db, 'collegeRequests'), {
        name: name.trim(),
        location: location.trim(),
        requestedBy: uid,
        status: 'pending',
        createdAt: serverTimestamp()
      })
      setSubmitted(true)
    } catch (err) {
      setError(err?.message || 'Could not submit your request. Please try again.')
    } finally {
      setSubmitting(false)
    }
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

        {submitted ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
              <Check className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="mt-3 text-sm font-semibold text-gray-900">Request submitted</p>
            <p className="mt-1 text-sm text-gray-400 max-w-[280px] mx-auto">
              We'll review your college and add it soon. Thanks for helping grow Campinity.
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
              Don't see your college in the list? Submit it here and we'll review it for the campus directory.
            </p>

            <div>
              <label htmlFor="college-name" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                College name
              </label>
              <input
                id="college-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={submitting}
                placeholder="e.g. St. Xavier's College"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
              />
            </div>

            <div>
              <label htmlFor="college-location" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Location
              </label>
              <input
                id="college-location"
                type="text"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                disabled={submitting}
                placeholder="e.g. Mumbai, Maharashtra"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!name.trim() || submitting}
              className="w-full rounded-full bg-blue-600 text-white text-sm font-semibold py-3 hover:bg-blue-700 disabled:opacity-50 transition-all duration-300"
            >
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
