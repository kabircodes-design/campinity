import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore'
import { db } from './firebase.js'

/**
 * Schema, already established by this project's real security rules
 * (users/{uid}/notifications/{notificationId} — allow create requires
 * actorUid == requester's own uid and actorUid != uid; read/update/
 * delete owner-only; update restricted to the `read` field). Document
 * shape below is new — the rules constrain WHO can write, not what
 * fields exist — designed to avoid a lookup on render (actor name/
 * avatar are denormalized onto the notification itself, same pattern
 * this project already uses elsewhere, e.g. posts storing an `author`
 * object instead of just a uid).
 *
 * {
 *   actorUid: string,
 *   actorName: string,
 *   actorAvatar: string,
 *   type: 'like' | 'comment' | 'follow' | 'announcement',
 *   postId?: string,          // like / comment
 *   commentPreview?: string,  // comment (first ~80 chars)
 *   communityId?: string,     // announcement
 *   communityName?: string,   // announcement
 *   message?: string,         // announcement body
 *   read: boolean,
 *   createdAt: serverTimestamp
 * }
 *
 * getUnreadNotificationCount(uid) keeps its existing signature/return
 * shape (a plain number) — HomePage.jsx already calls this exact
 * function; this is a compatible implementation of it, not a breaking
 * change to that call site. subscribeToUnreadCount is NEW — a
 * real-time equivalent HomePage.jsx isn't using yet (still doing a
 * single one-time fetch on mount), which is the actual gap between
 * "there's a bell icon with a dot" and "real-time notification badge"
 * this phase asks for. Swapping HomePage.jsx onto it is a real,
 * separate edit — done below, after this file.
 */

function notificationsCollection(uid) {
  return collection(db, 'users', uid, 'notifications')
}

async function createNotification(targetUid, data) {
  // No self-notifications — mirrors the security rule's own
  // actorUid != uid requirement, checked client-side too so a caller
  // gets a clear no-op instead of a rules rejection for the common
  // case (e.g. liking your own post).
  if (data.actorUid === targetUid) return null

  const notifRef = doc(notificationsCollection(targetUid))
  await setDoc(notifRef, {
    ...data,
    read: false,
    createdAt: serverTimestamp()
  })
  return notifRef.id
}

export async function createLikeNotification({ postOwnerUid, actorUid, actorName, actorAvatar, postId }) {
  return createNotification(postOwnerUid, {
    actorUid,
    actorName: actorName || 'Someone',
    actorAvatar: actorAvatar || '',
    type: 'like',
    postId
  })
}

export async function createCommentNotification({
  postOwnerUid,
  actorUid,
  actorName,
  actorAvatar,
  postId,
  commentText
}) {
  return createNotification(postOwnerUid, {
    actorUid,
    actorName: actorName || 'Someone',
    actorAvatar: actorAvatar || '',
    type: 'comment',
    postId,
    commentPreview: (commentText || '').slice(0, 80)
  })
}

/**
 * Four distinct creators below — per this task's explicit requirement
 * that each notification type have its own icon/title/message instead
 * of every comment-related event reusing createCommentNotification.
 * All follow createNotification's existing shape/pattern exactly (own
 * `type` value, own field set) rather than introducing a new one.
 */

export async function createReplyNotification({
  targetUid,
  actorUid,
  actorName,
  actorAvatar,
  postId,
  commentId,
  replyText
}) {
  return createNotification(targetUid, {
    actorUid,
    actorName: actorName || 'Someone',
    actorAvatar: actorAvatar || '',
    type: 'reply',
    postId,
    commentId,
    commentPreview: (replyText || '').slice(0, 80)
  })
}

export async function createCommentLikeNotification({
  targetUid,
  actorUid,
  actorName,
  actorAvatar,
  postId,
  commentId
}) {
  return createNotification(targetUid, {
    actorUid,
    actorName: actorName || 'Someone',
    actorAvatar: actorAvatar || '',
    type: 'comment_like',
    postId,
    commentId
  })
}

export async function createMentionNotification({
  targetUid,
  actorUid,
  actorName,
  actorAvatar,
  postId,
  commentId,
  commentText
}) {
  return createNotification(targetUid, {
    actorUid,
    actorName: actorName || 'Someone',
    actorAvatar: actorAvatar || '',
    type: 'mention',
    postId,
    commentId,
    commentPreview: (commentText || '').slice(0, 80)
  })
}

export async function createPinNotification({
  targetUid,
  actorUid,
  actorName,
  actorAvatar,
  postId,
  commentId
}) {
  return createNotification(targetUid, {
    actorUid,
    actorName: actorName || 'The post creator',
    actorAvatar: actorAvatar || '',
    type: 'pin',
    postId,
    commentId
  })
}

/**
 * Gamification — badge/level-up notifications. actorUid is the same
 * user being notified (a badge is "awarded by the system," not by
 * another person) — same shape every other creator here uses, just
 * with no distinct actor.
 */
export async function createBadgeNotification({ targetUid, badgeId, badgeLabel, badgeEmoji }) {
  return createNotification(targetUid, {
    actorUid: targetUid,
    actorName: 'Campinity',
    actorAvatar: '',
    type: 'badge',
    badgeId,
    badgeLabel,
    badgeEmoji
  })
}

export async function createLevelUpNotification({ targetUid, newLevel, levelTitle }) {
  return createNotification(targetUid, {
    actorUid: targetUid,
    actorName: 'Campinity',
    actorAvatar: '',
    type: 'level_up',
    newLevel,
    levelTitle
  })
}

