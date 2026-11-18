import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgeCheck, Check, FileText, ImageIcon, Lock, ShieldCheck, Upload, X } from 'lucide-react'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { getUserProfile } from '../firebase/profileService.js'
import { submitVerificationRequest } from '../firebase/verificationService.js'
import SettingsPageShell, { Notice, primaryBtn } from '../components/settings/SettingsPageShell.jsx'
import { Card, EmptyState, IconTile, primaryPill } from '../components/ui/Premium.jsx'

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
const STEPS = [
  { title: 'Upload your student ID', body: 'A clear photo or PDF of your college ID card.' },
  { title: 'Manual review', body: 'A Campinity admin checks it by hand — it is never automatic.' },
  { title: 'Get the blue badge', body: 'Your profile shows Verified Campus Member once approved.' }
]

/**
 * Manual admin verification. Reads the collegeId already chosen in Edit
 * Profile; does not invent a second college-selection flow.
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
      .catch(() => setError('Could not load your profile. Check your connection and try again.'))
      .finally(() => setLoading(false))
  }, [])

  const handleFileChange = (event) => {
    const picked = event.target.files?.[0] || null
    event.target.value = ''
    if (!picked) return
    if (!ACCEPTED.includes(picked.type)) return setError('Use a photo (JPEG, PNG, WebP, HEIC) or a PDF.')
    if (picked.size > MAX_BYTES) return setError('That file is larger than 10 MB. Choose a smaller photo or PDF.')
    setError('')
    setFile(picked)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!file || submitting) return
    const uid = auth.currentUser?.uid
    if (!uid) return setError('You need to be signed in.')
    if (!collegeId) return setError('Choose your college in Edit Profile first, then come back to verify.')
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

  const isPdf = file?.type === 'application/pdf'
  const sizeLabel = file ? `${(file.size / (1024 * 1024)).toFixed(file.size > 1024 * 1024 ? 1 : 2)} MB` : ''

  return (
    <SettingsPageShell title="Campus verification" back="/settings/account">
      {loading ? (
        <div className="py-16 flex justify-center" role="status" aria-label="Loading">
          <Loader size="md" tone="dark" />
        </div>
      ) : alreadyVerified ? (
        <EmptyState
          icon={BadgeCheck}
          title="You're already verified"
          body="Your account has the Verified Campus Member badge."
          action={<button type="button" onClick={() => navigate('/profile')} className={primaryPill}>View my profile</button>}
        />
      ) : submitted ? (
        <EmptyState
          icon={Check}
          title="Submitted for review"
          body="A Campinity admin will review your document by hand. You'll see the badge on your profile once it's approved."
          action={<button type="button" onClick={() => navigate(-1)} className={primaryPill}>Done</button>}
        />
      ) : (
        <form onSubmit={handleSubmit} noValidate className="px-4 pt-2 space-y-4">
          <Card className="p-5 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-blue-500/10 dark:via-[#11131a] dark:to-indigo-500/10">
            <div className="flex items-start gap-3">
              <IconTile icon={ShieldCheck} size="lg" />
              <div>
                <h2 className="text-[18px] font-bold tracking-tight text-gray-900 dark:text-gray-50">Get the Campus Verified badge</h2>
                <p className="mt-1 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">Verified students are trusted more in chats, the marketplace and communities.</p>
              </div>
            </div>
            <ol className="mt-4 space-y-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[12px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <span>
                    <span className="block text-[13.5px] font-semibold text-gray-900 dark:text-gray-50">{step.title}</span>
                    <span className="block text-[12.5px] text-gray-500 dark:text-gray-400">{step.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-4 sm:p-5">
            <p id="verification-file-label" className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-2">ID document</p>
            {file ? (
              <div className="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] p-3 animate-[fadeIn_180ms_ease]">
                <IconTile icon={isPdf ? FileText : ImageIcon} tone={isPdf ? 'rose' : 'blue'} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-50 truncate">{file.name}</p>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400">{isPdf ? 'PDF' : 'Photo'} · {sizeLabel}</p>
                </div>
                <button type="button" onClick={() => setFile(null)} disabled={submitting} aria-label="Remove file" className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200/70 dark:hover:bg-white/10">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label htmlFor="verification-file" className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-500/30 bg-blue-50/40 dark:bg-blue-500/5 px-4 py-8 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors duration-200 text-center">
                <span className="w-12 h-12 rounded-2xl bg-white dark:bg-white/10 shadow-sm flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Upload className="w-5 h-5" />
                </span>
                <span className="text-[14px] font-semibold text-blue-700 dark:text-blue-300">Choose a photo or PDF</span>
                <span className="text-[12px] text-gray-500 dark:text-gray-400">JPEG, PNG, WebP, HEIC or PDF · up to 10 MB</span>
              </label>
            )}
            <input id="verification-file" aria-labelledby="verification-file-label" type="file" accept={ACCEPTED.join(',')} onChange={handleFileChange} disabled={submitting} className="sr-only" />
            <p className="mt-3 flex items-start gap-2 text-[12px] text-gray-500 dark:text-gray-400">
              <Lock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden="true" />
              Only you and Campinity admins can see this document. It is used only to verify your campus.
            </p>
          </Card>

          {error && <Notice tone="error">{error}</Notice>}

          <button type="submit" disabled={!file || submitting} className={primaryBtn}>
            {submitting ? 'Submitting…' : 'Submit for review'}
          </button>
        </form>
      )}
    </SettingsPageShell>
  )
}
