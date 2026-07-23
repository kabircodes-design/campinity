import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { changePassword } from '../firebase/accountService.js'

export default function ChangePasswordPage() {
  const navigate = useNavigate()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const validate = () => {
    const next = {}
    if (!currentPassword) next.currentPassword = 'Enter your current password'
    if (!newPassword) {
      next.newPassword = 'Enter a new password'
    } else if (newPassword.length < 6) {
      next.newPassword = 'Password must be at least 6 characters'
    }
    if (newPassword && newPassword === currentPassword) {
      next.newPassword = 'New password must be different from your current password'
    }
    if (confirmPassword !== newPassword) next.confirmPassword = 'Passwords do not match'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validate() || isSaving) return

    setIsSaving(true)
    try {
      await changePassword(currentPassword, newPassword)
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        setErrors({ currentPassword: 'Current password is incorrect' })
      } else if (err?.code === 'auth/weak-password') {
        setErrors({ newPassword: 'Please choose a stronger password' })
      } else {
        setErrors({ form: err?.message || 'Could not change your password. Please try again.' })
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate('/settings')}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900">Change Password</span>
          </div>
        </header>

        {success ? (
          <div className="px-6 py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-7 h-7" strokeWidth={1.7} />
            </div>
            <p className="mt-4 text-sm font-semibold text-gray-900">Password updated</p>
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="mt-5 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-300"
            >
              Back to Settings
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-4 py-6 space-y-5">
            <div>
              <label
                htmlFor="current-password"
                className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
              >
                Current password
              </label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                disabled={isSaving}
                autoComplete="current-password"
                className={`w-full rounded-xl border bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all duration-300 disabled:opacity-60 ${
                  errors.currentPassword ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'
                }`}
              />
              {errors.currentPassword && <p className="mt-1 text-xs text-red-500">{errors.currentPassword}</p>}
            </div>

            <div>
              <label
                htmlFor="new-password"
                className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
              >
                New password
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={isSaving}
                autoComplete="new-password"
                className={`w-full rounded-xl border bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all duration-300 disabled:opacity-60 ${
                  errors.newPassword ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'
                }`}
              />
              {errors.newPassword && <p className="mt-1 text-xs text-red-500">{errors.newPassword}</p>}
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
              >
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isSaving}
                autoComplete="new-password"
                className={`w-full rounded-xl border bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all duration-300 disabled:opacity-60 ${
                  errors.confirmPassword ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'
                }`}
              />
              {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>}
            </div>

            {errors.form && (
              <p role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
                {errors.form}
              </p>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-full bg-blue-600 text-white text-sm font-semibold py-3 hover:bg-blue-700 disabled:opacity-50 transition-all duration-300"
            >
              {isSaving ? 'Saving…' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}