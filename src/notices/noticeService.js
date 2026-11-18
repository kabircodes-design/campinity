import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore'
import { db } from '../firebase/firebase.js'

/**
 * Campinity Notice Board — client side (read-only + per-user read markers).
 *
 * Notices are written only by admin Cloud Functions (functions/notices.js).
 * Each delivery targets exactly one audience key: 'all', 'uid:<uid>' or
 * 'college:<collegeId>'. Firestore rules only return deliveries whose key
 * matches the caller, so we run (at most) three small, indexed queries —
 * never a scan of every notice.
 */
const PER_QUERY = 20
const PRIORITY_RANK = { urgent: 2, important: 1, normal: 0 }
const ms = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : typeof t === 'number' ? t : null)

export function audienceKeysFor({ uid, collegeId }) {
  return ['all', uid ? `uid:${uid}` : null, collegeId ? `college:${collegeId}` : null].filter(Boolean)
}

/** Deliveries store "never expires" as year 9999 (the read rule needs a value). */
const NEVER_EXPIRES_FROM_MS = Date.UTC(9000, 0, 1)

export function toNotice(id, d) {
  const expiresAtMs = ms(d.expiresAt)
  return {
    id,
    groupId: d.groupId || id,
    title: d.title || '',
    body: d.body || '',
    priority: d.priority || 'normal',
    pinned: d.pinned === true,
    imageUrl: d.imageUrl || null,
    actionUrl: d.actionUrl || null,
    actionLabel: d.actionLabel || null,
    publishAtMs: ms(d.publishAt),
    expiresAtMs: expiresAtMs && expiresAtMs < NEVER_EXPIRES_FROM_MS ? expiresAtMs : null,
    updatedAtMs: ms(d.updatedAt) || ms(d.publishAt)
  }
}

/** Pinned first, then by importance, then newest. Drops scheduled and expired notices. */
export function arrangeNotices(list, now = Date.now()) {
  const seen = new Set()
  return list
    .filter((n) => {
      if (seen.has(n.groupId)) return false
      seen.add(n.groupId)
      return (!n.publishAtMs || n.publishAtMs <= now) && (!n.expiresAtMs || n.expiresAtMs > now)
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || (b.publishAtMs || 0) - (a.publishAtMs || 0))
}

/**
 * Firestore rules only allow reading a delivery inside its [publishAt,
 * expiresAt) window, judged by the SERVER clock. A list query is allowed only
 * if its filters prove that for every result, so we ask for
 * publishAt <= now - margin and expiresAt > now + margin. The margin absorbs
 * device clock skew; if the device clock is off by more than that the query
 * is denied, and we retry once with a wider margin. (Cost: a notice appears
 * up to `margin` after its publish time and disappears up to `margin` early.)
 */
export const CLOCK_MARGINS_MS = [60 * 1000, 15 * 60 * 1000]

export function boardQuery(firestore, key, nowMs, marginMs) {
  return query(
    collection(firestore, 'notices'),
    where('audienceKeys', 'array-contains', key),
    where('publishAt', '<=', Timestamp.fromMillis(nowMs - marginMs)),
    where('expiresAt', '>', Timestamp.fromMillis(nowMs + marginMs)),
    orderBy('publishAt', 'desc'),
    limit(PER_QUERY)
  )
}

async function fetchForKey(key) {
  let lastError
  for (const margin of CLOCK_MARGINS_MS) {
    try {
      return await getDocs(boardQuery(db, key, Date.now(), margin))
    } catch (err) {
      lastError = err
      if (err?.code !== 'permission-denied') break
    }
  }
  throw lastError
}

export async function fetchMyNotices({ uid, collegeId }) {
  const settled = await Promise.allSettled(audienceKeysFor({ uid, collegeId }).map(fetchForKey))
  const ok = settled.filter((r) => r.status === 'fulfilled')
  // One audience failing (e.g. a campus changed mid-session) shouldn't blank the whole board.
  if (!ok.length) throw settled[0].reason
  return arrangeNotices(ok.flatMap((r) => r.value.docs.map((d) => toNotice(d.id, d.data()))))
}

/** groupId -> readAt (ms) for the signed-in user. */
export async function fetchNoticeReads(uid) {
  const snap = await getDocs(query(collection(db, 'users', uid, 'noticeReads'), limit(200)))
  const map = {}
  snap.docs.forEach((d) => {
    map[d.id] = ms(d.data().readAt) || Date.now()
  })
  return map
}

/** Unread = never opened, or edited by the admin since it was last read. */
export const isUnread = (notice, reads) => !reads[notice.groupId] || (notice.updatedAtMs && reads[notice.groupId] < notice.updatedAtMs)

export async function markNoticeRead(uid, groupId) {
  await setDoc(doc(db, 'users', uid, 'noticeReads', groupId), { readAt: serverTimestamp() })
}

/** In-app paths stay in the app; https links open externally. Anything else is ignored. */
export function noticeLinkTarget(url) {
  if (typeof url !== 'string') return null
  if (/^\/(?!\/)/.test(url)) return { type: 'internal', to: url }
  try {
    const u = new URL(url)
    return u.protocol === 'https:' ? { type: 'external', href: u.toString() } : null
  } catch {
    return null
  }
}
