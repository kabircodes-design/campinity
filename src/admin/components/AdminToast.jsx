import { useEffect } from 'react'
import { Check, X } from 'lucide-react'

/**
 * Minimal action-feedback toast, shared by every new admin page in
 * this pass — auto-dismisses, never blocks interaction underneath.
 * `toast` shape: { tone: 'success' | 'error', message: string } | null
 */
export default function AdminToast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(onDismiss, 2500)
    return () => window.clearTimeout(timer)
  }, [toast, onDismiss])

  if (!toast) return null

  const isSuccess = toast.tone !== 'error'

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] max-w-[90vw]">
      <div
        className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-lg ${
          isSuccess ? 'bg-gray-900' : 'bg-red-600'
        }`}
      >
        {isSuccess ? <Check className="w-4 h-4 flex-shrink-0" /> : <X className="w-4 h-4 flex-shrink-0" />}
        <span className="truncate">{toast.message}</span>
      </div>
    </div>
  )
}
