import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import { REPORT_REASONS, submitReport } from '../firebase/reportService.js'

/**
 * One reusable modal for every target type — matches "prefer a clean
 * centralized architecture" from the service layer, applied to the
 * UI too. Callers pass { open, onClose, targetType, targetId,
 * targetOwnerUid }, e.g. from a post's menu:
 * <ReportModal open={...} onClose={...} targetType="post"
 * targetId={post.id} targetOwnerUid={post.userId} />
 */
export default function ReportModal({ open, onClose, targetType, targetId, targetOwnerUid }) {
  const [reason, setReason] = useState(null)
  const [details, setDetails] = useState('')
  const [step, setStep] = useState('reason') // 'reason' | 'details' | 'submitting' | 'done'
  const [error, setError] = useState('')

  if (!open) return null

  const handleClose = () => {
    setReason(null)
    setDetails('')
    setStep('reason')
    setError('')
    onClose()
  }

  const handleSelectReason = (id) => {
    setReason(id)
    setStep('details')
  }

  const handleSubmit = async () => {
    const uid = auth.currentUser?.uid
    if (!uid) {
      setError('You need to be signed in.')
      return
    }
    setStep('submitting')
    setError('')
    try {
      await submitReport({
        reporterUid: uid,
        targetType,
        targetId,
        targetOwnerUid,
        reason,
        details
      })
      setStep('done')
    } catch (err) {
      setError(err?.message || 'Could not submit your report. Please try again.')
      setStep('details')
    }
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/40 flex items-end sm:items-center justify-center"
      >
        <button type="button" aria-label="Close" onClick={handleClose} className="absolute inset-0" />
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="relative w-full sm:max-w-[400px] bg-white rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-base font-bold text-gray-900">
              {step === 'done' ? 'Report submitted' : "What's wrong with this?"}
            </span>
            <button type="button" onClick={handleClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {step === 'reason' && (
            <div className="space-y-1">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelectReason(r.id)}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-all duration-150"
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

          {(step === 'details' || step === 'submitting') && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tell us more (optional)</p>
              <textarea
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                disabled={step === 'submitting'}
                rows={3}
                placeholder="Add any details that might help..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300 resize-none"
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep('reason')}
                  disabled={step === 'submitting'}
                  className="flex-1 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold py-2.5 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={step === 'submitting'}
                  className="flex-1 rounded-full bg-red-600 text-white text-sm font-semibold py-2.5 hover:bg-red-700 disabled:opacity-50"
                >
                  {step === 'submitting' ? 'Submitting…' : 'Submit report'}
                </button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-2">
              <p className="text-sm text-gray-600 leading-relaxed">
                Thanks for letting us know.
                <br />
                Our team will review this report.
              </p>
              <button
                type="button"
                onClick={handleClose}
                className="mt-4 rounded-full bg-gray-900 text-white text-sm font-semibold px-6 py-2.5"
              >
                Done
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
