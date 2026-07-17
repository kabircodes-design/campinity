import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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

export default function SignupPage() {
  const nameRef = useRef(null)
  const [googleLoading, setGoogleLoading] = useState(false)

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

  const onSubmit = handleSubmit(async () => {
    // TODO(firebase): replace with createUserWithEmailAndPassword(auth, values.email, values.password)
    // then updateProfile(user, { displayName: values.fullName })
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
            Account created — welcome to Campinity.
          </p>
        )}

        <Button type="submit" loading={isSubmitting} disabled={!isValid}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  )
}
