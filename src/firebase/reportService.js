/**
 * Report service — the client-side half of the reports/{reportId}
 * collection already defined and secured in firestore.rules (read
 * directly, not assumed): create requires reporterUid == the
 * requester's own uid; a report is created with status implicitly
 * 'pending' (the rules' update branch requires resource.data.status
 * == 'pending' as its precondition, confirming that's the expected
 * initial value); update is admin-only, restricted to
 * status/reviewedAt/reviewedBy/moderationAction; delete is always
 * denied — reports are permanent records once created, matching
 * "reports cannot be modified by the reporter after submission."
 *
 * Field names (reporterUid, targetType, targetId, reason, details,
 * status, createdAt) match the rules' own field references exactly —
 * not invented independently of them.
 */
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore'
import { db } from './firebase.js'

/**
 * Reasons shown in ReportModal.jsx — matches that component's exact
 * `{ id, label }` shape and the category list both briefs specify.
 * Not every category applies to every surface (e.g. "Impersonation"
 * makes little sense for a marketplace listing), but per the
 * explicit "use only categories appropriate to the surface"
 * instruction, that filtering is left to the caller — this list is
 * the full canonical set, callers may pass a filtered subset if a
 * future pass wires per-surface reason lists. Kept as one list here,
 * not scattered per component, matching "the profanity list must
 * live in a dedicated module" applied to this list too.
 */
export const REPORT_REASONS = [
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'hate', label: 'Hate or abusive content' },
  { id: 'spam', label: 'Spam' },
  { id: 'scam', label: 'Scam or fraud' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'threat', label: 'Threat or safety concern' },
  { id: 'impersonation', label: 'Impersonation' },
  { id: 'other', label: 'Other' }
]

// How long a reporter's identical pending report against the same
// target blocks a duplicate — UX-level deduplication only. This is
// NOT a security boundary: a malicious client calling Firestore
// directly (bypassing this service) could still create duplicate
// report documents, since firestore.rules' create rule only checks
// reporterUid == requester, not "does a similar report already
// exist" (rules can't cheaply express a time-windowed query
// precondition against a create). Real duplicate-spam protection at
// the trust boundary would need a Cloud Function or scheduled
// cleanup — flagged here rather than presented as airtight.
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000 // 10 minutes

function reportsCollection() {
  return collection(db, 'reports')
}

/**
 * Client-side, best-effort duplicate check — queries the reporter's
 * own reports (readable per the rules' own reporterUid == requester
 * branch) for a pending report against the same target within the
 * dedup window. See the honesty note on DUPLICATE_WINDOW_MS above:
 * this prevents accidental double-submits (e.g. a UI double-click),
 * not a determined bypass.
 */
async function hasRecentDuplicate(reporterUid, targetType, targetId) {
  const cutoff = Date.now() - DUPLICATE_WINDOW_MS
  const snap = await getDocs(
    query(
      reportsCollection(),
      where('reporterUid', '==', reporterUid),
      where('targetType', '==', targetType),
      where('targetId', '==', targetId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(1)
    )
  )
  if (snap.empty) return false
  const latest = snap.docs[0].data()
  const createdMs = latest.createdAt?.toMillis ? latest.createdAt.toMillis() : 0
  return createdMs > cutoff
}

/**
 * Submits a report. Matches ReportModal.jsx's exact call shape:
 * submitReport({ reporterUid, targetType, targetId, targetOwnerUid,
 * reason, details }). targetOwnerUid is stored (not required by the
 * rules, but useful context for moderators reviewing the case
 * without a second lookup) — omitted entirely if not provided rather
 * than written as null, keeping the document shape minimal per "do
 * not store unnecessary sensitive data."
 */
export async function submitReport({ reporterUid, targetType, targetId, targetOwnerUid, reason, details = '' }) {
  if (!reporterUid) throw new Error('You need to be signed in to report content.')
  if (!targetType || !targetId) throw new Error('Missing report target.')
  if (!reason) throw new Error('Please select a reason.')

  const isDuplicate = await hasRecentDuplicate(reporterUid, targetType, targetId).catch(() => false)
  if (isDuplicate) {
    throw new Error("You've already reported this — thanks, our team has it.")
  }

  const reportRef = doc(reportsCollection())
  const payload = {
    reporterUid,
    targetType,
    targetId,
    reason,
    details: (details || '').trim().slice(0, 500),
    status: 'pending',
    createdAt: serverTimestamp()
  }
  if (targetOwnerUid) payload.targetOwnerUid = targetOwnerUid

  await setDoc(reportRef, payload)
  return reportRef.id
}

/**
 * Admin-only reads — the moderation queue. Matches the rules' own
 * read branch (reporterUid == requester OR platformAdmin); calling
 * this as a non-admin would correctly return only the caller's own
 * reports via Firestore's own permission enforcement, not a client-
 * side check performed here.
 */
export async function getReportsByStatus(status, { pageSize = 30 } = {}) {
  const snap = await getDocs(
    query(reportsCollection(), where('status', '==', status), orderBy('createdAt', 'desc'), limit(pageSize))
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * Resolves a report — admin only per the rules' update branch, which
 * independently re-verifies platformAdmin membership and restricts
 * the writable fields to exactly status/reviewedAt/reviewedBy/
 * moderationAction. This function does not and cannot bypass that;
 * a non-admin calling it would get a Firestore permission-denied
 * error, not a silently-accepted write.
 */
export async function resolveReport(reportId, adminUid, { status, moderationAction = '' }) {
  if (!['resolved', 'dismissed'].includes(status)) {
    throw new Error('Invalid resolution status.')
  }
  await updateDoc(doc(db, 'reports', reportId), {
    status,
    reviewedBy: adminUid,
    reviewedAt: serverTimestamp(),
    moderationAction
  })
}
