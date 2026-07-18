import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sendEmailVerification } from 'firebase/auth'
import { MailCheck } from 'lucide-react'
import AuthLayout from '../components/AuthLayout.jsx'
import Button from '../components/Button.jsx'
import { auth } from '../../firebase/firebase.js'
import { resolveOnboardingRoute } from '../components/ProtectedRoute.jsx'
import { getUserProfile } from '../utils/userProfile.js'

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const [resending, setResending] = useState(false)
  const [checking, setChecking] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [error, setError] = useState('')

  const email = auth.currentUser?.email

  const handleResend = async () => {
    if (!auth.currentUser || resending) return
    setResending(true)
    setError('')
    setResendMessage('')
    try {
      await sendEmailVerification(auth.currentUser)
      setResendMessage('Verification email sent — check your inbox.')
    } catch (err) {
      setError(err?.message || 'Could not resend the email. Please try again.')
    } finally {
      setResending(false)
    }
  }

  const handleCheckVerified = async () => {
    if (!auth.currentUser || checking) return
    setChecking(true)
    setError('')
    try {
      await auth.currentUser.reload()
      if (auth.currentUser.emailVerified) {
        const profile = await getUserProfile(auth.currentUser.uid)
        navigate(resolveOnboardingRoute(profile))
      } else {
        setError("Still not verified — open the link in the email we sent, then try again.")
      }
    } catch (err) {
      setError(err?.message || 'Something went wrong while checking. Please try again.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="One last step"
      title="Verify your email"
      subtitle={
        email
          ? `We've sent a verification email to ${email}.`
          : "We've sent a verification email to your inbox."
      }
    >
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent-tint flex items-center justify-center">
          <MailCheck className="w-8 h-8 text-accent" strokeWidth={1.6} />
        </div>

        {resendMessage && (
          <p
            role="status"
            className="mt-5 w-full rounded-xl2 bg-accent-tint text-accent text-[13px] font-medium px-4 py-3"
          >
            {resendMessage}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-5 w-full rounded-xl2 bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3"
          >
            {error}
          </p>
        )}

        <div className="mt-7 w-full space-y-3">
          <Button onClick={handleCheckVerified} loading={checking} disabled={resending}>
            I've verified
          </Button>
          <Button variant="secondary" onClick={handleResend} loading={resending} disabled={checking}>
            Resend email
          </Button>
        </div>
      </div>
    </AuthLayout>
  )
}