/**
 * Sharing System (Phase 1) — one new notification type, same pattern
 * as every creator above. `entityType`/`entityId` cover all share
 * targets generically ("Kabir shared your post" / "Rahul shared your
 * profile" / "Aman shared your event") rather than one function per
 * shareable type, matching this whole system's "future types need
 * almost zero new code" principle.
 */
export async function createShareNotification({
  targetUid,
  actorUid,
  actorName,
  actorAvatar,
  entityType,
  entityId
}) {
  return createNotification(targetUid, {
    actorUid,
    actorName: actorName || 'Someone',
    actorAvatar: actorAvatar || '',
    type: 'share',
    entityType,
    entityId
  })
}

export async function createFollowNotification({ targetUid, actorUid, actorName, actorAvatar }) {
  return createNotification(targetUid, {
    actorUid,
    actorName: actorName || 'Someone',
    actorAvatar: actorAvatar || '',
    type: 'follow'
  })
}

/**
 * Community announcements — fans out to every member. Uses
 * communityService.js's getMembers (already built) to enumerate
 * recipients, batched at 450 writes per Firestore batch (well under
 * the 500 hard limit) since a large community could exceed a single
 * batch. Caller is responsible for checking the actor is actually an
 * owner/admin of the community before calling this — same pattern
 * this project already uses (e.g. communityService.js's
 * updateCommunityDetails checks permission itself rather than trusting
 * the caller, so this probably should too long-term; flagged rather
 * than silently assumed, kept simple for this pass since Phase 1 only
 * asks for the notification to fire, not a full permissions redesign
 * of who may trigger it).
 */
export async function createCommunityAnnouncementNotifications({
  communityId,
  communityName,
  actorUid,
  actorName,
  actorAvatar,
  message
}) {
  // Dynamic import here (not a top-level one) is deliberate, unlike
  // the firestore/storage imports elsewhere in this project which
  // should always be static: this avoids a circular-import risk if
  // communityService.js ever needs to import FROM
  // notificationService.js in the future (e.g. to send a notification
  // as part of some community action) — a static import at the top of
  // this file would create that cycle immediately, a dynamic one
  // inside just this one function doesn't.
  const { getMembers } = await import('./communityService.js')
  const { members } = await getMembers(communityId, { pageSize: 500 })

  const recipients = members.map((m) => m.uid).filter((uid) => uid !== actorUid)

  for (let i = 0; i < recipients.length; i += 450) {
    const batch = writeBatch(db)
    recipients.slice(i, i + 450).forEach((uid) => {
      const notifRef = doc(notificationsCollection(uid))
      batch.set(notifRef, {
        actorUid,
        actorName: actorName || 'Someone',
        actorAvatar: actorAvatar || '',
        type: 'announcement',
        communityId,
        communityName,
        message: (message || '').slice(0, 280),
        read: false,
        createdAt: serverTimestamp()
      })
    })
    await batch.commit()
  }
}

export async function getUnreadNotificationCount(uid) {
  if (!uid) return 0
  const snap = await getDocs(query(notificationsCollection(uid), where('read', '==', false)))
  return snap.size
}

/** Real-time equivalent of getUnreadNotificationCount — see this file's own docstring for why HomePage.jsx should move onto this. */
export function subscribeToUnreadCount(uid, callback) {
  if (!uid) {
    callback(0)
    return () => {}
  }
  const unreadQuery = query(notificationsCollection(uid), where('read', '==', false))
  return onSnapshot(unreadQuery, (snap) => callback(snap.size))
}

export async function getNotifications(uid, { pageSize = 20, cursor = null } = {}) {
  const constraints = [orderBy('createdAt', 'desc'), limit(pageSize)]
  if (cursor) constraints.push(startAfter(cursor))
  const snap = await getDocs(query(notificationsCollection(uid), ...constraints))
  return {
    notifications: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    nextCursor: snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null
  }
}

/** Real-time feed for the actual Notifications page (NotificationsPage.jsx — I don't have this file; see this feature's chat summary for what to wire in). */
export function subscribeToNotifications(uid, { pageSize = 30 } = {}, callback) {
  if (!uid) {
    callback([])
    return () => {}
  }
  const feedQuery = query(notificationsCollection(uid), orderBy('createdAt', 'desc'), limit(pageSize))
  return onSnapshot(feedQuery, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function markNotificationRead(uid, notificationId) {
  const notifRef = doc(db, 'users', uid, 'notifications', notificationId)
  const snap = await getDoc(notifRef)
  if (!snap.exists() || snap.data().read) return
  await updateDoc(notifRef, { read: true })
}

/**
 * Was missing — NotificationsPage.jsx imports this (reported runtime
 * error: "does not provide an export named 'deleteNotification'").
 * Same (uid, notificationId) signature as markNotificationRead right
 * above, for consistency. Security rule already permits this
 * (`allow delete: if isOwner(uid)` on users/{uid}/notifications/{id}),
 * no rules change needed — this was purely a missing service function.
 */
export async function deleteNotification(uid, notificationId) {
  await deleteDoc(doc(db, 'users', uid, 'notifications', notificationId))
}

export async function markAllNotificationsRead(uid) {
  const snap = await getDocs(query(notificationsCollection(uid), where('read', '==', false)))
  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = writeBatch(db)
    snap.docs.slice(i, i + 450).forEach((d) => batch.update(d.ref, { read: true }))
    await batch.commit()
  }
}
