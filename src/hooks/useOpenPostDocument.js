import { useState } from 'react'
import { getVerifiedPostDocumentUrl } from '../firebase/postService.js'

/**
 * ROOT-CAUSE FIX #2, found only after a real deployed test still failed
 * for brand-new PDFs with "Could not open this document": the Cloud
 * Function fix (see getVerifiedPostDocumentUrl's own comment in
 * functions/functions/index.js — the getSignedUrl()/IAM signBlob
 * failure) now returns a base64 `data:` URI instead of a signed HTTPS
 * URL. A `data:` URI CANNOT simply be handed to `window.open()` —
 * modern browsers (Chrome since ~2018, and most others since) block
 * top-level navigation to a `data:` URL as an anti-phishing measure
 * (this restriction does NOT apply to using a data URI as an <embed>/
 * <img> `src`, only to navigating a window/tab directly to one). The
 * fix: convert the base64 payload into a real `Blob` and open a
 * `blob:` object URL instead — `blob:` URLs are NOT subject to that
 * restriction and open exactly like a normal file in the browser's own
 * native PDF viewer.
 *
 * Also opens a blank tab SYNCHRONOUSLY, before the async Cloud Function
 * round-trip, and redirects it once the real URL is ready — calling
 * `window.open()` itself only after an `await` is a well-known trigger
 * for Safari's (and some Chrome configurations') popup blocker, since
 * it's no longer seen as directly caused by the user's click. If the
 * synchronous open was blocked anyway (returns null), this falls back
 * to a direct `window.open()` once the blob URL exists — the same
 * behavior this hook already had before this fix, not a regression.
 */
function base64ToBlob(base64, contentType) {
  const byteChars = atob(base64)
  const byteNumbers = new Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
  return new Blob([new Uint8Array(byteNumbers)], { type: contentType })
}

/**
 * `postId`-only diagnostics (never document content) — exactly what
 * Part 1 of the "blank white page" investigation asked to be able to
 * see: whether the response actually looked like a data URI, how long
 * the base64 payload was, and the real decoded Blob size/type once
 * built. Logged unconditionally via console.log (not gated behind a
 * dev flag) since this hook has no existing env-check convention to
 * reuse and this is diagnostic metadata, not sensitive content.
 */
function toOpenableUrl(url, postId) {
  const match = /^data:([^;]+);base64,(.*)$/.exec(url || '')
  if (!match) {
    console.log('[useOpenPostDocument] non-data-URI response, opening directly', { postId, urlPrefix: (url || '').slice(0, 24) })
    return url // a real https:// URL (legacy file.url posts) — nothing to convert
  }
  const [, contentType, base64Data] = match
  const blob = base64ToBlob(base64Data, contentType)
  const objectUrl = URL.createObjectURL(blob)
  console.log('[useOpenPostDocument] built blob URL', {
    postId,
    declaredContentType: contentType,
    base64Length: base64Data.length,
    blobSize: blob.size,
    blobType: blob.type,
    objectUrlCreated: Boolean(objectUrl)
  })
  return objectUrl
}

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

    // Opened now, synchronously, so it's still directly attributable to
    // the click that called openDocument() — see file header comment.
    const preOpenedTab = window.open('', '_blank', 'noreferrer')

    setOpening(true)
    try {
      const rawUrl = await getVerifiedPostDocumentUrl(post.id)
      console.log('[useOpenPostDocument] callable response received', {
        postId: post.id,
        responseType: typeof rawUrl,
        responseLength: typeof rawUrl === 'string' ? rawUrl.length : null
      })
      if (!rawUrl) {
        preOpenedTab?.close()
        return
      }
      const openableUrl = toOpenableUrl(rawUrl, post.id)
      if (preOpenedTab && !preOpenedTab.closed) {
        preOpenedTab.location.href = openableUrl
      } else {
        window.open(openableUrl, '_blank', 'noreferrer')
      }
    } catch (err) {
      preOpenedTab?.close()
      // Development-visible diagnostics — the user-facing `error` below
      // stays a clean, safe message (Firebase Callable errors' own
      // .message is already written to be user-presentable; see the
      // Cloud Function's own HttpsError messages), but this console log
      // tells a developer exactly which stage failed without needing to
      // separately check Cloud Functions logs.
      console.error('[useOpenPostDocument] failed to open document', {
        postId: post?.id,
        filePath: post?.file?.path,
        code: err?.code,
        message: err?.message,
        details: err?.details
      })
      setError(err?.message || 'Could not open this document. Please try again.')
    } finally {
      setOpening(false)
    }
  }

  return { openDocument, opening, error, clearError: () => setError('') }
}
