import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth'
import AuthLayout from '../components/AuthLayout.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import PasswordInput from '../components/PasswordInput.jsx'
import Divider from '../components/Divider.jsx'
import GoogleGlyph from '../components/GoogleGlyph.jsx'
import Icon from '../../components/Icon.jsx'
import { useAuthForm } from '../hooks/useAuthForm.js'
import { validateLoginForm } from '../validation/authValidation.js'
import { sanitizeEmail, sanitizePassword } from '../utils/sanitize.js'
import { auth, googleProvider } from '../../firebase/firebase.js'
import { ensureUserDoc, getUserProfile } from '../utils/userProfile.js'
import { resolveOnboardingRoute } from '../components/ProtectedRoute.jsx'

export default function LoginPage() {
  const navigate = useNavigate()
  const emailRef = useRef(null)
  const [rememberMe, setRememberMe] = useState(true)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState('')

  const { values, fieldError, handleChange, handleBlur, handleSubmit, isValid, isSubmitting, submitError, submitSuccess } =
    useAuthForm({
      initialValues: { email: '', password: '' },
      sanitizers: { email: sanitizeEmail, password: sanitizePassword },
      validate: validateLoginForm
    })

  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  const onSubmit = handleSubmit(async ({ email, password }) => {
    const { user } = await signInWithEmailAndPassword(auth, email, password)

    // Spec step 1 of the login flow: always reload before trusting
    // emailVerified, in case verification happened in another tab/session.
    await user.reload()

    if (!auth.currentUser.emailVerified) {
      navigate('/verify-email')
      return
    }

    const profile = await getUserProfile(user.uid)
    navigate(resolveOnboardingRoute(profile))
  })

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
      setGoogleError(err?.message || 'Could not sign in with Google. Please try again.')
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <div
      className="relative min-h-screen lg:flex"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 900px 600px at 15% -10%, rgba(99,102,241,0.10), transparent), radial-gradient(ellipse 700px 500px at 100% 100%, rgba(59,130,246,0.08), transparent)'
      }}
    >
      {/* Desktop-only brand/storytelling column — a pure sibling of
          AuthLayout below, added without touching or needing to know
          AuthLayout's own internals. Mobile renders exactly as before
          this change (hidden below lg:). No animation, no motion —
          matches Phase 1's stability-first requirement. */}
      <div className="hidden lg:flex lg:w-[45%] lg:flex-col lg:justify-center lg:px-16 bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700 text-white relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-24 -left-10 w-80 h-80 rounded-full bg-white/5" />
        <div className="relative">
          <p className="text-2xl font-bold tracking-tight">Campinity</p>
          <p className="mt-6 text-4xl font-bold leading-tight">
            Your campus.
            <br />
            One place.
          </p>
          <p className="mt-4 text-indigo-100 text-base max-w-sm">
            Everything happening around your campus — feeds, notes, communities and people, all in one login.
          </p>
        </div>
      </div>

      <div className="relative z-10 flex-1 lg:flex lg:items-center lg:justify-center">
        <AuthLayout
          eyebrow="Welcome back"
          title="Log in to Campinity"
          subtitle="Your campus, right where you left it."
          footer={
            <>
              Don't have an account?{' '}
              <Link to="/signup" className="font-semibold text-accent hover:text-accent-deep transition-colors duration-200">
                Create account
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
              ref={emailRef}
              id="login-email"
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

            <PasswordInput
              id="login-password"
              label="Password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={values.password}
              onChange={handleChange('password')}
              onBlur={handleBlur('password')}
              error={fieldError('password')}
              disabled={isSubmitting}
              required
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[13.5px] text-ink-soft cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-line text-accent accent-accent focus:ring-2 focus:ring-accent-tint"
                />
                Remember me
              </label>
              <Link
                to="/forgot-password"
                className="text-[13.5px] font-semibold text-accent hover:text-accent-deep transition-colors duration-200"
              >
                Forgot password?
              </Link>
            </div>

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
                Logged in — redirecting…
              </p>
            )}

            <Button type="submit" loading={isSubmitting} disabled={!isValid}>
              Log in
            </Button>
          </form>
        </AuthLayout>
      </div>
    </div>
  )
}