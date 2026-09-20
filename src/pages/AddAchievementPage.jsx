import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, ShieldCheck, Upload } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { ACHIEVEMENT_CATEGORIES, submitAchievement } from '../firebase/achievementService.js'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 12 }).map((_, i) => CURRENT_YEAR - i)
const MAX_FILE_BYTES = 8 * 1024 * 1024

/**
 * "Have you received a certificate, award, recognition, or achievement
 * from your college?" — the submission flow from the brief. Users
 * cannot create an official badge themselves; this only ever creates a
 * PENDING achievementSubmissions doc (see achievementService.js /
 * firestore.rules) that an admin must approve before anything appears
 * on the profile.
 */
export default function AddAchievementPage() {
  const navigate = useNavigate()
  const uid = auth.currentUser?.uid
  const { profile } = useAuth()

  const [title, setTitle] = useState('')
  const [issuer, setIssuer] = useState('')
  const [category, setCategory] = useState(ACHIEVEMENT_CATEGORIES[0])
  const [year, setYear] = useState(CURRENT_YEAR)
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const handleFileChange = (e) => {
    const picked = e.target.files?.[0]
    if (!picked) return
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf']
    if (!validTypes.includes(picked.type)) {
      setError('Please upload a JPG, PNG, or PDF file.')
      return
    }
    if (picked.size > MAX_FILE_BYTES) {
      setError('File is too large — please keep it under 8MB.')
      return
    }
    setError('')
    setFile(picked)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!title.trim() || !issuer.trim()) {
      setError('Please fill in the achievement title and issuer.')
      return
    }
    if (!file) {
      setError('Please attach your certificate.')
      return
    }
    setSubmitting(true)
    try {
      await submitAchievement({
        uid,
        title,
        issuer,
        collegeId: profile?.collegeId || null,
        category,
        year,
        description,
        file
      })
      setDone(true)
    } catch (err) {
      setError(err?.message || 'Could not submit this achievement. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50 flex items-center justify-center px-6">
        <div className="w-full max-w-[380px] text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
          </div>
          <p className="mt-4 text-lg font-bold text-gray-900">Submitted for verification</p>
          <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
            Your certificate will be reviewed by Campinity before it appears as a verified achievement on your
            profile. You'll be notified either way.
          </p>
          <button
            type="button"
            onClick={() => navigate('/badges')}
            className="mt-6 w-full rounded-full bg-blue-600 text-white text-sm font-semibold py-2.5 hover:bg-blue-700 transition-all duration-300"
          >
            View My Achievements
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[560px] lg:max-w-[640px] bg-white min-h-screen lg:shadow-sm lg:border-x lg:border-gray-100 pb-24">
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
            <span className="text-base font-bold tracking-tight text-gray-900">Add Achievement</span>
          </div>
        </header>

        <div className="px-4 mt-5">
          <p className="text-sm font-semibold text-gray-900">
            Have you received a certificate, award, recognition, or achievement from your college?
          </p>
          <p className="mt-1 text-xs text-gray-400 leading-relaxed">
            Submit it for verification and it'll appear on your profile as a Verified Campus Achievement — clearly
            distinct from badges you earn on Campinity itself.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-8 cursor-pointer hover:border-blue-300 transition-colors">
              <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={handleFileChange} className="hidden" />
              {file ? (
                <>
                  <FileText className="w-6 h-6 text-blue-600" />
                  <span className="text-sm font-semibold text-gray-900">{file.name}</span>
                  <span className="text-xs text-blue-600">Tap to replace</span>
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-gray-400" />
                  <span className="text-sm font-semibold text-gray-700">Upload Certificate</span>
                  <span className="text-xs text-gray-400">JPG, PNG, or PDF · up to 8MB</span>
                </>
              )}
            </label>

            <Field label="Achievement Title">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Inter-College Hackathon — 1st Place"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-400 transition-colors"
              />
            </Field>

            <Field label="Issued By">
              <input
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="Thakur College of Science and Commerce"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-400 transition-colors"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-400 transition-colors bg-white"
                >
                  {ACHIEVEMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Year">
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-400 transition-colors bg-white"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Description (optional)">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Add any extra context for the reviewer..."
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-400 transition-colors resize-none"
              />
            </Field>

            {error && <p className="text-xs font-semibold text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-blue-600 text-white text-sm font-semibold py-3 hover:bg-blue-700 disabled:opacity-50 transition-all duration-300"
            >
              {submitting ? 'Submitting…' : 'Submit for Verification'}
            </button>
            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
              Your certificate will be reviewed by Campinity before it appears as a verified achievement. It stays
              private to you and Campinity admins — it's never made publicly downloadable.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  )
}
