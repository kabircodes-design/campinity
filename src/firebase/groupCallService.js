import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore'
import { db } from './firebase.js'
import { RTC_CONFIG } from './callService.js'

/**
 * WebRTC MESH signaling for group calls, over Firestore — same real
 * constraint as callService.js's 1:1 system (no separate realtime
 * signaling server in this project, no TURN server, STUN-only). This
 * is deliberately a NEW, separate collection tree (groupCalls/*), not a
 * rework of calls/{callId} — that schema is a single offer/answer pair,
 * fundamentally shaped for exactly two parties, and extending it in
 * place would have meant either breaking 1:1 calling or bolting an
 * incompatible second shape onto the same documents.
 *
 * ARCHITECTURE DECISION (stated plainly, not hidden): this is a full
 * mesh — every participant opens one RTCPeerConnection directly to
 * every OTHER participant (N participants → N·(N-1)/2 connections
 * total, each person uploading their own media N-1 times). There is no
 * SFU/media-server in this project's infrastructure, and standing one
 * up is a real external service this codebase has no path to add
 * itself. A mesh is the correct, honest choice for a Firebase-only
 * stack and works reliably for the small-group sizes a campus chat
 * group call actually is — it does NOT scale to large calls (CPU/
 * upload-bandwidth cost per participant grows with group size), which
 * is a real, stated limitation, not a hidden one.
 *
 * JOIN PROTOCOL (avoids offer/answer glare without any central
 * coordinator): when someone joins, they — and only they — initiate a
 * peerLink to every participant who was ALREADY in the call. Existing
 * participants never initiate toward a new joiner; they only listen for
 * an incoming peerLink addressed to them (toUid == me) and answer it.
 * This gives every pair exactly one, unambiguous initiator.
 */

function groupCallDoc(callId) {
  return doc(db, 'groupCalls', callId)
}
function participantDoc(callId, uid) {
  return doc(db, 'groupCalls', callId, 'participants', uid)
}
function participantsCollection(callId) {
  return collection(db, 'groupCalls', callId, 'participants')
}
function peerLinksCollection(callId) {
  return collection(db, 'groupCalls', callId, 'peerLinks')
}
function peerLinkDoc(callId, fromUid, toUid) {
  return doc(db, 'groupCalls', callId, 'peerLinks', `${fromUid}_${toUid}`)
}
function fromCandidatesCollection(callId, fromUid, toUid) {
  return collection(db, 'groupCalls', callId, 'peerLinks', `${fromUid}_${toUid}`, 'fromCandidates')
}
function toCandidatesCollection(callId, fromUid, toUid) {
  return collection(db, 'groupCalls', callId, 'peerLinks', `${fromUid}_${toUid}`, 'toCandidates')
}

export { RTC_CONFIG }

/** Starting a group call — participantUids is every current member of the group chat, used only to let them query "is a call ringing for one of my groups," never the actual security boundary (real membership is re-checked against the chat doc itself by firestore.rules on every read). groupName/groupAvatar are denormalized snapshots (same reasoning as chat.groupName itself) purely so IncomingGroupCallToast.jsx can render without a second fetch. */
export async function createGroupCallDoc({ chatId, hostUid, type, participantUids, groupName, groupAvatar }) {
  const ref = doc(collection(db, 'groupCalls'))
  await setDoc(ref, {
    chatId,
    hostUid,
    type, // 'voice' | 'video'
    status: 'ringing', // 'ringing' | 'active' | 'ended'
    participantUids,
    groupName: groupName || 'Group',
    groupAvatar: groupAvatar || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    endedAt: null
  })
  // The host is the first real participant — without this, a lone host
  // would ring with nobody ever transitioning the call to "active."
  await setDoc(participantDoc(ref.id, hostUid), {
    uid: hostUid,
    state: 'joined',
    muted: false,
    cameraOff: false,
    joinedAt: serverTimestamp(),
    leftAt: null
  })
  await updateDoc(ref, { status: 'active', updatedAt: serverTimestamp() })
  return ref.id
}

export function subscribeToGroupCall(callId, onData) {
  return onSnapshot(groupCallDoc(callId), (snap) => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null))
}

