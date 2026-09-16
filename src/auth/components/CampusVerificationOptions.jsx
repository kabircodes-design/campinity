import { useState } from 'react'
import { CreditCard, Mail, Upload } from 'lucide-react'
import Button from './Button.jsx'
import Input from './Input.jsx'
import { auth } from '../../firebase/firebase.js'
import { createVerificationRequest, getUserProfile, setCampusVerification } from '../utils/userProfile.js'
import { uploadStudentId } from '../utils/storage.js'
import { validateEmail } from '../validation/authValidation.js'
import { sanitizeEmail } from '../utils/sanitize.js'

/**
 * The two verification-method option cards (college email + college ID
 * upload) — the exact verification logic and UI from
 * CampusVerificationPage.jsx, extracted so it can also be embedded
 * inside CampusVerificationModal.jsx without duplicating any Firebase
 * code.
 *
 * SECURITY FIX: the college-email path used to write verifiedCampus:
 * true directly from this client component the instant a
 * well-formed-but-unverified email string was typed in — no domain
 * check, no confirmation code, no admin involved at all. Any signed-in
 * user could self-verify by visiting /verify-college and typing any
 * syntactically valid email. Firestore's own users/{uid} update rule
 * had no restriction on this field either, so this wasn't just a UI
 * bug — a client could reach the same result with a raw Firestore
 * write, bypassing this component entirely (see firestore.rules for
 * the matching backend fix). Both methods now do the SAME thing:
 * submit a verificationRequests entry and leave verifiedCampus at
 * false, exactly like the college-ID path already did — an admin must
 * approve it (adminSetUserVerification / adminReviewVerificationRequest,
 * Cloud Functions using the Admin SDK) before verifiedCampus can ever
 * become true. `onVerified(method)` now always means "request
 * submitted," never "verified" — see CampusVerificationPage.jsx's own
 * updated handleVerified for how that's reflected in the UI.
 */
export default function CampusVerificationOptions({ onVerified }) {
  const [collegeEmail, setCollegeEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailSubmitting, setEmailSubmitting] = useState(false)
  const [emailStatusMsg, setEmailStatusMsg] = useState('')

  const [idFile, setIdFile] = useState(null)
  const [idSubmitting, setIdSubmitting] = useState(false)
  const [idStatusMsg, setIdStatusMsg] = useState('')

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
      const uid = auth.currentUser.uid
      const profile = await getUserProfile(uid)

      // Never verifiedCampus: true here — a real email-domain check
      // (or a sent confirmation code) belongs in a trusted backend,
      // which doesn't exist yet. Until it does, this method goes
      // through the same admin-reviewed request queue as the ID-card
      // path, not an instant self-grant.
      await setCampusVerification(uid, {
        verifiedCampus: false,
        verificationMethod: 'college_email',
        verificationStatus: 'pending'
      })

      await createVerificationRequest({
        uid,
        name: profile?.fullName || auth.currentUser.displayName || '',
        college: profile?.college || '',
        collegeEmail: clean,
        verificationMethod: 'college_email'
      })

      setEmailStatusMsg('Verification pending — usually reviewed within 24 hours.')
      onVerified?.('college_email')
    } catch (err) {
      setFormError(err?.message || 'Could not submit right now. Please try again.')
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
      onVerified?.('college_id')
    } catch (err) {
      setFormError(err?.message || 'Could not submit right now. Please try again.')
    } finally {
      setIdSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      {formError && (
        <p role="alert" className="rounded-xl2 bg-red-50 border border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400 text-[13px] px-4 py-3">
          {formError}
        </p>
      )}

      {/* Option 1 — college email */}
      <div className="rounded-xl2 border border-line dark:border-white/10 p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-accent-tint dark:bg-blue-500/15 flex items-center justify-center text-accent">
            <Mail className="w-4 h-4" strokeWidth={1.8} />
          </div>
          <p className="text-sm font-semibold text-ink dark:text-gray-50">Verify using college email</p>
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
            disabled={emailSubmitting || !!emailStatusMsg}
            required
          />
          {emailStatusMsg && (
            <p role="status" className="text-[12.5px] text-accent font-medium">
              {emailStatusMsg}
            </p>
          )}
          <Button type="submit" loading={emailSubmitting} disabled={!!emailStatusMsg}>
            Submit for review
          </Button>
        </form>
      </div>

      {/* Option 2 — college ID upload */}
      <div className="rounded-xl2 border border-line dark:border-white/10 p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-accent-tint dark:bg-blue-500/15 flex items-center justify-center text-accent">
            <CreditCard className="w-4 h-4" strokeWidth={1.8} />
          </div>
          <p className="text-sm font-semibold text-ink dark:text-gray-50">Verify using college ID card</p>
        </div>

        <label
          htmlFor="id-upload"
          className="flex items-center gap-3 rounded-xl2 border border-dashed border-line dark:border-white/15 px-4 py-3.5 cursor-pointer hover:border-accent/40 transition-colors duration-200"
        >
          <Upload className="w-4 h-4 text-ink-faint dark:text-gray-500 flex-shrink-0" strokeWidth={1.8} />
          <span className="text-[13.5px] text-ink-soft dark:text-gray-400 truncate">
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
  )
}