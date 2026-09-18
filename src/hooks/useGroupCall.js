import { useCallback, useEffect, useRef, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase/firebase.js'
import {
  RTC_CONFIG,
  createGroupCallDoc,
  subscribeToGroupCall,
  subscribeToIncomingGroupCalls,
  subscribeToParticipants,
  joinGroupCallParticipant,
  declineGroupCallParticipant,
  leaveGroupCallParticipant,
  setParticipantMediaState,
  endGroupCall,
  createPeerLink,
  setPeerLinkAnswer,
  subscribeToIncomingPeerLinks,
  subscribeToOutgoingPeerLinkAnswers,
  addPeerFromCandidate,
  addPeerToCandidate,
  subscribeToPeerFromCandidates,
  subscribeToPeerToCandidates
} from '../firebase/groupCallService.js'

/**
 * Real WebRTC MESH group calling — see groupCallService.js's own header
 * comment for the full architecture reasoning (why mesh, why this
 * signaling shape, why only the joiner ever initiates toward existing
 * participants). This hook owns N simultaneous RTCPeerConnections (one
 * per OTHER participant), not one — the actual structural difference
 * from useCall.js, which this file does not touch or replace.
 *
 * Mounted once at the app root (CallContext.jsx), exactly like useCall
 * — same reasoning: incoming-call detection must work from any page,
 * and per-second UI updates (participant list, durations) must not
 * re-render the whole routed app.
 */
const RING_TIMEOUT_MS = 45000

export function useGroupCall() {
  const [groupCallState, setGroupCallState] = useState('idle') // idle | incoming | connecting | active | ended
  const [activeGroupCall, setActiveGroupCall] = useState(null) // { callId, chatId, type, groupName, groupAvatar }
  const [incomingGroupCall, setIncomingGroupCall] = useState(null)
  const [localStream, setLocalStream] = useState(null)
  const [participants, setParticipants] = useState([]) // [{ uid, state, muted, cameraOff }]
  const [remoteStreams, setRemoteStreams] = useState({}) // { [uid]: MediaStream }
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [callError, setCallError] = useState('')

  const callIdRef = useRef(null)
  const chatIdRef = useRef(null)
  const typeRef = useRef('voice')
  const peerConnectionsRef = useRef(new Map()) // uid -> RTCPeerConnection
  const peerRemoteDescSetRef = useRef(new Map()) // uid -> boolean
  const peerPendingCandidatesRef = useRef(new Map()) // uid -> candidate[]
  const cleanupFnsRef = useRef([])
  const localStreamRef = useRef(null)
  const ringTimeoutRef = useRef(null)
  const groupCallStateRef = useRef('idle')
  groupCallStateRef.current = groupCallState

  const [authUid, setAuthUid] = useState(() => auth.currentUser?.uid || null)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => setAuthUid(user?.uid || null))
    return unsubscribe
  }, [])

  const clearRingTimeout = () => {
    if (ringTimeoutRef.current) {
      window.clearTimeout(ringTimeoutRef.current)
      ringTimeoutRef.current = null
    }
  }

  const closePeerConnection = useCallback((uid) => {
    const pc = peerConnectionsRef.current.get(uid)
    if (pc) {
      pc.getSenders().forEach((s) => s.track?.stop())
      pc.close()
      peerConnectionsRef.current.delete(uid)
    }
    peerRemoteDescSetRef.current.delete(uid)
    peerPendingCandidatesRef.current.delete(uid)
    setRemoteStreams((prev) => {
      if (!(uid in prev)) return prev
      const next = { ...prev }
      delete next[uid]
      return next
    })
  }, [])

  const teardown = useCallback((finalState = 'idle') => {
    clearRingTimeout()
    cleanupFnsRef.current.forEach((fn) => fn())
    cleanupFnsRef.current = []
    Array.from(peerConnectionsRef.current.keys()).forEach((uid) => closePeerConnection(uid))
    setLocalStream((prev) => {
      prev?.getTracks().forEach((t) => t.stop())
      return null
    })
    localStreamRef.current = null
    callIdRef.current = null
    chatIdRef.current = null
    setParticipants([])
    setRemoteStreams({})
    setMuted(false)
    setCameraOff(false)
    setIncomingGroupCall(null)
    if (finalState === 'idle') setActiveGroupCall(null)
    setGroupCallState(finalState)
  }, [closePeerConnection])

  // Connects to one specific OTHER participant. amInitiator=true means I
  // am the one who just joined and I'm reaching out to someone already
  // in the call; amInitiator=false means the opposite — they reached
  // out to me via an offer I'm now answering.
  const connectToPeer = useCallback(
    async (callId, myUid, otherUid, amInitiator, offerFromThem) => {
      if (peerConnectionsRef.current.has(otherUid)) return // duplicate-connection prevention
      const stream = localStreamRef.current
      if (!stream) return

      const pc = new RTCPeerConnection(RTC_CONFIG)
      peerConnectionsRef.current.set(otherUid, pc)
      peerRemoteDescSetRef.current.set(otherUid, false)
      peerPendingCandidatesRef.current.set(otherUid, [])
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      const fromUid = amInitiator ? myUid : otherUid
      const toUid = amInitiator ? otherUid : myUid

      pc.ontrack = (event) => {
        setRemoteStreams((prev) => ({ ...prev, [otherUid]: event.streams[0] }))
      }
      pc.onicecandidate = (event) => {
        if (!event.candidate) return
        const add = amInitiator ? addPeerFromCandidate : addPeerToCandidate
        add(callId, fromUid, toUid, event.candidate).catch(() => {})
      }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          closePeerConnection(otherUid)
        }
      }

      const drainPending = async () => {
        const queued = peerPendingCandidatesRef.current.get(otherUid) || []
        peerPendingCandidatesRef.current.set(otherUid, [])
        for (const candidate of queued) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
        }
      }

      const onRemoteCandidate = (candidate) => {
        if (peerRemoteDescSetRef.current.get(otherUid)) {
          pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
        } else {
          peerPendingCandidatesRef.current.get(otherUid)?.push(candidate)
        }
      }
      const unsubCandidates = amInitiator
        ? subscribeToPeerToCandidates(callId, fromUid, toUid, onRemoteCandidate)
        : subscribeToPeerFromCandidates(callId, fromUid, toUid, onRemoteCandidate)
      cleanupFnsRef.current.push(unsubCandidates)

      if (amInitiator) {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await createPeerLink(callId, fromUid, toUid, offer)
        // Answer arrives via the top-level subscribeToOutgoingPeerLinkAnswers
        // listener in startGroupCall/joinGroupCall below, which calls
        // completeOutgoingPeer() — kept as one shared subscription per
        // call instead of N duplicate ones, one per peer.
      } else {
        if (!offerFromThem?.type || !offerFromThem?.sdp) return
        await pc.setRemoteDescription(new RTCSessionDescription(offerFromThem))
        peerRemoteDescSetRef.current.set(otherUid, true)
        await drainPending()
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await setPeerLinkAnswer(callId, fromUid, toUid, answer)
      }
    },
    [closePeerConnection]
  )

  const completeOutgoingPeer = useCallback(async (otherUid, answer) => {
    const pc = peerConnectionsRef.current.get(otherUid)
    if (!pc || peerRemoteDescSetRef.current.get(otherUid)) return
    await pc.setRemoteDescription(new RTCSessionDescription(answer)).catch(() => {})
    peerRemoteDescSetRef.current.set(otherUid, true)
    const queued = peerPendingCandidatesRef.current.get(otherUid) || []
    peerPendingCandidatesRef.current.set(otherUid, [])
    for (const candidate of queued) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
    }
  }, [])

  // Shared plumbing both starting and joining a call need: local media,
  // the participants/call-status listeners, and the two top-level peer
  // signaling subscriptions (one for offers addressed to me, one for
  // answers to offers I sent).
  const beginParticipating = useCallback(
    async (callId, chatId, type, myUid) => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' })
      setLocalStream(stream)
      localStreamRef.current = stream

      const unsubCall = subscribeToGroupCall(callId, (data) => {
        if (!data || data.status === 'ended') {
          if (groupCallStateRef.current !== 'idle' && groupCallStateRef.current !== 'ended') {
            teardown('ended')
          }
        }
      })
      const unsubParticipants = subscribeToParticipants(callId, (list) => {
        setParticipants(list)
        // Anyone who transitioned to 'left'/'declined' loses their tile
        // and peer connection immediately — no ghost participants.
        const activeUids = new Set(list.filter((p) => p.state === 'joined').map((p) => p.uid))
        Array.from(peerConnectionsRef.current.keys()).forEach((uid) => {
          if (!activeUids.has(uid)) closePeerConnection(uid)
        })
      })
      const unsubIncomingLinks = subscribeToIncomingPeerLinks(callId, myUid, (link) => {
        connectToPeer(callId, myUid, link.fromUid, false, link.offer)
      })
      const unsubOutgoingAnswers = subscribeToOutgoingPeerLinkAnswers(callId, myUid, (link) => {
        completeOutgoingPeer(link.toUid, link.answer)
      })
      cleanupFnsRef.current.push(unsubCall, unsubParticipants, unsubIncomingLinks, unsubOutgoingAnswers)

      return stream
    },
    [connectToPeer, completeOutgoingPeer, closePeerConnection, teardown]
  )

  const startGroupCall = useCallback(
    async (chatId, type, memberUids, groupName, groupAvatar) => {
      const uid = auth.currentUser?.uid
      if (!uid || groupCallStateRef.current !== 'idle') return // duplicate-call prevention
      setCallError('')
      setGroupCallState('connecting')
      setActiveGroupCall({ callId: null, chatId, type, groupName, groupAvatar, isHost: true })
      try {
        const callId = await createGroupCallDoc({ chatId, hostUid: uid, type, participantUids: memberUids, groupName, groupAvatar })
        callIdRef.current = callId
        chatIdRef.current = chatId
        typeRef.current = type
        setActiveGroupCall({ callId, chatId, type, groupName, groupAvatar, isHost: true })
        await beginParticipating(callId, chatId, type, uid)
        setGroupCallState('active')
      } catch (err) {
        setCallError(
          err?.name === 'NotAllowedError'
            ? 'Microphone/camera access was denied.'
            : err?.name === 'NotFoundError'
              ? type === 'video'
                ? 'No camera found on this device.'
                : 'No microphone found on this device.'
              : 'Could not start the call.'
        )
        teardown('failed')
      }
    },
    [beginParticipating, teardown]
  )

  const joinGroupCall = useCallback(async () => {
    const uid = auth.currentUser?.uid
    const call = incomingGroupCall
    if (!uid || !call || groupCallStateRef.current === 'active' || groupCallStateRef.current === 'connecting') return
    setCallError('')
    setGroupCallState('connecting')
    callIdRef.current = call.id
    chatIdRef.current = call.chatId
    typeRef.current = call.type
    setActiveGroupCall({ callId: call.id, chatId: call.chatId, type: call.type, groupName: call.groupName, groupAvatar: call.groupAvatar, isHost: false })
    setIncomingGroupCall(null)
    try {
      const stream = await beginParticipating(call.id, call.chatId, call.type, uid)
      localStreamRef.current = stream
      await joinGroupCallParticipant(call.id, uid)

      // Connect to everyone already in the call — I'm the initiator for
      // every one of these pairs, per the join protocol.
      const existing = await new Promise((resolve) => {
        const unsub = subscribeToParticipants(call.id, (list) => {
          unsub()
          resolve(list.filter((p) => p.state === 'joined' && p.uid !== uid))
        })
      })
      await Promise.all(existing.map((p) => connectToPeer(call.id, uid, p.uid, true)))

      setGroupCallState('active')
    } catch (err) {
      setCallError(
        err?.name === 'NotAllowedError'
          ? 'Microphone/camera access was denied.'
          : err?.name === 'NotFoundError'
            ? call.type === 'video'
              ? 'No camera found on this device.'
              : 'No microphone found on this device.'
            : 'Could not join the call.'
      )
      teardown('failed')
    }
  }, [incomingGroupCall, beginParticipating, connectToPeer, teardown])

  const declineGroupCall = useCallback(async () => {
    if (!incomingGroupCall) return
    const uid = auth.currentUser?.uid
    if (uid) await declineGroupCallParticipant(incomingGroupCall.id, uid).catch(() => {})
    setIncomingGroupCall(null)
    setGroupCallState('idle')
  }, [incomingGroupCall])

  const leaveGroupCall = useCallback(async () => {
    const uid = auth.currentUser?.uid
    const callId = callIdRef.current
    if (!uid || !callId) {
      teardown('idle')
      return
    }
    // If I'm the only one left, end the call outright rather than
    // leaving it 'active' with zero real participants forever — the
    // stale-call cleanup the brief explicitly asks for.
    const remainingOthers = participants.filter((p) => p.state === 'joined' && p.uid !== uid)
    await leaveGroupCallParticipant(callId, uid).catch(() => {})
    if (remainingOthers.length === 0) {
      await endGroupCall(callId).catch(() => {})
    }
    teardown('idle')
  }, [participants, teardown])

  // Incoming-call detection — mirrors useCall.js's own subscribeToIncomingCalls effect exactly.
  useEffect(() => {
    if (!authUid) {
      teardown('idle')
      return undefined
    }
    const unsubscribe = subscribeToIncomingGroupCalls(authUid, (calls) => {
      const state = groupCallStateRef.current
      if (state !== 'idle') return // already on a call — a second ringing group call is simply not surfaced (busy), matching 1:1's own busy handling
      const ringing = calls.find((c) => c.status === 'ringing' || c.status === 'active')
      if (!ringing) return
      // Never re-show a call I already declined or already left.
      setIncomingGroupCall((prev) => (prev?.id === ringing.id ? prev : ringing))
      if (groupCallStateRef.current === 'idle') setGroupCallState('incoming')
      clearRingTimeout()
      ringTimeoutRef.current = window.setTimeout(() => {
        if (groupCallStateRef.current === 'incoming') {
          setIncomingGroupCall(null)
          setGroupCallState('idle')
        }
      }, RING_TIMEOUT_MS)
    })
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUid])

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      localStreamRef.current?.getAudioTracks().forEach((t) => {
        t.enabled = !next
      })
      if (callIdRef.current && auth.currentUser?.uid) {
        setParticipantMediaState(callIdRef.current, auth.currentUser.uid, { muted: next }).catch(() => {})
      }
      return next
    })
  }, [])

  const toggleCamera = useCallback(() => {
    setCameraOff((prev) => {
      const next = !prev
      localStreamRef.current?.getVideoTracks().forEach((t) => {
        t.enabled = !next
      })
      if (callIdRef.current && auth.currentUser?.uid) {
        setParticipantMediaState(callIdRef.current, auth.currentUser.uid, { cameraOff: next }).catch(() => {})
      }
      return next
    })
  }, [])

  const facingModeRef = useRef('user')
  const [facingMode, setFacingMode] = useState('user')
  const [switchingCamera, setSwitchingCamera] = useState(false)

  // Same replaceTrack approach as useCall.js's 1:1 switchCamera, applied
  // to EVERY active peer connection at once (the actual difference for
  // a mesh — one local track change has to propagate to N connections).
  const switchCamera = useCallback(async () => {
    if (!localStreamRef.current || switchingCamera || typeRef.current !== 'video') return
    setSwitchingCamera(true)
    try {
      const nextFacingMode = facingModeRef.current === 'user' ? 'environment' : 'user'
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: nextFacingMode } })
      const newTrack = newStream.getVideoTracks()[0]
      if (!newTrack) return

      await Promise.all(
        Array.from(peerConnectionsRef.current.values()).map((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video')
          return sender ? sender.replaceTrack(newTrack) : Promise.resolve()
        })
      )

      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0]
      oldVideoTrack?.stop()
      newTrack.enabled = !cameraOff

      const rebuiltStream = new MediaStream([...localStreamRef.current.getAudioTracks(), newTrack])
      setLocalStream(rebuiltStream)
      localStreamRef.current = rebuiltStream
      facingModeRef.current = nextFacingMode
      setFacingMode(nextFacingMode)
    } catch {
      // No second camera, or permission changed mid-call — current camera stays active.
    } finally {
      setSwitchingCamera(false)
    }
  }, [switchingCamera, cameraOff])

  const resetCall = useCallback(() => {
    setGroupCallState('idle')
    setCallError('')
    setActiveGroupCall(null)
  }, [])

  useEffect(() => {
    return () => {
      clearRingTimeout()
      cleanupFnsRef.current.forEach((fn) => fn())
      Array.from(peerConnectionsRef.current.values()).forEach((pc) => pc.close())
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return {
    groupCallState,
    activeGroupCall,
    incomingGroupCall,
    localStream,
    participants,
    remoteStreams,
    muted,
    cameraOff,
    callError,
    facingMode,
    switchingCamera,
    startGroupCall,
    joinGroupCall,
    declineGroupCall,
    leaveGroupCall,
    toggleMute,
    toggleCamera,
    switchCamera,
    resetCall
  }
}
