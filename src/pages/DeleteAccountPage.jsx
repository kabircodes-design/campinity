import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { deleteAccount } from '../firebase/accountService.js'

const CONFIRM_PHRASE = 'DELETE'

export default function DeleteAccountPage() {
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const canSubmit = password.trim().length > 0 && confirmText.trim() === CONFIRM_PHRASE && !isDeleting

  const handleDelete = async (event) => {
    event.preventDefault()
    if (!canSubmit) return

    setError('')
    setIsDeleting(true)
    try {
      await deleteAccount(password)
      navigate('/login', { replace: true })
    } catch (err) {
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        setError('That password is incorrect.')
      } else if (err?.code === 'not-signed-in') {
        setError('You need to be signed in to do this.')
      } else {
        setError(err?.message || 'Could not delete your account. Please try again.')
      }
      setIsDeleting(false)
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
              disabled={isDeleting}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300 disabled:opacity-50"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900">Delete Account</span>
          </div>
        </header>

        <form onSubmit={handleDelete} className="px-4 py-6 space-y-5">
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">This action is permanent</p>
              <p className="mt-1 text-[13px] text-red-600 leading-relaxed">
                Deleting your account permanently removes your profile, posts, comments, likes, follows,
                messages, and notifications. This cannot be undone.
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor="delete-password"
              className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
            >
              Confirm your password
            </label>
            <input
              id="delete-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isDeleting}
              autoComplete="current-password"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:bg-white focus:border-red-400 focus:ring-4 focus:ring-red-50 transition-all duration-300 disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="delete-confirm"
              className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
            >
              Type {CONFIRM_PHRASE} to confirm
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              disabled={isDeleting}
              autoComplete="off"
              placeholder={CONFIRM_PHRASE}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 outline-none focus:bg-white focus:border-red-400 focus:ring-4 focus:ring-red-50 transition-all duration-300 disabled:opacity-60"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/settings')}
              disabled={isDeleting}
              className="flex-1 rounded-full border border-gray-200 text-gray-600 text-sm font-semibold py-3 hover:border-gray-300 transition-all duration-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 rounded-full bg-red-600 text-white text-sm font-semibold py-3 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300"
            >
              {isDeleting ? 'Deleting…' : 'Delete My Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}