import { useState } from 'react'
import { getDocumentDownloadUrl, getDocumentStoragePath } from '../firebase/documentService.js'

/**
 * The ONE canonical document-opening hook — replaces
 * useOpenPostDocument.js (removed) and the Cloud-Function/signed-URL/
 * base64/blob chain it grew into across three rounds of live-deployed
 * failures. Now it's just: resolve a real download URL via the client
 * Storage SDK (authorization enforced by Storage rules at the moment
 * of the call, not pre-computed server-side) and open it.
 */
export function useOpenDocument() {
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')

  const openDocument = async (post) => {
    const file = post?.file
    if (!file) return
    setError('')

    // Legacy compatibility: any post whose file object already carries
    // a real, directly-usable URL (written before the access-controlled,
    // path-only system existed) opens exactly as it always has — no
    // Storage call needed for those.
    if (file.url) {
      window.open(file.url, '_blank', 'noreferrer')
      return
    }

    const storagePath = getDocumentStoragePath(file)
    if (!storagePath) {
      setError('This document is no longer available.')
      return
    }

    // Opened synchronously, inside the click handler, before any async
    // work — calling window.open() only after an await is a known
    // trigger for Safari's (and some Chrome configurations') popup
    // blocker, since it's no longer directly attributable to the click
    // that triggered it.
    //
    // ROOT-CAUSE FIX for the duplicate-tab bug: this used to pass
    // 'noreferrer' here too. In every modern browser, 'noreferrer' in
    // window.open()'s features string ALSO implies 'noopener' — and
    // when that applies, window.open() returns null even though the
    // browser still physically opens the blank tab. So `tab` was
    // always null, `tab && !tab.closed` below was always false, and
    // the code fell into its own "popup was blocked" fallback and
    // opened a SECOND, genuinely separate tab for the real URL — while
    // the first blank tab (which did open, just with no JS handle to
    // it) was never touched again. Dropping 'noreferrer' here keeps a
    // real, usable reference, so the same tab gets navigated instead
    // of a second one being opened. The destination is our own Firebase
    // Storage bucket, not a third party, so there's no meaningful
    // privacy/security cost to sending a Referer header here.
    const tab = window.open('', '_blank')

    setOpening(true)
    try {
      const url = await getDocumentDownloadUrl(storagePath)
      if (tab && !tab.closed) {
        tab.location.href = url
      } else {
        // Popup was blocked despite the synchronous open attempt — fall
        // back to a direct window.open() now that a real URL exists.
        window.open(url, '_blank', 'noreferrer')
      }
    } catch (err) {
      tab?.close()
      console.error('[useOpenDocument] failed to open document', {
        storagePath,
        code: err?.code,
        message: err?.message
      })
      setError(
        err?.code === 'storage/unauthorized'
          ? "You don't have permission to view this document."
          : err?.code === 'storage/object-not-found'
            ? 'This document no longer exists.'
            : 'Could not open this document. Please try again.'
      )
    } finally {
      setOpening(false)
    }
  }

  return { openDocument, opening, error, clearError: () => setError('') }
}
