import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, FileWarning, Minus, Plus, RotateCw, X, ZoomIn } from 'lucide-react'
import { callAdmin } from '../services/adminCallable.js'

const REJECTION_REASONS = ['Certificate could not be verified', 'Document unclear', "Information doesn't match", 'Duplicate submission', 'Other']

/**
 * Review screen for one achievement submission — copies
 * VerificationReviewModal.jsx's exact layout/interaction shell (image
 * viewer left, details+decision right, lazy-fetched-once-opened
 * preview, keyboard nav) since this is the same category of "review one
 * private uploaded document" work. The one real difference: a
 * certificate can be a PDF, not only an image — adminGetVerificationDocumentUrl
 * (reused unchanged) returns a base64 data URI whose mime prefix tells
 * us which viewer to render.
 */
export default function AchievementReviewModal({
  sessionToken,
  submission,
  index,
  total,
  onClose,
  onPrev,
  onNext,
  onApprove,
  onReject,
  busy,
  readOnly
}) {
  const [fileUrl, setFileUrl] = useState(null)
  const [fileLoading, setFileLoading] = useState(true)
  const [fileError, setFileError] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const isPdf = fileUrl?.startsWith('data:application/pdf')

  const loadFile = () => {
    if (!submission?.documentPath) return
    setFileLoading(true)
    setFileError(false)
    setFileUrl(null)
    callAdmin('adminGetVerificationDocumentUrl', { sessionToken, documentPath: submission.documentPath })
      .then((data) => setFileUrl(data?.url || null))
      .catch(() => setFileError(true))
      .finally(() => setFileLoading(false))
  }

  useEffect(() => {
    setZoom(1)
    setRotation(0)
    setRejecting(false)
    setRejectReason('')
    loadFile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission?.documentPath])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && onPrev) onPrev()
      else if (e.key === 'ArrowRight' && onNext) onNext()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, onPrev, onNext])

  if (!submission) return null

  const zoomIn = () => setZoom((z) => Math.min(3, z + 0.5))
  const zoomOut = () => setZoom((z) => Math.max(1, z - 0.5))
  const resetView = () => {
    setZoom(1)
    setRotation(0)
  }
  const rotate = () => setRotation((r) => (r + 90) % 360)

  const STATUS_STYLES = {
    pending: 'bg-amber-50 text-amber-600',
    approved: 'bg-emerald-50 text-emerald-600',
    rejected: 'bg-red-50 text-red-600'
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-3 sm:p-6">
      <div className="relative w-full max-w-5xl h-full sm:h-[88vh] bg-white rounded-2xl overflow-hidden flex flex-col lg:flex-row">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors duration-150"
        >
          <X className="w-4.5 h-4.5" />
        </button>

        <div className="relative flex-1 min-h-[45%] lg:min-h-0 bg-gray-900 flex items-center justify-center overflow-hidden">
          {fileLoading ? (
            <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          ) : fileError || !fileUrl ? (
            <div className="text-center px-6">
              <FileWarning className="w-6 h-6 text-white/50 mx-auto" />
              <p className="mt-2 text-sm text-white/70">Unable to load this certificate.</p>
              <button
                type="button"
                onClick={loadFile}
                className="mt-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-2 transition-colors duration-150"
              >
                Retry
              </button>
            </div>
          ) : isPdf ? (
            <embed src={fileUrl} type="application/pdf" className="w-full h-full" />
          ) : (
            <img
              src={fileUrl}
              alt="Submitted achievement certificate"
              onError={() => setFileError(true)}
              className="max-w-full max-h-full object-contain transition-transform duration-200 select-none"
              style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
              draggable={false}
            />
          )}

          {!fileLoading && !fileError && fileUrl && !isPdf && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-black/50 backdrop-blur px-1.5 py-1.5">
              <button type="button" onClick={zoomOut} aria-label="Zoom out" className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/15 transition-colors duration-150">
                <Minus className="w-4 h-4" />
              </button>
              <button type="button" onClick={resetView} aria-label="Fit to screen" className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/15 transition-colors duration-150">
                <ZoomIn className="w-4 h-4" />
              </button>
              <button type="button" onClick={zoomIn} aria-label="Zoom in" className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/15 transition-colors duration-150">
                <Plus className="w-4 h-4" />
              </button>
              <button type="button" onClick={rotate} aria-label="Rotate" className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/15 transition-colors duration-150">
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          )}

          {onPrev && (
            <button
              type="button"
              onClick={onPrev}
              aria-label="Previous submission"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors duration-150"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              aria-label="Next submission"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors duration-150"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="w-full lg:w-[320px] flex-shrink-0 border-t lg:border-t-0 lg:border-l border-gray-100 p-5 overflow-y-auto">
          {typeof index === 'number' && total > 1 && (
            <p className="text-[11px] font-semibold text-gray-400 mb-3">Submission {index + 1} of {total}</p>
          )}
          <p className="text-base font-bold text-gray-900">{submission.displayName}</p>
          {submission.username && <p className="text-sm text-gray-400">@{submission.username}</p>}

          <div className="mt-4 space-y-2.5">
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Achievement</p>
              <p className="text-sm text-gray-900">{submission.title}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Issued by</p>
              <p className="text-sm text-gray-900">{submission.issuer}</p>
            </div>
            {submission.collegeName && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">College</p>
                <p className="text-sm text-gray-900">{submission.collegeName}</p>
              </div>
            )}
            <div className="flex gap-4">
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Category</p>
                <p className="text-sm text-gray-900">{submission.category}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Year</p>
                <p className="text-sm text-gray-900">{submission.year}</p>
              </div>
            </div>
            {submission.description && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Description</p>
                <p className="text-sm text-gray-700">{submission.description}</p>
              </div>
            )}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Status</p>
              <span className={`inline-block mt-0.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[submission.status] || STATUS_STYLES.pending}`}>
                {submission.status}
              </span>
            </div>
            {submission.rejectionReason && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Rejection reason</p>
                <p className="text-sm text-gray-700">{submission.rejectionReason}</p>
              </div>
            )}
          </div>

          {!readOnly && (
            rejecting ? (
              <div className="mt-6">
                <p className="text-xs font-semibold text-gray-500 mb-2">Reason (optional)</p>
                <div className="flex flex-wrap gap-1.5">
                  {REJECTION_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRejectReason(r)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 ${
                        rejectReason === r ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                {rejectReason === 'Other' && (
                  <textarea
                    autoFocus
                    rows={2}
                    maxLength={200}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Describe the reason..."
                    className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs text-gray-900 outline-none focus:bg-white focus:border-blue-400 transition-all duration-200 resize-none"
                  />
                )}
                <div className="mt-3 flex items-center gap-2">
                  <button type="button" onClick={() => setRejecting(false)} className="flex-1 rounded-full border border-gray-200 text-gray-600 text-xs font-semibold py-2">
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onReject(rejectReason)}
                    className="flex-1 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-2 disabled:opacity-50 transition-all duration-200"
                  >
                    {busy ? 'Working…' : 'Confirm Reject'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onApprove}
                  className="flex-1 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 disabled:opacity-50 transition-all duration-200"
                >
                  {busy ? 'Working…' : 'Approve'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRejecting(true)}
                  className="flex-1 rounded-full border border-gray-200 text-gray-600 hover:border-gray-300 text-sm font-semibold py-2.5 disabled:opacity-50 transition-all duration-200"
                >
                  Reject
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
