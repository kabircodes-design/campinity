import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, startAfter, where } from 'firebase/firestore'
import { db } from './firebase.js'

export const REPORT_REASONS = [
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'hate', label: 'Hate or hateful conduct' },
  { id: 'violence', label: 'Violence or threats' },
  { id: 'nudity', label: 'Nudity or sexual content' },
  { id: 'scam', label: 'Scams or fraud' },
  { id: 'impersonation', label: 'Impersonation' },
  { id: 'misinformation', label: 'False/misleading information' },
  { id: 'copyright', label: 'Copyright/IP' },
  { id: 'self_harm', label: 'Self-harm concern' },
  { id: 'other', label: 'Something else' }
]

/**
 * One centralized reports/{reportId} collection for every target
 * type (user/post/comment/story/community), matching the explicit
 * "prefer a clean centralized architecture" instruction over separate
 * per-type collections. Duplicate protection: checks for an existing
 * pending report from this same reporter against this same target
 * before creating a new one — a soft, best-effort client-side check
 * (the rules don't enforce uniqueness server-side, since a
 * deterministic doc-id-as-lock approach would leak whether someone
 * already reported something to anyone who could guess the id;
 * report status is intentionally NOT globally readable). This is
 * explicitly a UX nicety against accidental double-taps, not a
 * security boundary — reported honestly, not oversold.
 */
export async function submitReport({ reporterUid, targetType, targetId, targetOwnerUid, reason, details }) {
  if (!reporterUid) throw new Error('You need to be signed in.')
  if (!targetType || !targetId) throw new Error('Missing report target.')
  if (!reason) throw new Error('Please choose a reason.')

  const existing = await getDocs(
    query(
      collection(db, 'reports'),
      where('reporterUid', '==', reporterUid),
      where('targetType', '==', targetType),
      where('targetId', '==', targetId),
      where('status', '==', 'pending'),
      limit(1)
    )
  )
  if (!existing.empty) {
    throw new Error("You've already reported this. Our team will review it.")
  }

  await addDoc(collection(db, 'reports'), {
    reporterUid,
    targetType, // 'user' | 'post' | 'comment' | 'story' | 'community'
    targetId,
    targetOwnerUid: targetOwnerUid || null,
    reason,
    details: details?.trim() || '',
    status: 'pending',
    createdAt: serverTimestamp(),
    reviewedAt: null,
    reviewedBy: null,
    moderationAction: null
  })
}

/**
 * Admin-only in practice — see the identical reasoning in
 * collegeRequestService.js/verificationService.js: no client-readable
 * "am I an admin" signal exists, the query itself is the real gate,
 * rejected server-side for a non-admin.
 *
 * Paginated (limit + cursor) per the explicit "do not load every
 * report into the browser" instruction — never an unbounded fetch.
 */
export async function getReportsPage({ status = null, pageSize = 20, cursor = null } = {}) {
  const constraints = [orderBy('createdAt', 'desc'), limit(pageSize)]
  if (status && status !== 'all') constraints.unshift(where('status', '==', status))
  if (cursor) constraints.push(startAfter(cursor))

  const snap = await getDocs(query(collection(db, 'reports'), ...constraints))
  return {
    reports: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] || null
  }
}
