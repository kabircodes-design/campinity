import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore'
import { db } from './firebase.js'
import { checkIsFollowing } from './profileService.js'
import { SHARE_TYPE_LABELS } from '../sharing/shareTypes.js'
import { awardXP, hasReachedDailyCap } from '../gamification/xpService.js'

/**
 * Correctly named this time — MessagesPage.jsx and ChatPage.jsx
 * (pasted just now) both confirm the real file is chatService.js, not
 * messageService.js, which I built one turn ago without having either
 * page to check against and have now deleted. Same underlying schema
 * as that deleted file (it was built correctly against
 * firestore.rules, just under the wrong name) — this version is also
 * shaped to match the REAL contracts those two pages actually call:
 * subscribeToUserChats(uid, onData, onError) delivering chats with an
 * `otherUid` convenience field attached (MessagesPage.jsx reads
 * chat.otherUid directly, so this function computes and attaches it,
 * rather than making every caller re-derive it from `participants`).
 *
 * Schema (from firestore.rules, confirmed, unchanged from last pass):
 * chats/{chatId} — doc id "{uidA}_{uidB}" sorted, participants: [uid,
 * uid], status: 'pending'|'accepted', requestedBy, pinnedBy/mutedBy/
 * archivedBy: [uid], lastMessage, lastMessageAt.
 * chats/{chatId}/messages/{messageId} — senderId, text, read, edited,
 * editedAt, deletedFor: [uid], createdAt.
 */

function chatDocId(uidA, uidB) {
  return [uidA, uidB].sort().join('_')
}

function chatDoc(chatId) {
  return doc(db, 'chats', chatId)
}

function messagesCollection(chatId) {
  return collection(db, 'chats', chatId, 'messages')
}

function otherParticipant(participants, uid, type) {
  if (type === 'group') return null // "the other participant" isn't a meaningful concept for a group — every caller checks type === 'group' before relying on otherUid anyway
  return participants.find((id) => id !== uid) || null
}

/**
 * Real-time inbox — accepted chats only (pending requests are a
 * separate surface, subscribeToMessageRequests below), each chat
 * annotated with `otherUid` since that's what MessagesPage.jsx reads
 * directly without any intermediate resolution step.
 */
export function subscribeToUserChats(uid, onData, onError) {
  const chatsQuery = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', uid),
    where('status', '==', 'accepted'),
    orderBy('lastMessageAt', 'desc')
  )
  return onSnapshot(
    chatsQuery,
    (snap) => {
      const chats = snap.docs.map((d) => {
        const data = d.data()
        return { id: d.id, ...data, otherUid: otherParticipant(data.participants, uid, data.type) }
      })
      onData(chats)
    },
    (err) => onError?.(err)
  )
}

/** Resolves a single chat's metadata + the other participant's uid — what useChat.js needs. */
export async function getChat(chatId, uid) {
  const snap = await getDoc(chatDoc(chatId))
  if (!snap.exists()) return null
  const data = snap.data()
  return { id: chatId, ...data, otherUid: otherParticipant(data.participants, uid, data.type) }
}

export function subscribeToChat(chatId, uid, onData, onError) {
  return onSnapshot(
    chatDoc(chatId),
    (snap) => {
      if (!snap.exists()) {
        onData(null)
        return
      }
      const data = snap.data()
      onData({ id: chatId, ...data, otherUid: otherParticipant(data.participants, uid, data.type) })
    },
    (err) => onError?.(err)
  )
}

/**
 * Decides request vs. direct-inbox: per the brief, "if two users don't
 * follow each other OR have never chatted before" -> request. Either
 * direction of follow is enough to skip the request step.
 */
async function shouldStartAsRequest(uidA, uidB) {
  const [aFollowsB, bFollowsA] = await Promise.all([checkIsFollowing(uidA, uidB), checkIsFollowing(uidB, uidA)])
  return !aFollowsB && !bFollowsA
}

/** Gets an existing chat or creates one, deciding pending/accepted. Returns { chatId, status, isNew }. */
export async function getOrCreateChat(currentUid, otherUid) {
  if (!currentUid || !otherUid) throw new Error('Both participants are required.')
  if (currentUid === otherUid) throw new Error("You can't message yourself.")

  const chatId = chatDocId(currentUid, otherUid)
  const existingSnap = await getDoc(chatDoc(chatId))
  if (existingSnap.exists()) {
    return { chatId, status: existingSnap.data().status, isNew: false }
  }

  const startAsRequest = await shouldStartAsRequest(currentUid, otherUid)
  const status = startAsRequest ? 'pending' : 'accepted'

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(chatDoc(chatId))
    if (snap.exists()) return
    transaction.set(chatDoc(chatId), {
      participants: [currentUid, otherUid],
      status,
      requestedBy: status === 'pending' ? currentUid : null,
      pendingMessageCount: 0,
      pinnedBy: [],
      mutedBy: [],
      archivedBy: [],
      lastMessage: '',
      lastMessageAt: serverTimestamp(),
      lastSenderId: null,
      readBy: [currentUid, otherUid],
      createdAt: serverTimestamp()
    })
  })

  return { chatId, status, isNew: true }
}

