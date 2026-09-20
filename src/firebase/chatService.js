import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore'
import { db, storage } from './firebase.js'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { checkIsFollowing, getUserProfile } from './profileService.js'
import { isBlockedByMe } from './blockService.js'
import { createMessageRequestNotification, createMessageRequestAcceptedNotification } from './notificationService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { SHARE_TYPE_LABELS } from '../sharing/shareTypes.js'
import { awardXP, hasReachedDailyCap } from '../gamification/xpService.js'
import { DAILY_CAPS } from '../gamification/config.js'

const DEBUG_CHAT_FLOW = import.meta.env.DEV

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
      const chats = snap.docs
        .map((d) => {
          const data = d.data()
          return { id: d.id, ...data, otherUid: otherParticipant(data.participants, uid, data.type) }
        })
        // Chats this user deleted (deleteChat below) stay excluded at the
        // data/subscription level, not hidden with local React state —
        // a stale listener or a page refresh can never resurrect one,
        // since the exclusion is re-applied on every single snapshot.
        .filter((chat) => !(chat.deletedFor || []).includes(uid))
      onData(chats)
    },
    (err) => onError?.(err)
  )
}

/**
 * ROOT CAUSE of "Messages icon has no unread indicator": nothing ever
 * computed this — BottomNav.jsx/DesktopSidebar.jsx already had a real
 * unread badge wired for Notifications (subscribeToUnreadCount in
 * notificationService.js), but Messages had no equivalent subscription
 * at all, on either mobile or desktop.
 *
 * Deliberately its own lightweight query, not a second listener wired
 * to the same full chat objects subscribeToUserChats already returns —
 * no orderBy (nothing here needs sorting), so it doesn't even need that
 * function's composite index, and it only ever emits a small integer,
 * never a chat array, keeping BottomNav/DesktopSidebar from having to
 * hold onto full chat data just to show a badge. The "is this chat
 * unread" check is byte-for-byte the same condition ChatCard.jsx's own
 * `isUnread` already uses (lastMessage exists, I'm not the last sender,
 * my uid isn't in readBy yet) — one real definition of "unread,"
 * reused, not reinvented here. A chat this user deleted-for-me is
 * excluded the same way subscribeToUserChats excludes it, so a hidden
 * conversation can never inflate the badge.
 */
export function subscribeToUnreadChatsCount(uid, onCount) {
  if (!uid) return () => {}
  const chatsQuery = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', uid),
    where('status', '==', 'accepted')
  )
  return onSnapshot(
    chatsQuery,
    (snap) => {
      let count = 0
      snap.docs.forEach((d) => {
        const data = d.data()
        if ((data.deletedFor || []).includes(uid)) return
        const isUnread = data.lastMessage && data.lastSenderId !== uid && !(data.readBy || []).includes(uid)
        if (isUnread) count += 1
      })
      onCount(count)
    },
    () => onCount(0)
  )
}

/**
 * Read-only lookup for the profile Message button's relationship state
 * (item 10 of the Message Request spec) — never creates anything, unlike
 * getOrCreateChat, since merely viewing a profile must never itself
 * start a request. Returns null when no chat exists yet at all.
 */
