import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreditCard, Mail, Upload } from 'lucide-react'
import AuthLayout from '../components/AuthLayout.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import { auth } from '../../firebase/firebase.js'
import { createVerificationRequest, getUserProfile, setCampusVerification } from '../utils/userProfile.js'
import { uploadStudentId } from '../utils/storage.js'
import { validateEmail } from '../validation/authValidation.js'
import { sanitizeEmail } from '../utils/sanitize.js'

export default function CampusVerificationPage() {
  const navigate = useNavigate()

  const [collegeEmail, setCollegeEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailSubmitting, setEmailSubmitting] = useState(false)

  const [idFile, setIdFile] = useState(null)
  const [idSubmitting, setIdSubmitting] = useState(false)
  const [idStatusMsg, setIdStatusMsg] = useState('')

  const [skipping, setSkipping] = useState(false)
  const [formError, setFormError] = useState('')

  const handleVerifyCollegeEmail = async (event) => {
    event.preventDefault()
    const clean = sanitizeEmail(collegeEmail)
    const error = validateEmail(clean)
    setEmailError(error)
    if (error || emailSubmitting || !auth.currentUser) return

    setEmailSubmitting(true)
    setFormError('')
    try {
      // NOTE: this confirms the email is well-formed only. A production
      // build should verify the domain / send a confirmation code from a
      // trusted backend (e.g. a Cloud Function) rather than trusting the
      // client outright — that backend piece is outside this UI-only pass.
      await setCampusVerification(auth.currentUser.uid, {
        verifiedCampus: true,
        verificationMethod: 'college_email',
        verificationStatus: 'verified'
      })
      navigate('/create-profile')
    } catch (err) {
      setFormError(err?.message || 'Could not verify right now. Please try again.')
    } finally {
      setEmailSubmitting(false)
    }
  }

  const handleUploadId = async () => {
    if (!idFile || idSubmitting || !auth.currentUser) return
    setIdSubmitting(true)
    setFormError('')
    try {
      const uid = auth.currentUser.uid
      const idCardUrl = await uploadStudentId(uid, idFile)
      const profile = await getUserProfile(uid)

      await setCampusVerification(uid, {
        verifiedCampus: false,
        verificationMethod: 'college_id',
        verificationStatus: 'pending'
      })

      await createVerificationRequest({
        uid,
        name: profile?.fullName || auth.currentUser.displayName || '',
        college: profile?.college || '',
        idCardUrl,
        verificationMethod: 'college_id'
      })

      setIdStatusMsg('Verification pending — usually reviewed within 24 hours.')
    } catch (err) {
      setFormError(err?.message || 'Could not submit right now. Please try again.')
    } finally {
      setIdSubmitting(false)
    }
  }

  const handleSkip = async () => {
    if (skipping || !auth.currentUser) return
    setSkipping(true)
    setFormError('')
    try {
      await setCampusVerification(auth.currentUser.uid, {
        verifiedCampus: false,
        verificationMethod: 'skipped',
        verificationStatus: 'not_started'
      })
      navigate('/create-profile')
    } catch (err) {
      setFormError(err?.message || 'Could not skip right now. Please try again.')
    } finally {
      setSkipping(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Campus verified"
      title="Verify you're a real student"
      subtitle="Choose one verification method."
      footer={
        <button
          type="button"
          onClick={handleSkip}
          disabled={skipping}
          className="font-semibold text-ink-soft hover:text-ink transition-colors duration-200 disabled:opacity-50"
        >
          {skipping ? 'Skipping…' : 'Skip for now'}
        </button>
      }
    >
      <div className="space-y-5">
        {formError && (
          <p role="alert" className="rounded-xl2 bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
            {formError}
          </p>
        )}

        {/* Option 1 — college email */}
        <div className="rounded-xl2 border border-line p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-accent-tint flex items-center justify-center text-accent">
              <Mail className="w-4 h-4" strokeWidth={1.8} />
            </div>
            <p className="text-sm font-semibold text-ink">Verify using college email</p>
          </div>

          <form onSubmit={handleVerifyCollegeEmail} noValidate className="space-y-3">
            <Input
              id="college-email"
              label="College email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="abc123@college.edu"
              value={collegeEmail}
              onChange={(e) => {
                setCollegeEmail(e.target.value)
                if (emailError) setEmailError('')
              }}
              error={emailError}
              disabled={emailSubmitting}
              required
            />
            <Button type="submit" loading={emailSubmitting}>
              Verify college email
            </Button>
          </form>
        </div>

        {/* Option 2 — college ID upload */}
        <div className="rounded-xl2 border border-line p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-accent-tint flex items-center justify-center text-accent">
              <CreditCard className="w-4 h-4" strokeWidth={1.8} />
            </div>
            <p className="text-sm font-semibold text-ink">Verify using college ID card</p>
          </div>

          <label
            htmlFor="id-upload"
            className="flex items-center gap-3 rounded-xl2 border border-dashed border-line px-4 py-3.5 cursor-pointer hover:border-accent/40 transition-colors duration-200"
          >
            <Upload className="w-4 h-4 text-ink-faint flex-shrink-0" strokeWidth={1.8} />
            <span className="text-[13.5px] text-ink-soft truncate">
              {idFile ? idFile.name : 'Upload front side of college ID'}
            </span>
            <input
              id="id-upload"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => setIdFile(e.target.files?.[0] || null)}
            />
          </label>

          {idStatusMsg && (
            <p role="status" className="mt-3 text-[12.5px] text-accent font-medium">
              {idStatusMsg}
            </p>
          )}

          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            onClick={handleUploadId}
            loading={idSubmitting}
            disabled={!idFile || !!idStatusMsg}
          >
            Submit for review
          </Button>
        </div>
      </div>
    </AuthLayout>
  )
}