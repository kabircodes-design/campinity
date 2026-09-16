import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from './firebase.js'

/**
 * Read-only client service for announcements/{id} — every WRITE goes
 * through Cloud Functions (adminSendNotification/
 * adminSetAnnouncementPinned/adminDeleteAnnouncement in
 * functions/functions/index.js), matching firestore.rules' own
 * `allow write: if false` on this collection. This file only ever
 * reads.
 *
 * Two separate queries rather than one compound OR (Firestore has no
 * native OR across different field values without a second query):
 * college-scoped notices for the viewer's own campus, plus platform-
 * wide ones (collegeId == null) such as a Campinity-side notice not
 * tied to any specific college. Both are small, bounded reads.
 *
 * NOTE: each query combines an equality filter (collegeId) with an
 * orderBy on a different field (createdAt) — same situation
 * postService.js's getFeedPosts already documents: this requires a
 * Firestore composite index, auto-creatable via the console link
 * Firestore's own error provides the first time this runs for real.
 */
export async function getActiveAnnouncements(collegeId, { pageSize = 5 } = {}) {
  const now = new Date()

  const queries = [
    getDocs(query(collection(db, 'announcements'), where('collegeId', '==', null), orderBy('createdAt', 'desc'), limit(pageSize)))
  ]
  if (collegeId) {
    queries.push(
      getDocs(query(collection(db, 'announcements'), where('collegeId', '==', collegeId), orderBy('createdAt', 'desc'), limit(pageSize)))
    )
  }

  const snaps = await Promise.all(queries)
  const merged = new Map()
  snaps.forEach((snap) => {
    snap.docs.forEach((d) => {
      const data = d.data()
      const expiresAtMs = data.expiresAt?.toMillis ? data.expiresAt.toMillis() : null
      if (expiresAtMs && expiresAtMs < now.getTime()) return // expired — silently excluded, not shown then hidden
      merged.set(d.id, { id: d.id, ...data })
    })
  })

  // Pinned first, then newest — a stable sort since both queries above
  // already returned newest-first within themselves.
  return Array.from(merged.values())
    .sort((a, b) => (b.pinned === true) - (a.pinned === true))
    .slice(0, pageSize)
}

/**
 * Admin management view — unfiltered by college/expiry (the admin
 * needs to see and manage everything, not just what's currently
 * active for one viewer), newest first, bounded to a reasonable page.
 * Still read-only: pin/delete actions go through their own Cloud
 * Functions, this only lists.
 */
export async function listRecentAnnouncementsForAdmin({ pageSize = 30 } = {}) {
  const snap = await getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(pageSize)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
