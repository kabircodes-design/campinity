import { useState } from 'react'
import { getVerifiedPostDocumentUrl } from '../firebase/postService.js'

/**
 * Shared by every place that opens a post's attached document
 * (PostCard.jsx, PostDetailPage.jsx, NotesView.jsx, LastMinutePreview.jsx)
 * — one implementation of the legacy-vs-new resolution instead of four
 * copies of the same branch:
 *
 *  - Posts created BEFORE the verification-access-control PDF fix still
 *    have a stored `file.url` (a real, already-public Storage download
 *    URL — see postService.js's uploadPostDocument comment for why that
 *    was a bypass). That URL was already exposed the moment it was
 *    written; there is nothing left to re-gate for those specific
 *    existing documents, so it's opened directly. This is a stated,
 *    honest limitation, not something this pass can silently fix
 *    retroactively without re-uploading every existing PDF post.
 *  - Posts created AFTER the fix only have `file.path` — resolved into
 *    a real, short-lived, verification-checked URL via
 *    getVerifiedPostDocumentUrl (Cloud Function), never opened directly.
 *
 * Callers are still responsible for their own VerificationGate — this
 * hook does not check `verified` itself, since the real UI-gate call
 * site already knows that (see PostCard.jsx's own onClick for the
 * canonical pattern), and this hook's own async call is itself
 * independently rejected server-side for an unverified caller anyway.
 */
export function useOpenPostDocument() {
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')

  const openDocument = async (post) => {
    if (!post?.file) return
    setError('')

    if (post.file.url) {
      window.open(post.file.url, '_blank', 'noopener,noreferrer')
      return
    }

    if (!post.file.path) return
    setOpening(true)
    try {
      const url = await getVerifiedPostDocumentUrl(post.id)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err?.message || 'Could not open this document. Please try again.')
    } finally {
      setOpening(false)
    }
  }

  return { openDocument, opening, error, clearError: () => setError('') }
}