/** Real-time "is a group call ringing for one of my groups" — mirrors subscribeToIncomingCalls' own shape/reasoning exactly. */
export function subscribeToIncomingGroupCalls(uid, onData) {
  const q = query(collection(db, 'groupCalls'), where('participantUids', 'array-contains', uid), where('status', 'in', ['ringing', 'active']))
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

export function subscribeToParticipants(callId, onData) {
  return onSnapshot(participantsCollection(callId), (snap) => onData(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))))
}

export async function joinGroupCallParticipant(callId, uid) {
  await setDoc(participantDoc(callId, uid), {
    uid,
    state: 'joined',
    muted: false,
    cameraOff: false,
    joinedAt: serverTimestamp(),
    leftAt: null
  })
}

export async function declineGroupCallParticipant(callId, uid) {
  await setDoc(
    participantDoc(callId, uid),
    { uid, state: 'declined', leftAt: serverTimestamp() },
    { merge: true }
  )
}

export async function leaveGroupCallParticipant(callId, uid) {
  await updateDoc(participantDoc(callId, uid), { state: 'left', leftAt: serverTimestamp() }).catch(() => {})
}

export async function setParticipantMediaState(callId, uid, { muted, cameraOff }) {
  const update = { updatedAtLocal: serverTimestamp() }
  if (typeof muted === 'boolean') update.muted = muted
  if (typeof cameraOff === 'boolean') update.cameraOff = cameraOff
  await updateDoc(participantDoc(callId, uid), update).catch(() => {})
}

/** Any real chat member can end a group call outright (e.g. the host leaving a call nobody else would otherwise be able to close) — matches "stale call state cannot permanently block future calls." */
export async function endGroupCall(callId) {
  await updateDoc(groupCallDoc(callId), { status: 'ended', updatedAt: serverTimestamp(), endedAt: serverTimestamp() }).catch(() => {})
}

/* ---------------- peer-link signaling (one per ordered pair) ---------------- */

export async function createPeerLink(callId, fromUid, toUid, offer) {
  await setDoc(peerLinkDoc(callId, fromUid, toUid), {
    fromUid,
    toUid,
    offer: { type: offer.type, sdp: offer.sdp },
    answer: null,
    createdAt: serverTimestamp()
  })
}

export async function setPeerLinkAnswer(callId, fromUid, toUid, answer) {
  await updateDoc(peerLinkDoc(callId, fromUid, toUid), { answer: { type: answer.type, sdp: answer.sdp } })
}

export async function getPeerLink(callId, fromUid, toUid) {
  const snap = await getDoc(peerLinkDoc(callId, fromUid, toUid))
  return snap.exists() ? snap.data() : null
}

/** Every peerLink addressed TO me (toUid == me) that I haven't already answered — how I discover who I need to connect back to. */
export function subscribeToIncomingPeerLinks(callId, uid, onLink) {
  const q = query(peerLinksCollection(callId), where('toUid', '==', uid))
  return onSnapshot(q, (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === 'added') onLink(change.doc.data())
    })
  })
}

/** Every peerLink I initiated (fromUid == me) — how I find out my offer was answered. */
export function subscribeToOutgoingPeerLinkAnswers(callId, uid, onAnswered) {
  const q = query(peerLinksCollection(callId), where('fromUid', '==', uid))
  return onSnapshot(q, (snap) => {
    snap.docChanges().forEach((change) => {
      const data = change.doc.data()
      if ((change.type === 'added' || change.type === 'modified') && data.answer) onAnswered(data)
    })
  })
}

export async function addPeerFromCandidate(callId, fromUid, toUid, candidate) {
  await addDoc(fromCandidatesCollection(callId, fromUid, toUid), candidate.toJSON())
}
export async function addPeerToCandidate(callId, fromUid, toUid, candidate) {
  await addDoc(toCandidatesCollection(callId, fromUid, toUid), candidate.toJSON())
}
export function subscribeToPeerFromCandidates(callId, fromUid, toUid, onCandidate) {
  return onSnapshot(fromCandidatesCollection(callId, fromUid, toUid), (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === 'added') onCandidate(change.doc.data())
    })
  })
}
export function subscribeToPeerToCandidates(callId, fromUid, toUid, onCandidate) {
  return onSnapshot(toCandidatesCollection(callId, fromUid, toUid), (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === 'added') onCandidate(change.doc.data())
    })
  })
}
