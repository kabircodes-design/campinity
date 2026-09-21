/**
 * The single place every post-attachment renderer gets its display
 * filename from. CreatePostPage/uploadPostDocument store a clean,
 * separate `file.name` (the original File.name) distinct from
 * `file.path` (the internal Storage location) for every upload made
 * through today's code — but a real-world report showed an internal
 * path being displayed as a "filename," on an OLDER post. That means
 * `file.name` itself was bad DATA on that legacy record (written by
 * whatever code created it, before today's clean separation existed),
 * not a display bug in today's renderers — this function defends
 * against that by never trusting `file.name` blindly, even when it's
 * present: if it LOOKS like an internal path (contains a `/`, or
 * starts with the `{timestamp}-` prefix uploadPostDocument/
 * uploadPostImage prepend internally), it's cleaned exactly like a
 * missing-name fallback would be, instead of being shown verbatim.
 */
function looksLikeInternalPath(value) {
  return value.includes('/') || /^\d{6,}-/.test(value)
}

function cleanPathLikeString(raw) {
  const withoutQuery = raw.split('?')[0]
  const lastSegment = withoutQuery.split('/').pop() || ''
  // Strips the `{timestamp}-` prefix uploadPostDocument/uploadPostImage
  // prepend to avoid Storage-path collisions — internal plumbing, never
  // something a user typed or should see.
  const withoutTimestampPrefix = lastSegment.replace(/^\d{6,}-/, '')

  try {
    return decodeURIComponent(withoutTimestampPrefix)
  } catch {
    return withoutTimestampPrefix
  }
}

export function getDisplayFileName(file) {
  if (!file) return ''

  // `storagePath` covers new campusDocuments/ uploads (documentService.js);
  // `path`/`url` cover every historical shape this app has ever written.
  const raw = file.name || file.storagePath || file.path || file.url || ''
  if (!raw) return ''

  if (!looksLikeInternalPath(raw)) return raw

  return cleanPathLikeString(raw) || 'Document.pdf'
}
