import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCw, X, ZoomIn } from 'lucide-react'
import { callAdmin } from '../services/adminCallable.js'

const REJECTION_REASONS = ['Image unclear', 'ID does not match', 'Invalid document', 'Information incomplete', 'Other']

/**
 * The full review screen for one verification request — image viewer
 * (left/main) + user details + Approve/Reject (right), per the brief's
 * exact layout. Replaces the previous `window.open(url, '_blank')`,
 * which sent the admin out of the panel entirely to look at a document.
 *
 * The signed document URL (adminGetVerificationDocumentUrl, already
 * existed) is fetched lazily here — once per request actually opened,
 * never prefetched for the whole queue — matching the brief's explicit
 * "do not preload every verification image" performance requirement.
 */
export default function VerificationReviewModal({
  sessionToken,
  request,
  index,
  total,
  onClose,
  onPrev,
  onNext,
  onApprove,
  onReject,
  busy
}) {
  const [imageUrl, setImageUrl] = useState(null)
  const [imageLoading, setImageLoading] = useState(true)
  const [imageError, setImageError] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const loadImage = () => {
    if (!request?.documentPath) return
    setImageLoading(true)
    setImageError(false)
    setImageUrl(null)
    callAdmin('adminGetVerificationDocumentUrl', { sessionToken, documentPath: request.documentPath })
      .then((data) => setImageUrl(data?.url || null))
      .catch(() => setImageError(true))
      .finally(() => setImageLoading(false))
  }

  useEffect(() => {
    setZoom(1)
    setRotation(0)
    setRejecting(false)
    setRejectReason('')
    loadImage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.documentPath])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && onPrev) onPrev()
      else if (e.key === 'ArrowRight' && onNext) onNext()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, onPrev, onNext])

  if (!request) return null

  const zoomIn = () => setZoom((z) => Math.min(3, z + 0.5))
  const zoomOut = () => setZoom((z) => Math.max(1, z - 0.5))
  const resetView = () => {
    setZoom(1)
    setRotation(0)
  }
  const rotate = () => setRotation((r) => (r + 90) % 360)

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

        {/* MAIN — image viewer, per the brief's "large image preview / zoom / fit-to-screen / rotate" spec */}
        <div className="relative flex-1 min-h-[45%] lg:min-h-0 bg-gray-900 flex items-center justify-center overflow-hidden">
          {imageLoading ? (
            <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          ) : imageError || !imageUrl ? (
            <div className="text-center px-6">
              <p className="text-sm text-white/70">Unable to load verification image.</p>
              <button
                type="button"
                onClick={loadImage}
                className="mt-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-2 transition-colors duration-150"
              >
                Retry
              </button>
            </div>
          ) : (
            <img
              src={imageUrl}
              alt="Submitted verification document"
              onError={() => setImageError(true)}
              className="max-w-full max-h-full object-contain transition-transform duration-200 select-none"
              style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
              draggable={false}
            />
          )}

          {!imageLoading && !imageError && imageUrl && (
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
              aria-label="Previous request"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors duration-150"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              aria-label="Next request"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors duration-150"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* DETAILS + ACTIONS */}
        <div className="w-full lg:w-[320px] flex-shrink-0 border-t lg:border-t-0 lg:border-l border-gray-100 p-5 overflow-y-auto">
          {typeof index === 'number' && total > 1 && (
            <p className="text-[11px] font-semibold text-gray-400 mb-3">Request {index + 1} of {total}</p>
          )}
          <p className="text-base font-bold text-gray-900">{request.displayName}</p>
          {request.username && <p className="text-sm text-gray-400">@{request.username}</p>}

          <div className="mt-4 space-y-2.5">
            {request.collegeName && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">College</p>
                <p className="text-sm text-gray-900">{request.collegeName}</p>
              </div>
            )}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Verification method</p>
              <p className="text-sm text-gray-900">College ID document</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Status</p>
              <span className="inline-block mt-0.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-600">Pending</span>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">UID</p>
              <p className="text-[11px] text-gray-300 break-all">{request.uid}</p>
            </div>
          </div>

          {rejecting ? (
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
                <button
                  type="button"
                  onClick={() => setRejecting(false)}
                  className="flex-1 rounded-full border border-gray-200 text-gray-600 text-xs font-semibold py-2"
                >
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
          )}
        </div>
      </div>
    </div>
  )
}
