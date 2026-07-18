import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithPopup, updateProfile } from 'firebase/auth'
import AuthLayout from '../components/AuthLayout.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import PasswordInput from '../components/PasswordInput.jsx'
import PasswordStrengthMeter from '../components/PasswordStrengthMeter.jsx'
import Divider from '../components/Divider.jsx'
import GoogleGlyph from '../components/GoogleGlyph.jsx'
import Icon from '../../components/Icon.jsx'
import { useAuthForm } from '../hooks/useAuthForm.js'
import { validateSignupForm } from '../validation/authValidation.js'
import { sanitizeEmail, sanitizePassword, sanitizeText } from '../utils/sanitize.js'
import { auth, googleProvider } from '../../firebase/firebase.js'
import { createInitialUserDoc, ensureUserDoc } from '../utils/userProfile.js'
import { resolveOnboardingRoute } from '../components/ProtectedRoute.jsx'

export default function SignupPage() {
  const navigate = useNavigate()
  const nameRef = useRef(null)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState('')

  const { values, fieldError, handleChange, handleBlur, handleSubmit, isValid, isSubmitting, submitError, submitSuccess } =
    useAuthForm({
      initialValues: { fullName: '', email: '', password: '', confirmPassword: '' },
      sanitizers: {
        fullName: sanitizeText,
        email: sanitizeEmail,
        password: sanitizePassword,
        confirmPassword: sanitizePassword
      },
      validate: validateSignupForm
    })

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const onSubmit = handleSubmit(async ({ fullName, email, password }) => {
    // 1. Create the Firebase Auth account.
    const { user } = await createUserWithEmailAndPassword(auth, email, password)

    if (fullName) {
      await updateProfile(user, { displayName: fullName })
    }

    // 2. Immediately create the Firestore users/{uid} doc with defaults.
    await createInitialUserDoc(user.uid, user.email)

    // 3. Send the verification email.
    await sendEmailVerification(user)

    // 4. Navigate to the verification step.
    navigate('/verify-email')
  })

  /**
   * Google sign-in doubles as sign-up for first-time users and sign-in for
   * returning ones — Firebase treats both identically, so this routes
   * through the same post-auth decision as Login rather than assuming
   * every Google user arriving here is brand new.
   */
  const handleGoogle = async () => {
    if (googleLoading) return
    setGoogleLoading(true)
    setGoogleError('')
    try {
      const { user } = await signInWithPopup(auth, googleProvider)

      if (!user.emailVerified) {
        navigate('/verify-email')
        return
      }

      const profile = await ensureUserDoc(user)
      navigate(resolveOnboardingRoute(profile))
    } catch (err) {
      setGoogleError(err?.message || 'Could not sign up with Google. Please try again.')
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Join your campus"
      title="Create your account"
      subtitle="Verified students only. Takes less than a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-accent hover:text-accent-deep transition-colors duration-200">
            Log in
          </Link>
        </>
      }
    >
      <Button
        variant="secondary"
        icon={<GoogleGlyph />}
        loading={googleLoading}
        disabled={isSubmitting}
        onClick={handleGoogle}
      >
        Continue with Google
      </Button>

      {googleError && (
        <p role="alert" className="mt-3 rounded-xl2 bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
          {googleError}
        </p>
      )}

      <Divider />

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Input
          ref={nameRef}
          id="signup-name"
          label="Full name"
          type="text"
          autoComplete="name"
          placeholder="Aarav Sharma"
          value={values.fullName}
          onChange={handleChange('fullName')}
          onBlur={handleBlur('fullName')}
          error={fieldError('fullName')}
          disabled={isSubmitting}
          required
        />

        <Input
          id="signup-email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@campus.edu"
          value={values.email}
          onChange={handleChange('email')}
          onBlur={handleBlur('email')}
          error={fieldError('email')}
          disabled={isSubmitting}
          required
        />

        <div>
          <PasswordInput
            id="signup-password"
            label="Password"
            autoComplete="new-password"
            placeholder="Create a password"
            value={values.password}
            onChange={handleChange('password')}
            onBlur={handleBlur('password')}
            error={fieldError('password')}
            disabled={isSubmitting}
            required
          />
          <PasswordStrengthMeter password={values.password} />
        </div>

        <PasswordInput
          id="signup-confirm-password"
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={values.confirmPassword}
          onChange={handleChange('confirmPassword')}
          onBlur={handleBlur('confirmPassword')}
          error={fieldError('confirmPassword')}
          disabled={isSubmitting}
          required
        />

        {submitError && (
          <p role="alert" className="rounded-xl2 bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
            {submitError}
          </p>
        )}

        {submitSuccess && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-xl2 bg-accent-tint text-accent text-[13px] font-medium px-4 py-3"
          >
            <Icon name="check" className="w-4 h-4" strokeWidth={2.2} />
            Account created — check your inbox to verify your email.
          </p>
        )}

        <Button type="submit" loading={isSubmitting} disabled={!isValid}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  )
}