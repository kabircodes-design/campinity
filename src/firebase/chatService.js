import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore'
import { db } from './firebase.js'

const CHATS_COLLECTION = 'chats'
const MESSAGES_SUBCOLLECTION = 'messages'

function chatDocId(uidA, uidB) {
  return [uidA, uidB].sort().join('_')
}

/**
 * Returns the deterministic chat id for two participants, creating the
 * chat document if it doesn't exist yet. The doc id itself (sorted
 * "{uidA}_{uidB}") is the uniqueness guarantee — never creates a
 * duplicate chat between the same two users. Idempotent: safe to call
 * on every visit to a chat, whether or not it already existed.
 */
export async function getOrCreateChat(currentUid, otherUid) {
  if (!currentUid || !otherUid || currentUid === otherUid) return null

  const chatId = chatDocId(currentUid, otherUid)
  const chatRef = doc(db, CHATS_COLLECTION, chatId)
  const snap = await getDoc(chatRef)

  if (!snap.exists()) {
    await setDoc(chatRef, {
      participants: [currentUid, otherUid].sort(),
      lastMessage: '',
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      unreadCounts: { [currentUid]: 0, [otherUid]: 0 }
    })
  }

  return chatId
}

/**
 * Realtime listener for the current user's chats. Deliberately queries
 * with array-contains ONLY (no orderBy) — combining array-contains with
 * an orderBy on a different field requires a Firestore composite index,
 * and a user's own chat list is small enough that sorting the already-
 * fetched snapshot client-side (by lastMessageAt, newest first) is both
 * index-free and effectively instant. Returns the unsubscribe function.
 *
 * Every chat document is mapped defensively: if a document is somehow
 * missing its participants (structurally incomplete), it's dropped
 * entirely rather than passed along as a partial object — this is what
 * prevents "Cannot read properties of undefined" crashes further down
 * the chain in MessagesPage.jsx / ChatCard.jsx.
 */
export function subscribeToUserChats(uid, callback, onError) {
  const chatsQuery = query(
    collection(db, CHATS_COLLECTION),
    where('participants', 'array-contains', uid),
    limit(50)
  )

  return onSnapshot(
    chatsQuery,
    (snap) => {
      const chats = snap.docs
        .map((docSnap) => {
          const data = docSnap.data() || {}
          const participants = Array.isArray(data.participants) ? data.participants : []
          if (participants.length === 0) return null // structurally incomplete doc — never rendered

          const otherUid = participants.find((id) => id !== uid) || null

          return {
            id: docSnap.id,
            otherUid,
            lastMessage: data.lastMessage || '',
            lastMessageAt: data.lastMessageAt || null,
            unreadCount: data.unreadCounts?.[uid] ?? 0
          }
        })
        .filter(Boolean)
        .sort((a, b) => {
          const aTime = a.lastMessageAt?.toMillis?.() ?? 0
          const bTime = b.lastMessageAt?.toMillis?.() ?? 0
          return bTime - aTime
        })
      callback(chats)
    },
    (err) => onError?.(err)
  )
}

/** Realtime listener for a single chat document. */
export function subscribeToChat(chatId, callback, onError) {
  return onSnapshot(
    doc(db, CHATS_COLLECTION, chatId),
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (err) => onError?.(err)
  )
}

/**
 * Realtime listener for a chat's messages, oldest first (chronological
 * display order). Single-field orderBy only — no composite index
 * needed.
 */
export function subscribeToMessages(chatId, callback, onError) {
  const messagesQuery = query(
    collection(db, CHATS_COLLECTION, chatId, MESSAGES_SUBCOLLECTION),
    orderBy('createdAt', 'asc'),
    limit(200)
  )

  return onSnapshot(
    messagesQuery,
    (snap) => callback(snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))),
    (err) => onError?.(err)
  )
}

/**
 * Sends a message: creates the message doc and updates the chat's
 * lastMessage/lastMessageAt plus the recipient's unread counter, in one
 * batch — so a reader of the chat list never sees a lastMessage without
 * a matching unread bump, or vice versa.
 */
export async function sendMessage(chatId, senderId, recipientId, text) {
  const trimmed = (text || '').trim()
  if (!trimmed || !chatId || !senderId || !recipientId) return

  const chatRef = doc(db, CHATS_COLLECTION, chatId)
  const messageRef = doc(collection(db, CHATS_COLLECTION, chatId, MESSAGES_SUBCOLLECTION))

  const batch = writeBatch(db)
  batch.set(messageRef, {
    senderId,
    text: trimmed,
    createdAt: serverTimestamp(),
    read: false
  })
  batch.set(
    chatRef,
    {
      lastMessage: trimmed,
      lastMessageAt: serverTimestamp(),
      [`unreadCounts.${recipientId}`]: increment(1)
    },
    { merge: true }
  )
  await batch.commit()
}

/**
 * Marks a chat as read for `uid`: resets their unread counter and marks
 * any unread messages from `otherUid` as read. Uses two equality
 * filters (read == false, senderId == otherUid) rather than a `!=`
 * filter, specifically to avoid the composite index a not-equal
 * comparison combined with another filter would require — two equality
 * filters on different fields need no composite index.
 */
export async function markChatRead(chatId, uid, otherUid) {
  const chatRef = doc(db, CHATS_COLLECTION, chatId)
  await updateDoc(chatRef, { [`unreadCounts.${uid}`]: 0 }).catch(() => {})

  if (!otherUid) return

  const unreadQuery = query(
    collection(db, CHATS_COLLECTION, chatId, MESSAGES_SUBCOLLECTION),
    where('read', '==', false),
    where('senderId', '==', otherUid)
  )
  const snap = await getDocs(unreadQuery).catch(() => null)
  if (!snap || snap.empty) return

  const batch = writeBatch(db)
  snap.docs.forEach((docSnap) => batch.update(docSnap.ref, { read: true }))
  await batch.commit()
}