export async function getExistingChatStatus(currentUid, otherUid) {
  if (!currentUid || !otherUid) return null
  const chatId = chatDocId(currentUid, otherUid)
  if (DEBUG_CHAT_FLOW) console.debug('[CHAT ID] getExistingChatStatus', { currentUid, otherUid, chatId })
  const snap = await getDoc(chatDoc(chatId))
  if (!snap.exists()) {
    if (DEBUG_CHAT_FLOW) console.debug('[CHAT STATUS] no existing chat', { chatId })
    return null
  }
  const data = snap.data()
  if (DEBUG_CHAT_FLOW) console.debug('[CHAT STATUS] existing chat found', { chatId, status: data.status, requestedBy: data.requestedBy })
  return { chatId, status: data.status, requestedBy: data.requestedBy || null }
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

/**
 * Only checks the direction this client is actually allowed to read —
 * "have I blocked them." Whether THEY have blocked ME can only be
 * enforced server-side (firestore.rules' chatIsBlocked()): a user's own
 * blockedUsers subcollection is structurally unreadable by anyone else
 * (see blockService.js), so there is no client-side way to check that
 * direction without leaking block state to the blocked party, which is
 * exactly what that design deliberately prevents.
 */
async function assertNotBlockedByMe(currentUid, otherUid) {
  const blocked = await isBlockedByMe(currentUid, otherUid).catch(() => false)
  if (blocked) throw new Error("You've blocked this person. Unblock them to send a message.")
}

/**
 * "Who can message me" (Settings > Privacy) — real enforcement, not a
 * cosmetic toggle: when otherUid has restricted messages to people
 * they follow, a brand-new chat is refused outright before any
 * document is created. Client-side only, same disclosed limitation as
 * the follow-based pending/accepted decision just below (shouldStartAsRequest)
 * — proving "does X follow Y" server-side inside firestore.rules would
 * need to read the follows collection from within the chats rule,
 * more complexity than this pass takes on; noted, not hidden.
 */
async function assertMessagingAllowed(currentUid, otherUid) {
  const targetProfile = await getUserProfile(otherUid).catch(() => null)
  if (targetProfile?.messagePrivacy !== 'following') return
  const targetFollowsSender = await checkIsFollowing(otherUid, currentUid).catch(() => false)
  if (!targetFollowsSender) {
    throw new Error('This person only accepts messages from people they follow.')
  }
}

/** Gets an existing chat or creates one, deciding pending/accepted. Returns { chatId, status, isNew }. */
export async function getOrCreateChat(currentUid, otherUid) {
  if (!currentUid || !otherUid) throw new Error('Both participants are required.')
  if (currentUid === otherUid) throw new Error("You can't message yourself.")

  const chatId = chatDocId(currentUid, otherUid)
  if (DEBUG_CHAT_FLOW) console.debug('[CHAT FLOW] getOrCreateChat start', { currentUid, otherUid })
  if (DEBUG_CHAT_FLOW) console.debug('[CHAT ID] resolved', { chatId })

  const existingSnap = await getDoc(chatDoc(chatId))
  if (existingSnap.exists()) {
    const existingData = existingSnap.data()
    if (DEBUG_CHAT_FLOW) console.debug('[CHAT STATUS] reusing existing chat (Case 1/4)', { chatId, status: existingData.status, requestedBy: existingData.requestedBy, participants: existingData.participants, pendingMessageCount: existingData.pendingMessageCount })
    return { chatId, status: existingData.status, isNew: false }
  }
  if (DEBUG_CHAT_FLOW) console.debug('[CHAT STATUS] no existing chat — will create', { chatId })

  await assertNotBlockedByMe(currentUid, otherUid)
  await assertMessagingAllowed(currentUid, otherUid)

  const startAsRequest = await shouldStartAsRequest(currentUid, otherUid)
  const status = startAsRequest ? 'pending' : 'accepted'
  if (DEBUG_CHAT_FLOW) console.debug('[CHAT REQUEST] follow-based decision', { chatId, startAsRequest, status })

  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(chatDoc(chatId))
      if (snap.exists()) {
        if (DEBUG_CHAT_FLOW) console.debug('[CHAT CREATE] doc appeared mid-transaction (concurrent creation) — skipping create', { chatId })
        return
      }
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
    if (DEBUG_CHAT_FLOW) console.debug('[CHAT CREATE] transaction committed', { chatId, status })
  } catch (err) {
    console.error('[CHAT CREATE] transaction failed', { chatId, code: err?.code, message: err?.message })
    // The one case a client-side check can't catch: the OTHER user has
    // blocked ME. firestore.rules' chatIsBlocked() rejects the create
    // with permission-denied — surfaced as a generic message, never
    // "they've blocked you," matching blockService.js's own stated
    // privacy requirement that a blocked user must never be able to
    // detect the block.
    if (err?.code === 'permission-denied') {
      throw new Error("You can't message this person right now.")
    }
    throw err
  }

  // Real request notification — fire-and-forget, never blocks the
  // sender's own send/navigate flow on a notification write succeeding.
  if (status === 'pending') {
    getUserProfile(currentUid)
      .then((actorProfile) =>
        createMessageRequestNotification({
          targetUid: otherUid,
          actorUid: currentUid,
          actorName: actorProfile?.displayName || 'Someone',
          actorAvatar: getProfileIdentityImage(actorProfile) || '',
          actorUsername: actorProfile?.username || '',
          chatId
        })
      )
      .catch(() => {})
  }

  if (DEBUG_CHAT_FLOW) console.debug('[CHAT FLOW] getOrCreateChat done', { chatId, status, isNew: true })
  return { chatId, status, isNew: true }
}