const PENDING_MESSAGE_LIMIT = 3 // configurable — how many messages the requester can send before the receiver accepts

/**
 * Extended for the Sharing System (Phase 1) — the 4th `options`
 * parameter is entirely optional and defaults to plain-text behavior,
 * so every existing call site (sendMessage(chatId, senderId, text))
 * is completely unaffected; this is the same function, not a new one,
 * per "reuse existing sendMessage(), do not duplicate logic."
 */
export async function sendMessage(chatId, senderId, text, options = {}) {
  const { type = 'text', imageUrl = null, sharedPayload = null } = options

  if (!senderId) throw new Error('You need to be signed in to send a message.')
  if (type === 'text' && !text?.trim()) throw new Error('Message cannot be empty.')

  const newMessageRef = doc(messagesCollection(chatId))

  await runTransaction(db, async (transaction) => {
    const chatSnap = await transaction.get(chatDoc(chatId))
    if (!chatSnap.exists()) throw new Error('This conversation no longer exists.')
    const chatData = chatSnap.data()

    if (chatData.status === 'pending') {
      if (chatData.requestedBy !== senderId) {
        throw new Error('Accept this request before replying.')
      }
      const sentCount = chatData.pendingMessageCount || 0
      if (sentCount >= PENDING_MESSAGE_LIMIT) {
        throw new Error(`You can only send ${PENDING_MESSAGE_LIMIT} messages until this request is accepted.`)
      }
    }

    const messageDoc = {
      senderId,
      text: text?.trim() || '',
      type,
      read: false,
      edited: false,
      editedAt: null,
      deletedFor: [],
      createdAt: serverTimestamp()
    }
    if (imageUrl) messageDoc.imageUrl = imageUrl
    if (sharedPayload) messageDoc.sharedPayload = sharedPayload

    transaction.set(newMessageRef, messageDoc)

    // Last-message preview in the chat list reflects the share, not
    // raw payload data — "Shared a post" reads correctly in the inbox
    // instead of an empty string or a JSON blob.
    const lastMessagePreview =
      type === 'text' ? text.trim().slice(0, 120) : sharedPayload?.preview?.title ? `Shared: ${sharedPayload.preview.title}` : SHARE_TYPE_LABELS[type] || 'Sent a message'

    const chatUpdate = {
      lastMessage: lastMessagePreview,
      lastMessageAt: serverTimestamp(),
      lastSenderId: senderId,
      readBy: [senderId]
    }
    if (chatData.status === 'pending') {
      chatUpdate.pendingMessageCount = (chatData.pendingMessageCount || 0) + 1
    }
    transaction.update(chatDoc(chatId), chatUpdate)
  })

  // Gamification — daily-capped (20/day) since messages have no
  // natural per-source dedup key the way a like/comment/save does
  // (each is tied to one specific post; a message isn't tied to
  // anything that would make "the same message twice" a meaningful
  // concept to dedupe against). Sending never blocks on this — only
  // XP stops accruing once the cap is hit for the day.
  const dailyCapped = await hasReachedDailyCap(senderId, 'message_sent', 20).catch(() => true)
  if (!dailyCapped) {
    await awardXP(senderId, 'message_sent', {}).catch(() => {})
  }

  return newMessageRef.id
}

/* ============================================================
   MESSAGE REQUESTS
   ============================================================ */

export function subscribeToMessageRequests(uid, callback) {
  const requestsQuery = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', uid),
    where('status', '==', 'pending')
  )
  return onSnapshot(requestsQuery, (snap) => {
    const requests = snap.docs
      .map((d) => {
        const data = d.data()
        return { id: d.id, ...data, otherUid: otherParticipant(data.participants, uid, data.type) }
      })
      .filter((chat) => chat.requestedBy !== uid)
    callback(requests)
  })
}

/**
 * The missing half of subscribeToMessageRequests — that function
 * shows requests RECEIVED (explicitly filters out the caller's own
 * requestedBy). This shows requests the current user SENT, which
 * previously had no subscription anywhere — the actual root cause of
 * "inbox stays empty for a chat I'm actively messaging in": a pending
 * chat where I'm the requester was invisible to every list view,
 * only reachable by already knowing its chatId directly. Same query
 * shape as subscribeToMessageRequests, opposite filter.
 */
