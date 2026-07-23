import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from './firebase.js'
import { getAvatarColor, getInitials } from './postService.js'

const USERS_COLLECTION = 'users'
const NOTIFICATIONS_SUBCOLLECTION = 'notifications'

function formatTimeAgo(timestamp) {
  if (!timestamp?.toDate) return 'Just now'
  const diffMs = Date.now() - timestamp.toDate().getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

const ACTION_TEXT = {
  follow: 'started following you.',
  like: 'liked your post.',
  comment: 'commented on your post.'
}

function targetLinkFor(raw) {
  if (raw.type === 'follow') return `/student/${raw.actorUsername}`
  if (raw.type === 'like' || raw.type === 'comment') return `/post/${raw.targetId}`
  return null
}

/**
 * Maps a Firestore users/{uid}/notifications/{id} document into the
 * exact shape the existing, untouched NotificationCard.jsx and
 * NotificationIcon.jsx already expect (actorName, actorInitials,
 * actorColorClass, text, time, targetLink, read) — the ONLY translation
 * layer between Firestore's schema and the existing UI, same pattern as
 * postService.js's mapPostDoc.
 */
function mapNotification(docSnap) {
  const raw = { id: docSnap.id, ...docSnap.data() }
  const actorLabel = raw.actorDisplayName || raw.actorUsername || 'Someone'

  return {
    id: raw.id,
    type: raw.type,
    actorName: actorLabel,
    actorInitials: getInitials(actorLabel),
    actorColorClass: getAvatarColor(raw.actorUid || raw.id),
    text: ACTION_TEXT[raw.type] || '',
    time: formatTimeAgo(raw.createdAt),
    read: raw.read === true,
    targetLink: targetLinkFor(raw)
  }
}

/**
 * Loads a user's notifications, newest first.
 */
export async function getNotifications(uid, maxResults = 50) {
  const notificationsQuery = query(
    collection(db, USERS_COLLECTION, uid, NOTIFICATIONS_SUBCOLLECTION),
    orderBy('createdAt', 'desc'),
    limit(maxResults)
  )
  const snap = await getDocs(notificationsQuery)
  return snap.docs.map(mapNotification)
}

/**
 * Returns just the unread count — used for the Home header's bell
 * badge. A dedicated equality-filtered query rather than fetching every
 * notification and counting client-side, to keep the read cheap.
 */
export async function getUnreadNotificationCount(uid) {
  const unreadQuery = query(
    collection(db, USERS_COLLECTION, uid, NOTIFICATIONS_SUBCOLLECTION),
    where('read', '==', false)
  )
  const snap = await getDocs(unreadQuery)
  return snap.size
}

/** Marks a single notification as read. */
export async function markNotificationRead(uid, notificationId) {
  await updateDoc(doc(db, USERS_COLLECTION, uid, NOTIFICATIONS_SUBCOLLECTION, notificationId), { read: true })
}

/** Marks every unread notification as read in one batch. */
export async function markAllNotificationsRead(uid) {
  const unreadQuery = query(
    collection(db, USERS_COLLECTION, uid, NOTIFICATIONS_SUBCOLLECTION),
    where('read', '==', false)
  )
  const snap = await getDocs(unreadQuery)
  if (snap.empty) return

  const batch = writeBatch(db)
  snap.docs.forEach((docSnap) => batch.update(docSnap.ref, { read: true }))
  await batch.commit()
}

/** Deletes a single notification. */
export async function deleteNotification(uid, notificationId) {
  await deleteDoc(doc(db, USERS_COLLECTION, uid, NOTIFICATIONS_SUBCOLLECTION, notificationId))
}