const PENDING_MESSAGE_LIMIT = 1 // Instagram-style: exactly one message allowed while a request is pending

/**
 * Extended for the Sharing System (Phase 1) — the 4th `options`
 * parameter is entirely optional and defaults to plain-text behavior,
 * so every existing call site (sendMessage(chatId, senderId, text))
 * is completely unaffected; this is the same function, not a new one,
 * per "reuse existing sendMessage(), do not duplicate logic."
 */
function formatCallPreview(callType, callOutcome, callDurationSec) {
  const icon = callType === 'video' ? '📹' : '📞'
  const label = callType === 'video' ? 'Video call' : 'Voice call'
  if (callOutcome === 'missed') return `${icon} Missed ${label.toLowerCase()}`
  if (callOutcome === 'declined') return `${icon} Declined ${label.toLowerCase()}`
  const m = Math.floor((callDurationSec || 0) / 60)
  const s = (callDurationSec || 0) % 60
  return `${icon} ${label} · ${m}:${String(s).padStart(2, '0')}`
}

export async function sendMessage(chatId, senderId, text, options = {}) {
  const {
    type = 'text',
    imageUrl = null,
    sharedPayload = null,
    fileUrl = null,
    fileName = null,
    fileSize = null,
    mimeType = null,
    durationSec = null,
    callType = null,
    callDurationSec = null,
    callOutcome = null,
    replyTo = null
  } = options

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
      reactions: {},
      createdAt: serverTimestamp()
    }
    // Denormalized snapshot, not a live reference — built by the caller
    // from the message being replied to (see useMessages.js). This is
    // deliberate: if the original message is later hard-deleted
    // (deleteMessageForEveryone), the reply preview still has real
    // content to show instead of a broken lookup, matching "handle
    // deleted original messages gracefully" without needing a tombstone
    // system for every message.
    if (replyTo) {
      messageDoc.replyTo = {
        messageId: replyTo.messageId,
        senderId: replyTo.senderId,
        text: (replyTo.text || '').slice(0, 200),
        type: replyTo.type || 'text'
      }
    }
    if (imageUrl) messageDoc.imageUrl = imageUrl
    if (sharedPayload) messageDoc.sharedPayload = sharedPayload
    if (fileUrl) {
      messageDoc.fileUrl = fileUrl
      messageDoc.fileName = fileName || 'File'
      messageDoc.fileSize = fileSize || 0
      messageDoc.mimeType = mimeType || ''
    }
    if (type === 'voice') {
      messageDoc.durationSec = durationSec || 0
    }
    if (type === 'call') {
      messageDoc.callType = callType || 'voice'
      messageDoc.callDurationSec = callDurationSec || 0
      messageDoc.callOutcome = callOutcome || 'completed'
    }

    transaction.set(newMessageRef, messageDoc)

    // Last-message preview in the chat list reflects the share, not
    // raw payload data — "Shared a post" reads correctly in the inbox
    // instead of an empty string or a JSON blob.
    const lastMessagePreview =
      type === 'text'
        ? text.trim().slice(0, 120)
        : type === 'call'
          ? formatCallPreview(callType, callOutcome, callDurationSec)
          : sharedPayload?.preview?.title
            ? `Shared: ${sharedPayload.preview.title}`
            : SHARE_TYPE_LABELS[type] || 'Sent a message'

    const chatUpdate = {
      lastMessage: lastMessagePreview,
      lastMessageAt: serverTimestamp(),
      lastSenderId: senderId,
      readBy: [senderId]
    }
    // Real per-user unread COUNT (not just readBy's read/unread boolean)
    // — a map field on the chat doc, incremented for every OTHER
    // participant on every message. Works identically for 1:1 and group
    // chats since `participants` is already the same array-of-uids
    // field for both. Read live via the SAME subscribeToUserChats
    // listener the chat list already has open — no new query, no count
    // aggregation, no per-chat listener.
    ;(chatData.participants || []).forEach((participantUid) => {
      if (participantUid === senderId) return
      chatUpdate[`unreadCount.${participantUid}`] = increment(1)
    })
    if (chatData.status === 'pending') {
      chatUpdate.pendingMessageCount = (chatData.pendingMessageCount || 0) + 1
    }
    // A genuinely new message resurrects this conversation for anyone
    // who'd previously deleted it (deleteChat below) — real WhatsApp/
    // Instagram behavior, and exactly what firestore.rules' matching
    // `deletedFor` clause is written to permit (see that rule's own
    // comment). Only writes this field when there's actually something
    // to clear, so the overwhelmingly common case (nobody ever deleted
    // this chat) never touches it.
    if ((chatData.deletedFor || []).length > 0) {
      chatUpdate.deletedFor = []
    }
    transaction.update(chatDoc(chatId), chatUpdate)
  })

  // Gamification — daily-capped (20/day) since messages have no
  // natural per-source dedup key the way a like/comment/save does
  // (each is tied to one specific post; a message isn't tied to
  // anything that would make "the same message twice" a meaningful
  // concept to dedupe against). Sending never blocks on this — only
  // XP stops accruing once the cap is hit for the day.
  const dailyCapped = await hasReachedDailyCap(senderId, 'message_sent', DAILY_CAPS.message_sent).catch(() => true)
  if (!dailyCapped) {
    await awardXP(senderId, 'message_sent', {}).catch(() => {})
  }

  return newMessageRef.id
}