export function subscribeToSentPendingChats(uid, callback) {
  const sentQuery = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', uid),
    where('status', '==', 'pending')
  )
  return onSnapshot(sentQuery, (snap) => {
    const sent = snap.docs
      .map((d) => {
        const data = d.data()
        return { id: d.id, ...data, otherUid: otherParticipant(data.participants, uid, data.type) }
      })
      .filter((chat) => chat.requestedBy === uid)
    callback(sent)
  })
}

export async function acceptMessageRequest(chatId, receiverUid) {
  const snap = await getDoc(chatDoc(chatId))
  if (!snap.exists()) throw new Error('This request no longer exists.')
  if (snap.data().requestedBy === receiverUid) {
    throw new Error('Only the recipient can accept a message request.')
  }
  await updateDoc(chatDoc(chatId), { status: 'accepted' })
}

/** Real delete — "sender isn't notified" per the brief, deliberately no notification call. */
export async function deleteMessageRequest(chatId) {
  const messagesSnap = await getDocs(collection(db, 'chats', chatId, 'messages'))
  const batch = writeBatch(db)
  messagesSnap.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(chatDoc(chatId))
  await batch.commit()
}

/* ============================================================
   CHAT LIST ACTIONS
   ============================================================ */

async function toggleParticipantArrayField(chatId, uid, field) {
  const snap = await getDoc(chatDoc(chatId))
  if (!snap.exists()) return
  const current = snap.data()[field] || []
  await updateDoc(chatDoc(chatId), { [field]: current.includes(uid) ? arrayRemove(uid) : arrayUnion(uid) })
}

export const togglePinChat = (chatId, uid) => toggleParticipantArrayField(chatId, uid, 'pinnedBy')
export const toggleMuteChat = (chatId, uid) => toggleParticipantArrayField(chatId, uid, 'mutedBy')
export const toggleArchiveChat = (chatId, uid) => toggleParticipantArrayField(chatId, uid, 'archivedBy')

export async function deleteChat(chatId) {
  const messagesSnap = await getDocs(collection(db, 'chats', chatId, 'messages'))
  const batch = writeBatch(db)
  messagesSnap.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(chatDoc(chatId))
  await batch.commit()
}

/* ============================================================
   MESSAGES WITHIN A CHAT
   ============================================================ */

export function subscribeToMessages(chatId, callback, { pageSize = 50 } = {}) {
  const messagesQuery = query(messagesCollection(chatId), orderBy('createdAt', 'desc'), limit(pageSize))
  return onSnapshot(messagesQuery, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse())
  })
}

export async function getOlderMessages(chatId, cursor, { pageSize = 50 } = {}) {
  const messagesQuery = query(messagesCollection(chatId), orderBy('createdAt', 'desc'), startAfter(cursor), limit(pageSize))
  const snap = await getDocs(messagesQuery)
  return {
    messages: snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse(),
    nextCursor: snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null
  }
}

export async function markChatRead(chatId, uid) {
  const snap = await getDocs(query(messagesCollection(chatId), where('read', '==', false)))
  const batch = writeBatch(db)
  let touched = false
  snap.docs.forEach((d) => {
    if (d.data().senderId !== uid) {
      batch.update(d.ref, { read: true })
      touched = true
    }
  })
  if (touched) await batch.commit()

  const chatSnap = await getDoc(chatDoc(chatId))
  if (chatSnap.exists() && !(chatSnap.data().readBy || []).includes(uid)) {
    await updateDoc(chatDoc(chatId), { readBy: arrayUnion(uid) })
  }
}

export async function editMessage(chatId, messageId, senderId, newText) {
  const messageRef = doc(db, 'chats', chatId, 'messages', messageId)
  const snap = await getDoc(messageRef)
  if (!snap.exists()) throw new Error('This message no longer exists.')
  if (snap.data().senderId !== senderId) throw new Error('You can only edit your own messages.')
  if (!newText?.trim()) throw new Error('Message cannot be empty.')
  await updateDoc(messageRef, { text: newText.trim(), edited: true, editedAt: serverTimestamp() })
}

export async function deleteMessageForMe(chatId, messageId, uid) {
  await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), { deletedFor: arrayUnion(uid) })
}

export async function deleteMessageForEveryone(chatId, messageId, senderId) {
  const messageRef = doc(db, 'chats', chatId, 'messages', messageId)
  const snap = await getDoc(messageRef)
  if (!snap.exists()) return
  if (snap.data().senderId !== senderId) throw new Error('You can only delete your own messages for everyone.')
  await deleteDoc(messageRef)
}

