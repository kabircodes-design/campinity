import { collection, doc, serverTimestamp } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from './firebase.js'

/**
 * Campinity's ONE canonical post-document (PDF) system — replaces the
 * Cloud-Function/signed-URL/base64/blob chain that grew out of three
 * rounds of live-deployed failures: bucket().file().getSignedUrl()
 * throwing because Cloud Functions v2's default compute service
 * account has no IAM permission to sign a URL; the base64 data-URI
 * fallback then being unopenable because browsers refuse to navigate a
 * tab directly to a data: URL; and a stale/wrong stored contentType
 * then producing a blank render even after that was fixed with a
 * blob: URL. Every one of those failures lived in the DELIVERY
 * mechanism, not in access control — so this removes the delivery
 * mechanism entirely instead of patching it a fourth time: a
 * verified/owner user's own browser calls Storage's getDownloadURL()
 * directly, and Storage's OWN security rules (see storage.rules'
 * campusDocuments/ block) enforce authorization at that exact moment.
 * Nothing here ever writes a usable URL back onto the Firestore post
 * document — only the Storage path — so this doesn't reintroduce the
 * permanent-bearer-token bypass the old uploadPostDocument's comment
 * (postService.js, now removed) already warned about.
 */

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Storage object names accept almost any UTF-8 string; this only
// strips characters that would break the path structure itself
// (separators, control characters). The documentId folder below is
// what actually guarantees no collision — this is purely about
// keeping the object name well-formed, not about uniqueness.
function sanitizeStorageFilename(name) {
  const cleaned = (name || 'document.pdf').replace(/[/\\]/g, '_').replace(/[\x00-\x1f]/g, '').slice(0, 200)
  return cleaned || 'document.pdf'
}

/**
 * Uploads a post document into its own isolated Storage folder:
 * campusDocuments/{uid}/{documentId}/{safeFilename}. `documentId` is a
 * fresh, client-generated random id (the standard `doc(collection(db,
 * ...)).id` trick — no document is actually written to that path, it's
 * only used to mint a collision-proof id) that makes every upload's
 * folder unique regardless of filename, so two uploads named
 * "notes.pdf" by the same user never collide or overwrite each other.
 *
 * Returns clean, display-ready metadata — never a URL. The original
 * File.name is preserved byte-for-byte in `name`, completely separate
 * from the Storage path, so display code never has to reverse-engineer
 * a filename out of path plumbing.
 */
export async function uploadDocument(uid, file) {
  if (!file) throw new Error('No file selected.')
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new Error(`This file is too large — the limit is ${Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))}MB.`)
  }

  const documentId = doc(collection(db, 'posts')).id
  const storagePath = `campusDocuments/${uid}/${documentId}/${sanitizeStorageFilename(file.name)}`

  await uploadBytes(ref(storage, storagePath), file, { contentType: 'application/pdf' })

  return {
    documentId,
    name: file.name,
    storagePath,
    contentType: 'application/pdf',
    size: formatFileSize(file.size),
    uploadedBy: uid,
    uploadedAt: serverTimestamp()
  }
}

/**
 * The one place that resolves a post's `file` object into an actual
 * Storage path, regardless of which era it was uploaded in:
 * `storagePath` (new campusDocuments/ uploads, this file) or `path`
 * (every post uploaded through the previous postDocuments/ system,
 * still live in existing data and still readable — see storage.rules'
 * postDocuments/ block, left unchanged).
 */
export function getDocumentStoragePath(file) {
  return file?.storagePath || file?.path || null
}

/**
 * Resolves a Storage path into a real, directly-openable download URL,
 * fetched fresh on demand every time a document is opened. This is the
 * ENTIRE opening mechanism — no Cloud Function, no signed URL, no
 * base64, no blob conversion. Authorization is enforced by Storage's
 * own security rules at the moment of this exact call: an unauthorized
 * caller gets a `storage/unauthorized` error before any URL is ever
 * produced, the same guarantee the old server-side check provided,
 * just enforced at the point of access instead of pre-computed. A real
 * https:// URL opens natively in the browser's own PDF viewer — no
 * MIME-type or encoding concerns, since there is no data: URI or
 * blob: URL anywhere in this path.
 */
export async function getDocumentDownloadUrl(storagePath) {
  return getDownloadURL(ref(storage, storagePath))
}
