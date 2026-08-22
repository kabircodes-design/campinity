import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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

export default function LoginPage() {
  const emailRef = useRef(null)
  const [rememberMe, setRememberMe] = useState(true)
  const [googleLoading, setGoogleLoading] = useState(false)

  const { values, fieldError, handleChange, handleBlur, handleSubmit, isValid, isSubmitting, submitError, submitSuccess } =
    useAuthForm({
      initialValues: { email: '', password: '' },
      sanitizers: { email: sanitizeEmail, password: sanitizePassword },
      validate: validateLoginForm
    })

  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  const onSubmit = handleSubmit(async () => {
    // TODO(firebase): replace with signInWithEmailAndPassword(auth, values.email, values.password)
    await new Promise((resolve) => setTimeout(resolve, 900))
  })

  const handleGoogle = async () => {
    setGoogleLoading(true)
    // TODO(firebase): replace with signInWithPopup(auth, googleProvider)
    await new Promise((resolve) => setTimeout(resolve, 900))
    setGoogleLoading(false)
  }

  return (
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
            Logged in — redirecting to your campus feed shortly.
          </p>
        )}

        <Button type="submit" loading={isSubmitting} disabled={!isValid}>
          Log in
        </Button>
      </form>
    </AuthLayout>
  )
}
