import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import Icon from '../../components/Icon.jsx'
import { useAuthForm } from '../hooks/useAuthForm.js'
import { validateForgotPasswordForm } from '../validation/authValidation.js'
import { sanitizeEmail } from '../utils/sanitize.js'

export default function ForgotPasswordPage() {
  const emailRef = useRef(null)

  const { values, fieldError, handleChange, handleBlur, handleSubmit, isValid, isSubmitting, submitError, submitSuccess } =
    useAuthForm({
      initialValues: { email: '' },
      sanitizers: { email: sanitizeEmail },
      validate: validateForgotPasswordForm
    })

  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  const onSubmit = handleSubmit(async () => {
    // TODO(firebase): replace with sendPasswordResetEmail(auth, values.email)
    await new Promise((resolve) => setTimeout(resolve, 900))
  })

  return (
    <AuthLayout
      eyebrow="Reset password"
      title="Forgot your password?"
      subtitle="Enter your campus email and we'll send you a reset link."
      footer={
        <Link to="/login" className="font-semibold text-accent hover:text-accent-deep transition-colors duration-200">
          Back to log in
        </Link>
      }
    >
      {submitSuccess ? (
        <div className="text-center py-2">
          <div className="mx-auto w-11 h-11 rounded-full bg-accent-tint flex items-center justify-center text-accent">
            <Icon name="check" className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <p className="mt-4 text-[14.5px] text-ink leading-relaxed">
            Check your inbox — a reset link is on its way to{' '}
            <span className="font-semibold">{values.email}</span>.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Input
            ref={emailRef}
            id="forgot-email"
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

          {submitError && (
            <p role="alert" className="rounded-xl2 bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
              {submitError}
            </p>
          )}

          <Button type="submit" loading={isSubmitting} disabled={!isValid}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
