import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from './firebase.js'

const USERS_COLLECTION = 'users'
const NOTIFICATIONS_SUBCOLLECTION = 'notifications'

const AVATAR_COLORS = [
  'from-blue-500 to-blue-600',
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-pink-500 to-rose-500',
  'from-amber-500 to-orange-500',
  'from-indigo-500 to-blue-600'
]

function getInitials(name = '') {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

function getAvatarColor(seed = '') {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % AVATAR_COLORS.length
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

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

export async function getNotifications(uid, maxResults = 50) {
  const notificationsQuery = query(
    collection(db, USERS_COLLECTION, uid, NOTIFICATIONS_SUBCOLLECTION),
    orderBy('createdAt', 'desc'),
    limit(maxResults)
  )
  const snap = await getDocs(notificationsQuery)
  return snap.docs.map(mapNotification)
}

export async function getUnreadNotificationCount(uid) {
  const unreadQuery = query(
    collection(db, USERS_COLLECTION, uid, NOTIFICATIONS_SUBCOLLECTION),
    where('read', '==', false)
  )
  const snap = await getDocs(unreadQuery)
  return snap.size
}

export async function markNotificationRead(uid, notificationId) {
  await updateDoc(doc(db, USERS_COLLECTION, uid, NOTIFICATIONS_SUBCOLLECTION, notificationId), { read: true })
}

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

export async function deleteNotification(uid, notificationId) {
  await deleteDoc(doc(db, USERS_COLLECTION, uid, NOTIFICATIONS_SUBCOLLECTION, notificationId))
}