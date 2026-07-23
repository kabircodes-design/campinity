import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import CampusVerificationOptions from '../components/CampusVerificationOptions.jsx'
import { auth } from '../../firebase/firebase.js'
import { setCampusVerification } from '../utils/userProfile.js'

export default function CampusVerificationPage() {
  const navigate = useNavigate()

  const [skipping, setSkipping] = useState(false)
  const [skipError, setSkipError] = useState('')

  const handleSkip = async () => {
    if (skipping || !auth.currentUser) return
    setSkipping(true)
    setSkipError('')
    try {
      await setCampusVerification(auth.currentUser.uid, {
        verifiedCampus: false,
        verificationMethod: 'skipped',
        verificationStatus: 'not_started'
      })
      navigate('/create-profile')
    } catch (err) {
      setSkipError(err?.message || 'Could not skip right now. Please try again.')
    } finally {
      setSkipping(false)
    }
  }

  const handleVerified = (method) => {
    if (method === 'college_email') {
      navigate('/create-profile')
    }
    // college_id goes to 'pending' review — CampusVerificationOptions
    // already shows the pending message and stays on this screen,
    // matching the original behavior.
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
      {skipError && (
        <p role="alert" className="mb-5 rounded-xl2 bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
          {skipError}
        </p>
      )}
      <CampusVerificationOptions onVerified={handleVerified} />
    </AuthLayout>
  )
}