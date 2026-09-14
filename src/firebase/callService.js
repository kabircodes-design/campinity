import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore'
import { db } from './firebase.js'

/**
 * WebRTC signaling over Firestore — this project has no separate
 * realtime signaling server (no Socket.io, no Realtime Database), so
 * calls/{callId} plus two candidate subcollections IS the signaling
 * channel, using infrastructure that already exists rather than adding
 * a new backend service. Media itself (audio/video) flows directly
 * peer-to-peer via WebRTC once connected — Firestore only ever carries
 * the small SDP offer/answer text and ICE candidates, never audio/video
 * data itself.
 *
 * STUN-only (Google's public STUN servers) — there is no TURN server
 * configured, because a production TURN server is a real external
 * service/cost (e.g. Twilio, Xirsys, or self-hosted coturn) that can't
 * be provisioned from inside this repository. STUN alone successfully
 * connects most calls (home Wi-Fi, most campus networks, mobile data),
 * but will fail to connect two peers both behind restrictive/symmetric
 * NATs (common on some corporate or heavily-firewalled networks) —
 * stated here plainly, not hidden behind a generic "call failed."
 */
export const RTC_CONFIG = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
  ]
}

function callDoc(callId) {
  return doc(db, 'calls', callId)
}
function callerCandidatesCollection(callId) {
  return collection(db, 'calls', callId, 'callerCandidates')
}
function calleeCandidatesCollection(callId) {
  return collection(db, 'calls', callId, 'calleeCandidates')
}

export async function createCallDoc({ callerUid, calleeUid, chatId, type }) {
  const ref = doc(collection(db, 'calls'))
  await setDoc(ref, {
    callerUid,
    calleeUid,
    chatId,
    type, // 'voice' | 'video'
    status: 'ringing', // 'ringing' | 'active' | 'ended' | 'declined' | 'missed' | 'failed'
    offer: null,
    answer: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    endedAt: null
  })
  return ref.id
}

export async function setCallOffer(callId, offer) {
  await updateDoc(callDoc(callId), { offer: { type: offer.type, sdp: offer.sdp }, updatedAt: serverTimestamp() })
}

export async function setCallAnswer(callId, answer) {
  await updateDoc(callDoc(callId), {
    answer: { type: answer.type, sdp: answer.sdp },
    status: 'active',
    updatedAt: serverTimestamp()
  })
}

export async function setCallStatus(callId, status) {
  const terminal = status === 'ended' || status === 'declined' || status === 'missed' || status === 'failed'
  await updateDoc(callDoc(callId), {
    status,
    updatedAt: serverTimestamp(),
    ...(terminal ? { endedAt: serverTimestamp() } : {})
  }).catch(() => {})
}

export function subscribeToCall(callId, onData) {
  return onSnapshot(callDoc(callId), (snap) => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null))
}

/** Real-time "is someone calling me right now" — status stays 'ringing' until answered/declined/cancelled. */
export function subscribeToIncomingCalls(uid, onData) {
  const q = query(collection(db, 'calls'), where('calleeUid', '==', uid), where('status', '==', 'ringing'))
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

export async function addCallerCandidate(callId, candidate) {
  await addDoc(callerCandidatesCollection(callId), candidate.toJSON())
}
export async function addCalleeCandidate(callId, candidate) {
  await addDoc(calleeCandidatesCollection(callId), candidate.toJSON())
}
export function subscribeToCallerCandidates(callId, onCandidate) {
  return onSnapshot(callerCandidatesCollection(callId), (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === 'added') onCandidate(change.doc.data())
    })
  })
}
export function subscribeToCalleeCandidates(callId, onCandidate) {
  return onSnapshot(calleeCandidatesCollection(callId), (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === 'added') onCandidate(change.doc.data())
    })
  })
}