/* ============================================================
   GROUP CHATS — extends the existing chats/{chatId} collection
   rather than a separate system. type: 'group' (existing 1-to-1
   chats have no type field at all — treated as 'direct' via a
   fallback wherever type is read, so nothing about them changes).
   Doc id is auto-generated (unlike 1-to-1's deterministic sorted-uid
   id, which only works for exactly two participants). status is
   always 'accepted' — there's no request/accept concept for group
   membership, matching the rules written for this.
   ============================================================ */

const MIN_GROUP_MEMBERS = 3 // creator + at least 2 others, matches the rules' participants.size() >= 3

export async function createGroupChat(creatorUid, memberUids, groupName, groupAvatar = '') {
  if (!creatorUid) throw new Error('You need to be signed in to create a group.')
  if (!groupName?.trim()) throw new Error('Give your group a name.')

  const participants = Array.from(new Set([creatorUid, ...memberUids]))
  if (participants.length < MIN_GROUP_MEMBERS) {
    throw new Error(`Select at least ${MIN_GROUP_MEMBERS - 1} other members to create a group.`)
  }

  const chatRef = doc(collection(db, 'chats'))
  await setDoc(chatRef, {
    type: 'group',
    participants,
    admins: [creatorUid],
    createdBy: creatorUid,
    groupName: groupName.trim(),
    groupAvatar,
    pinnedBy: [],
    mutedBy: [],
    archivedBy: [],
    lastMessage: '',
    lastMessageAt: serverTimestamp(),
    lastSenderId: null,
    readBy: participants,
    status: 'accepted',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })

  return chatRef.id
}

/** Admin-only, matching the rules' admin-gated membership branch exactly. */
export async function addGroupMembers(chatId, requesterUid, newMemberUids) {
  const snap = await getDoc(chatDoc(chatId))
  if (!snap.exists()) throw new Error('This group no longer exists.')
  const data = snap.data()
  if (!(data.admins || []).includes(requesterUid)) {
    throw new Error('Only group admins can add members.')
  }
  const nextParticipants = Array.from(new Set([...data.participants, ...newMemberUids]))
  await updateDoc(chatDoc(chatId), { participants: nextParticipants, updatedAt: serverTimestamp() })
}

/** Admin-only — a member cannot remove another member themselves, matching "cannot arbitrarily remove others." */
export async function removeGroupMember(chatId, requesterUid, memberToRemoveUid) {
  const snap = await getDoc(chatDoc(chatId))
  if (!snap.exists()) throw new Error('This group no longer exists.')
  const data = snap.data()
  if (!(data.admins || []).includes(requesterUid)) {
    throw new Error('Only group admins can remove members.')
  }
  if (memberToRemoveUid === requesterUid) {
    throw new Error('Use Leave Group to remove yourself.')
  }
  const nextParticipants = data.participants.filter((uid) => uid !== memberToRemoveUid)
  const nextAdmins = (data.admins || []).filter((uid) => uid !== memberToRemoveUid)
  await updateDoc(chatDoc(chatId), { participants: nextParticipants, admins: nextAdmins, updatedAt: serverTimestamp() })
}

/** Self-removal only — matches the rules' narrowly-scoped leave branch (participants must equal old list minus exactly the requester's own uid). */
export async function leaveGroup(chatId, uid) {
  const snap = await getDoc(chatDoc(chatId))
  if (!snap.exists()) return
  const data = snap.data()
  const nextParticipants = data.participants.filter((id) => id !== uid)
  await updateDoc(chatDoc(chatId), { participants: nextParticipants, updatedAt: serverTimestamp() })
}

/** Admin-only, per "creator/admin permissions must be enforced server-side" — the rules independently verify this too, this is the client-side check that fails fast with a clear message before the write attempt. */
export async function updateGroupInfo(chatId, requesterUid, { groupName, groupAvatar }) {
  const snap = await getDoc(chatDoc(chatId))
  if (!snap.exists()) throw new Error('This group no longer exists.')
  const data = snap.data()
  if (!(data.admins || []).includes(requesterUid)) {
    throw new Error('Only group admins can edit group info.')
  }
  const update = { updatedAt: serverTimestamp() }
  if (groupName !== undefined) update.groupName = groupName.trim()
  if (groupAvatar !== undefined) update.groupAvatar = groupAvatar
  await updateDoc(chatDoc(chatId), update)
}

export async function promoteToGroupAdmin(chatId, requesterUid, targetUid) {
  const snap = await getDoc(chatDoc(chatId))
  if (!snap.exists()) throw new Error('This group no longer exists.')
  const data = snap.data()
  if (!(data.admins || []).includes(requesterUid)) throw new Error('Only group admins can promote members.')
  if (!data.participants.includes(targetUid)) throw new Error('That person is not a member of this group.')
  await updateDoc(chatDoc(chatId), { admins: Array.from(new Set([...(data.admins || []), targetUid])), updatedAt: serverTimestamp() })
}
