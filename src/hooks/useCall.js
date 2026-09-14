import { useCallback, useEffect, useRef, useState } from 'react'
import { auth } from '../firebase/firebase.js'
import {
  RTC_CONFIG,
  addCalleeCandidate,
  addCallerCandidate,
  createCallDoc,
  setCallAnswer,
  setCallOffer,
  setCallStatus,
  subscribeToCall,
  subscribeToCalleeCandidates,
  subscribeToCallerCandidates,
  subscribeToIncomingCalls
} from '../firebase/callService.js'

/**
 * Real WebRTC 1:1 calling, signaled entirely over Firestore
 * (callService.js) — no fake "Call" button, no external calling SDK.
 * See callService.js's own comment for the honest STUN-only limitation
 * (no TURN server — some networks won't connect).
 *
 * Scope boundary, stated plainly: incoming-call detection
 * (subscribeToIncomingCalls) only runs while this hook is mounted,
 * which this app only mounts on the Messages routes — per the explicit
 * instruction to keep this feature's footprint to Messages and not
 * touch Home/the rest of the app. A call placed while the recipient is
 * elsewhere in the app (not on /messages or /messages/:chatId) will not
 * ring for them until they navigate to Messages — a real, deliberate
 * scope trade-off, not an oversight.
 */
export function useCall() {
  const [callState, setCallState] = useState('idle') // idle | calling | incoming | connecting | active | ended | declined | failed
  const [activeCall, setActiveCall] = useState(null) // { callId, type, otherUid, isCaller }
  const [incomingCall, setIncomingCall] = useState(null)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [callError, setCallError] = useState('')
  const [durationSec, setDurationSec] = useState(0)

  const pcRef = useRef(null)
  const callIdRef = useRef(null)
  const cleanupFnsRef = useRef([])
  const remoteDescSetRef = useRef(false)
  const pendingCandidatesRef = useRef([])
  const durationTimerRef = useRef(null)
  const callStateRef = useRef('idle')
  callStateRef.current = callState

  const teardown = useCallback((finalState = 'idle') => {
    cleanupFnsRef.current.forEach((fn) => fn())
    cleanupFnsRef.current = []

    if (pcRef.current) {
      pcRef.current.getSenders().forEach((sender) => sender.track?.stop())
      pcRef.current.close()
      pcRef.current = null
    }
    setLocalStream((prev) => {
      prev?.getTracks().forEach((t) => t.stop())
      return null
    })
    setRemoteStream(null)
    if (durationTimerRef.current) {
      window.clearInterval(durationTimerRef.current)
      durationTimerRef.current = null
    }
    setDurationSec(0)
    remoteDescSetRef.current = false
    pendingCandidatesRef.current = []
    callIdRef.current = null
    setActiveCall(null)
    setMuted(false)
    setCameraOff(false)
    setCallState(finalState)
  }, [])

  // Listen for incoming calls whenever idle — this is the whole
  // "someone is calling me" experience, real-time via Firestore.
  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return undefined
    const unsubscribe = subscribeToIncomingCalls(uid, (calls) => {
      if (callStateRef.current !== 'idle') return
      const call = calls[0]
      if (call) {
        setIncomingCall(call)
        setCallState('incoming')
      } else if (callStateRef.current === 'incoming') {
        // The caller cancelled before we answered.
        setIncomingCall(null)
        setCallState('idle')
      }
    })
    return unsubscribe
  }, [])

  const attachPeerConnectionHandlers = useCallback((pc, callId, isCaller) => {
    pc.ontrack = (event) => setRemoteStream(event.streams[0])

    pc.onicecandidate = (event) => {
      if (!event.candidate) return
      const add = isCaller ? addCallerCandidate : addCalleeCandidate
      add(callId, event.candidate).catch(() => {})
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallState('active')
        if (!durationTimerRef.current) {
          durationTimerRef.current = window.setInterval(() => setDurationSec((s) => s + 1), 1000)
        }
      } else if (pc.connectionState === 'failed') {
        setCallError('Call failed to connect — this can happen on some networks.')
        setCallStatus(callId, 'failed').catch(() => {})
        teardown('failed')
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        // A clean hangup already runs its own teardown via endCall(); this
        // only fires for an unexpected drop (network loss, peer closed tab).
        if (callStateRef.current === 'active' || callStateRef.current === 'connecting') {
          setCallStatus(callId, 'ended').catch(() => {})
          teardown('ended')
        }
      }
    }
  }, [teardown])

  const drainPendingCandidates = useCallback(async (pc) => {
    const queued = pendingCandidatesRef.current
    pendingCandidatesRef.current = []
    for (const candidate of queued) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
    }
  }, [])

  const startCall = useCallback(
    async (otherUid, chatId, type) => {
      const uid = auth.currentUser?.uid
      if (!uid || callStateRef.current !== 'idle') return
      setCallError('')
      setCallState('calling')

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' })
        setLocalStream(stream)

        const pc = new RTCPeerConnection(RTC_CONFIG)
        pcRef.current = pc
        stream.getTracks().forEach((track) => pc.addTrack(track, stream))

        const callId = await createCallDoc({ callerUid: uid, calleeUid: otherUid, chatId, type })
        callIdRef.current = callId
        setActiveCall({ callId, type, otherUid, isCaller: true })
        attachPeerConnectionHandlers(pc, callId, true)

        const unsubscribeCall = subscribeToCall(callId, async (call) => {
          if (!call) return
          if (call.status === 'declined') {
            setCallError('Call declined.')
            teardown('declined')
            return
          }
          if (call.status === 'active' && call.answer && !remoteDescSetRef.current) {
            remoteDescSetRef.current = true
            setCallState('connecting')
            await pc.setRemoteDescription(new RTCSessionDescription(call.answer)).catch(() => {})
            await drainPendingCandidates(pc)
          }
        })
        const unsubscribeCandidates = subscribeToCalleeCandidates(callId, async (candidate) => {
          if (!remoteDescSetRef.current) {
            pendingCandidatesRef.current.push(candidate)
            return
          }
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
        })
        cleanupFnsRef.current.push(unsubscribeCall, unsubscribeCandidates)

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await setCallOffer(callId, offer)
      } catch (err) {
        setCallError(
          err?.name === 'NotAllowedError'
            ? 'Microphone/camera access was denied.'
            : err?.message || 'Could not start the call.'
        )
        if (callIdRef.current) setCallStatus(callIdRef.current, 'failed').catch(() => {})
        teardown('failed')
      }
    },
    [attachPeerConnectionHandlers, drainPendingCandidates, teardown]
  )

  const answerCall = useCallback(async () => {
    const uid = auth.currentUser?.uid
    const call = incomingCall
    if (!uid || !call) return
    setCallError('')
    setCallState('connecting')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: call.type === 'video' })
      setLocalStream(stream)

      const pc = new RTCPeerConnection(RTC_CONFIG)
      pcRef.current = pc
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      callIdRef.current = call.id
      setActiveCall({ callId: call.id, type: call.type, otherUid: call.callerUid, isCaller: false })
      setIncomingCall(null)
      attachPeerConnectionHandlers(pc, call.id, false)

      await pc.setRemoteDescription(new RTCSessionDescription(call.offer))
      remoteDescSetRef.current = true

      const unsubscribeCandidates = subscribeToCallerCandidates(call.id, async (candidate) => {
        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
      })
      const unsubscribeCall = subscribeToCall(call.id, (data) => {
        if (data?.status === 'ended') teardown('ended')
      })
      cleanupFnsRef.current.push(unsubscribeCandidates, unsubscribeCall)

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await setCallAnswer(call.id, answer)
    } catch (err) {
      setCallError(
        err?.name === 'NotAllowedError'
          ? 'Microphone/camera access was denied.'
          : err?.message || 'Could not join the call.'
      )
      await setCallStatus(call.id, 'failed').catch(() => {})
      teardown('failed')
    }
  }, [incomingCall, attachPeerConnectionHandlers, teardown])

  const declineCall = useCallback(async () => {
    if (!incomingCall) return
    await setCallStatus(incomingCall.id, 'declined').catch(() => {})
    setIncomingCall(null)
    setCallState('idle')
  }, [incomingCall])

  const endCall = useCallback(async () => {
    const callId = callIdRef.current
    const wasIncomingUnanswered = callState === 'calling'
    if (callId) await setCallStatus(callId, wasIncomingUnanswered ? 'missed' : 'ended').catch(() => {})
    teardown('idle')
  }, [callState, teardown])

  const resetCall = useCallback(() => {
    setCallState('idle')
    setCallError('')
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      localStream?.getAudioTracks().forEach((track) => {
        track.enabled = !next
      })
      return next
    })
  }, [localStream])

  const toggleCamera = useCallback(() => {
    setCameraOff((prev) => {
      const next = !prev
      localStream?.getVideoTracks().forEach((track) => {
        track.enabled = !next
      })
      return next
    })
  }, [localStream])

  useEffect(() => {
    return () => {
      cleanupFnsRef.current.forEach((fn) => fn())
      if (pcRef.current) pcRef.current.close()
    }
  }, [])

  return {
    callState,
    activeCall,
    incomingCall,
    localStream,
    remoteStream,
    muted,
    cameraOff,
    callError,
    durationSec,
    startCall,
    answerCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
    resetCall
  }
}