/**
 * Lightweight call-history entry — reuses sendMessage/the existing
 * message architecture (per the explicit "use the existing message
 * architecture if possible" instruction) rather than a separate
 * call-log system. Called exactly once per finished call, from
 * useCall.js's teardown(), caller-side only (see that file's comment
 * for why only one side ever posts this).
 */
export async function sendCallSummaryMessage(chatId, senderId, { callType, callDurationSec, callOutcome }) {
  return sendMessage(chatId, senderId, '', { type: 'call', callType, callDurationSec, callOutcome })
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
  const data = snap.data()
  if (data.requestedBy === receiverUid) {
    throw new Error('Only the recipient can accept a message request.')
  }
  await updateDoc(chatDoc(chatId), { status: 'accepted' })

  const senderUid = data.requestedBy
  if (senderUid) {
    getUserProfile(receiverUid)
      .then((actorProfile) =>
        createMessageRequestAcceptedNotification({
          targetUid: senderUid,
          actorUid: receiverUid,
          actorName: actorProfile?.displayName || 'Someone',
          actorAvatar: getProfileIdentityImage(actorProfile) || '',
          actorUsername: actorProfile?.username || '',
          chatId
        })
      )
      .catch(() => {})
  }
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

/**
 * ROOT CAUSE FIX: this used to hard-delete the entire chat document AND
 * every message in it — global, for BOTH participants, not "delete for
 * me." Nothing in the app ever actually called this (confirmed by
 * searching the whole src tree), so there was no existing caller to
 * preserve compatibility with; it was simply wired up wrong and never
 * used. Real semantics now match the existing per-message `deletedFor`
 * pattern one level up: add the caller's own uid to the chat doc's own
 * `deletedFor` array. No message is touched, the other participant's
 * copy of the conversation is completely unaffected, and it persists
 * (survives refresh/logout) because it's a real Firestore field, not
 * client state. subscribeToUserChats filters it back out below; a
 * genuinely new message clears it again (see sendMessage above) so the
 * conversation naturally comes back if it becomes active again.
 */
export async function deleteChat(chatId, uid) {
  if (!uid) throw new Error('You need to be signed in.')
  await updateDoc(chatDoc(chatId), { deletedFor: arrayUnion(uid) })
}

/**
 * Media/Files — "Media/files/links" (group/chat menu). A real query
 * against this chat's own messages/{messageId} subcollection (image and
 * file message types), not a client-side filter of whatever happens to
 * already be loaded in the open conversation — needs only the
 * automatic single-field index Firestore already provides for a plain
 * `where('type','in',[...])` with no other filter/orderBy, so no new
 * composite index is required.
 */
export async function getChatMediaMessages(chatId, { pageSize = 60 } = {}) {
  const snap = await getDocs(
    query(messagesCollection(chatId), where('type', 'in', ['image', 'file']), limit(pageSize))
  )
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
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

/**
 * Dedicated chatMedia/{chatId}/{uid}/... path — deliberately never
 * postImages, per explicit instruction. The caller passes the result
 * straight into sendMessage(chatId, senderId, '', { type: 'image',
 * imageUrl }) — that function already fully supports this (confirmed
 * by reading it directly), so this upload helper is the only new
 * piece actually needed on the service layer.
 */
export async function uploadChatImage(chatId, uid, file) {
  const path = `chatMedia/${chatId}/${uid}/${Date.now()}-${file.name}`
  const fileRef = ref(storage, path)
  await uploadBytes(fileRef, file)
  return getDownloadURL(fileRef)
}

/**
 * Generic (non-image) file attachment — same chatMedia/{chatId}/{uid}/
 * path as uploadChatImage, since both are equally "media this
 * conversation's two participants uploaded," not a new Storage
 * location or a new rule. Returns url + the file's own name/size so
 * sendMessage can store a real file card (name, size, type) instead of
 * a bare URL.
 */
export async function uploadChatFile(chatId, uid, file) {
  const path = `chatMedia/${chatId}/${uid}/${Date.now()}-${file.name}`
  const fileRef = ref(storage, path)
  await uploadBytes(fileRef, file)
  const url = await getDownloadURL(fileRef)
  return { url, name: file.name, size: file.size, mimeType: file.type }
}

/**
 * Voice messages (Part 9) — same chatMedia/{chatId}/{uid}/ Storage path
 * and the same owner-only write rule as every other chat attachment
 * (storage.rules has no per-mime-type restriction there), so this is
 * additive, not a new permission surface. Takes a raw Blob (MediaRecorder's
 * output has no .name like a File does) and gives it one, with a real
 * contentType so the download URL serves as playable audio.
 */
export async function uploadChatVoice(chatId, uid, blob, mimeType) {
  const ext = mimeType?.includes('wav')
    ? 'wav'
    : mimeType?.includes('mp4')
      ? 'm4a'
      : mimeType?.includes('ogg')
        ? 'ogg'
        : 'webm'
  const path = `chatMedia/${chatId}/${uid}/${Date.now()}-voice.${ext}`
  const fileRef = ref(storage, path)
  await uploadBytes(fileRef, blob, { contentType: mimeType || 'audio/webm' })
  return getDownloadURL(fileRef)
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
  if (!chatSnap.exists()) return
  const data = chatSnap.data()
  const readUpdate = {}
  if (!(data.readBy || []).includes(uid)) readUpdate.readBy = arrayUnion(uid)
  // Real unread count reset — the actual fix for "badge should clear
  // once you've reached the latest messages," not just the old
  // read/unread boolean this used to only maintain.
  if ((data.unreadCount?.[uid] || 0) !== 0) readUpdate[`unreadCount.${uid}`] = 0
  if (Object.keys(readUpdate).length > 0) await updateDoc(chatDoc(chatId), readUpdate)
}

/**
 * "Mark as unread" from the chat list (long-press/context menu) — the
 * exact inverse of markChatRead's own readBy write, same field, same
 * per-user array. Deliberately does NOT touch individual messages'
 * `read` flags (those reflect the sender's real delivery/read receipts,
 * which this UI action has no business rewriting) — only the chat
 * LIST's own unread indicator (ChatCard.jsx's `isUnread`, derived from
 * `readBy`) is affected, matching what the action visibly does.
 */
export async function markChatUnread(chatId, uid) {
  const snap = await getDoc(chatDoc(chatId))
  const update = { readBy: arrayRemove(uid) }
  // A manual "mark unread" has no real per-message count behind it —
  // matches the old boolean semantics, just expressed as "at least 1"
  // so the list's count badge has something honest to show rather than
  // staying at a stale 0 while the row itself now reads as unread.
  if (!(snap.exists() && (snap.data().unreadCount?.[uid] || 0) > 0)) {
    update[`unreadCount.${uid}`] = 1
  }
  await updateDoc(chatDoc(chatId), update)
}

const TYPING_STALE_MS = 5000 // client auto-clears at ~1.8s; this is just headroom for the write to land plus a fallback for an abrupt disconnect (no onDisconnect hook without RTDB — same honest limitation presenceService.js already documents for online/offline).

function typingDoc(chatId, uid) {
  return doc(db, 'chats', chatId, 'typing', uid)
}

/**
 * Ephemeral typing presence only — never creates a message, never
 * touches lastMessage/lastMessageAt. `true` upserts a tiny doc (id =
 * the typer's own uid, matching the rule's expectations); `false`
 * deletes it outright rather than writing `{ typing: false }`, so a
 * stopped-typing state has nothing lingering to go stale.
 */
export async function setTypingState(chatId, uid, isTyping) {
  if (!chatId || !uid) return
  if (isTyping) {
    await setDoc(typingDoc(chatId, uid), { typing: true, updatedAt: serverTimestamp() }).catch(() => {})
  } else {
    await deleteDoc(typingDoc(chatId, uid)).catch(() => {})
  }
}

/**
 * Real-time listener for who else is currently typing in this exact
 * chatId — excludes the caller's own doc and anything older than
 * TYPING_STALE_MS, so a write that never got cleaned up (crash, closed
 * tab) ages out on its own instead of showing "typing..." forever.
 */
export function subscribeToTypingState(chatId, currentUid, onData) {
  if (!chatId) return () => {}
  return onSnapshot(
    collection(db, 'chats', chatId, 'typing'),
    (snap) => {
      const now = Date.now()
      const typingUids = snap.docs
        .filter((d) => d.id !== currentUid)
        .filter((d) => {
          const data = d.data()
          const ms = data.updatedAt?.toMillis?.()
          return data.typing === true && ms && now - ms < TYPING_STALE_MS
        })
        .map((d) => d.id)
      onData(typingUids)
    },
    () => onData([])
  )
}

export async function editMessage(chatId, messageId, senderId, newText) {
  const messageRef = doc(db, 'chats', chatId, 'messages', messageId)
  const snap = await getDoc(messageRef)
  if (!snap.exists()) throw new Error('This message no longer exists.')
  if (snap.data().senderId !== senderId) throw new Error('You can only edit your own messages.')
  if (!newText?.trim()) throw new Error('Message cannot be empty.')
  await updateDoc(messageRef, { text: newText.trim(), edited: true, editedAt: serverTimestamp() })
}

// One reaction per user, matching the rule's own [request.auth.uid]-only
// carve-out: reactions is a map keyed by uid, so setting it again just
// overwrites that same key — never adds a second entry for one user.
// Written via a dotted-path field update (reactions.{uid}), not a
// read-merge-write of the whole map, so two different users reacting at
// the same moment can never clobber each other's entry — only the read
// that decides add-vs-remove for THIS user's own tap needs a get().
export async function toggleMessageReaction(chatId, messageId, uid, emoji) {
  const messageRef = doc(db, 'chats', chatId, 'messages', messageId)
  const snap = await getDoc(messageRef)
  if (!snap.exists()) return
  const current = snap.data().reactions || {}
  const removing = current[uid] === emoji // tapping the same emoji again removes it
  await updateDoc(messageRef, { [`reactions.${uid}`]: removing ? deleteField() : emoji })
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

/**
 * Demote — the missing inverse of promoteToGroupAdmin, same admin-only
 * gate (enforced here AND independently by firestore.rules' own
 * `admins`-change branch, which already requires the requester to
 * already be listed in `admins`). Refuses to remove the group's last
 * remaining admin — not a rules requirement, a data-integrity guard so
 * a group can never end up with zero admins able to manage it.
 */
export async function demoteGroupAdmin(chatId, requesterUid, targetUid) {
  const snap = await getDoc(chatDoc(chatId))
  if (!snap.exists()) throw new Error('This group no longer exists.')
  const data = snap.data()
  const currentAdmins = data.admins || []
  if (!currentAdmins.includes(requesterUid)) throw new Error('Only group admins can demote members.')
  if (!currentAdmins.includes(targetUid)) throw new Error('That person is not an admin.')
  if (currentAdmins.length <= 1) throw new Error('A group must have at least one admin.')
  await updateDoc(chatDoc(chatId), {
    admins: currentAdmins.filter((id) => id !== targetUid),
    updatedAt: serverTimestamp()
  })
}

/**
 * Group photo — same chatMedia/{chatId}/{uid}/ Storage path and rule
 * every other chat attachment already uses (owner-write, signed-in
 * read; see uploadChatImage above), just feeding updateGroupInfo's
 * existing groupAvatar field instead of a message. Admin-only is
 * enforced by updateGroupInfo itself right after this resolves.
 */
export async function uploadGroupAvatar(chatId, uid, file) {
  const path = `chatMedia/${chatId}/${uid}/${Date.now()}-group-avatar-${file.name}`
  const fileRef = ref(storage, path)
  await uploadBytes(fileRef, file)
  return getDownloadURL(fileRef)
}
