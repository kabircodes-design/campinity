import { useCallback, useEffect, useRef, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase/firebase.js'
import { sendCallSummaryMessage } from '../firebase/chatService.js'
import { getMediaConstraints, applyBitrateLimits } from './callMedia.js'
import {
  RTC_CONFIG,
  addCalleeCandidate,
  addCallerCandidate,
  createCallDoc,
  setCallAnswer,
  setCallMediaState,
  setCallOffer,
  setCallStatus,
  subscribeToCall,
  subscribeToCalleeCandidates,
  subscribeToCallerCandidates,
  subscribeToIncomingCalls
} from '../firebase/callService.js'

const RING_TIMEOUT_MS = 45000
const CONNECT_TIMEOUT_MS = 20000
// How long a 'disconnected' peer connection is given to self-recover
// (the ICE agent keeps probing on its own during this state — this is
// not idle waiting, see attachPeerConnectionHandlers' own comment)
// before this is treated as a genuine, permanent drop.
const RECONNECT_GRACE_MS = 12000

/**
 * Real WebRTC 1:1 calling, signaled entirely over Firestore
 * (callService.js) — no fake "Call" button, no external calling SDK.
 * See callService.js's own comment for the honest STUN-only limitation
 * (no TURN server — some networks won't connect).
 *
 * This hook is now mounted EXACTLY ONCE for the whole app, by
 * CallContext.jsx's CallProvider in main.jsx (above <App/>/<Routes/>),
 * not per-page. Two real bugs that came from the old per-page mounting
 * are fixed by that move alone:
 *  1. "Calls not reaching the other user" — incoming-call detection
 *     (subscribeToIncomingCalls) used to only run while the recipient
 *     happened to be on a Messages route. Mounted at the app root, it
 *     now runs for the whole authenticated session, from any page.
 *  2. "Recipient's whole app freezes during a call" — durationSec used
 *     to tick every second INSIDE whichever page component called
 *     useCall() (ChatPage, which also owns the full message-list
 *     state), re-rendering that entire page every second. Now the only
 *     things that ever re-render on a tick are CallProvider's own small
 *     overlay components — every page (Home, ChatPage, everything) is
 *     insulated via React's children-prop-stability (see CallContext.jsx).
 *
 * Reactive uid (onAuthStateChanged) replaces a one-time
 * `auth.currentUser?.uid` read — necessary now that this hook can mount
 * before login resolves; also fixes "call state persisting after
 * logout" by hard-resetting on sign-out.
 */
export function useCall() {
  const [callState, setCallState] = useState('idle') // idle | calling | incoming | connecting | active | reconnecting | ended | declined | missed | failed
  const [activeCall, setActiveCall] = useState(null) // { callId, chatId, type, otherUid, isCaller }
  const [incomingCall, setIncomingCall] = useState(null)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [remoteMuted, setRemoteMuted] = useState(false)
  const [remoteCameraOff, setRemoteCameraOff] = useState(false)
  const [callError, setCallError] = useState('')
  const [durationSec, setDurationSec] = useState(0)

  const pcRef = useRef(null)
  const callIdRef = useRef(null)
  const cleanupFnsRef = useRef([])
  const remoteDescSetRef = useRef(false)
  const pendingCandidatesRef = useRef([])
  const durationTimerRef = useRef(null)
  const ringTimeoutRef = useRef(null)
  const connectTimeoutRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const callStateRef = useRef('idle')
  const activeCallRef = useRef(null)
  const durationSecRef = useRef(0)
  const incomingCallRef = useRef(null)
  callStateRef.current = callState
  activeCallRef.current = activeCall
  durationSecRef.current = durationSec
  incomingCallRef.current = incomingCall

  const clearRingTimeout = () => {
    if (ringTimeoutRef.current) {
      window.clearTimeout(ringTimeoutRef.current)
      ringTimeoutRef.current = null
    }
  }
  const clearConnectTimeout = () => {
    if (connectTimeoutRef.current) {
      window.clearTimeout(connectTimeoutRef.current)
      connectTimeoutRef.current = null
    }
  }
  const clearReconnectTimeout = () => {
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }

  const teardown = useCallback((finalState = 'idle') => {
    clearRingTimeout()
    clearConnectTimeout()
    clearReconnectTimeout()
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

    // Post a real call-summary message into the chat — only the caller
    // side does this (both sides eventually reach teardown for the
    // same call, so posting from only one guarantees exactly one
    // message, not a duplicate from each participant).
    const finishedCall = activeCallRef.current
    const finishedDuration = durationSecRef.current
    if (finishedCall?.isCaller && finishedCall?.chatId && ['ended', 'missed', 'declined'].includes(finalState)) {
      const uid = auth.currentUser?.uid
      if (uid) {
        sendCallSummaryMessage(finishedCall.chatId, uid, {
          callType: finishedCall.type,
          callDurationSec: finishedDuration,
          callOutcome: finalState === 'ended' ? 'completed' : finalState
        }).catch(() => {})
      }
    }

    setDurationSec(0)
    remoteDescSetRef.current = false
    pendingCandidatesRef.current = []
    callIdRef.current = null
    // Keep `activeCall` (who the call was with, its type) around
    // through a terminal state — CallOverlay shows "Call ended" etc.
    // for a couple of seconds after this and needs the name/avatar to
    // still be there. Only actually cleared once resetCall() returns
    // to idle. (finalState === 'idle' happens on sign-out / unmount,
    // where there's no terminal screen to show at all — safe to clear
    // immediately there.)
    if (finalState === 'idle') setActiveCall(null)
    setMuted(false)
    setCameraOff(false)
    setRemoteMuted(false)
    setRemoteCameraOff(false)
    facingModeRef.current = 'user'
    setFacingMode('user')
    setCallState(finalState)
  }, [])

  // Reactive uid — see the file comment above for why a one-time read
  // isn't enough now that this hook can mount before login resolves.
  const [authUid, setAuthUid] = useState(() => auth.currentUser?.uid || null)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => setAuthUid(user?.uid || null))
    return unsubscribe
  }, [])

  // Listen for incoming calls whenever idle — this is the whole
  // "someone is calling me" experience, real-time via Firestore.
  // Re-subscribes on every sign-in/out, and hard-resets any in-progress
  // call on sign-out so nothing lingers past logout.
  useEffect(() => {
    if (!authUid) {
      teardown('idle')
      return undefined
    }
    const unsubscribe = subscribeToIncomingCalls(authUid, (calls) => {
      const state = callStateRef.current

      // Bug fix: the previous version guarded this whole callback with
      // `if (state !== 'idle') return` BEFORE ever checking whether the
      // currently-shown incoming call had disappeared — which made the
      // "caller cancelled before we answered" clearing branch below it
      // structurally unreachable (by the time it could run, `state`
      // was already proven to be 'idle', never 'incoming'). A ringing
      // UI could get stuck forever if the caller hung up first. Fixed
      // by checking the 'incoming' case on its own, first.
      if (state === 'incoming') {
        const currentId = incomingCallRef.current?.id
        const freshCall = calls.find((c) => c.id === currentId)
        const stillRinging = Boolean(freshCall)
        if (!stillRinging) {
          setIncomingCall(null)
          setCallState('idle')
        } else {
          // ROOT CAUSE of the "setRemoteDescription: type null" crash:
          // createCallDoc() writes offer:null in the SAME setDoc that
          // sets status:'ringing', so this listener's very first
          // snapshot (the one that actually triggers setIncomingCall
          // below) can fire before the caller's own follow-up
          // setCallOffer() write lands. Previously incomingCall was
          // only ever set ONCE per call — every later snapshot for an
          // already-"incoming" call only checked stillRinging, so a
          // callee who answered quickly could still be holding a
          // frozen `offer: null`. Refreshing incomingCall on every
          // snapshot while still ringing means answerCall() always
          // reads whatever the live document's offer actually is by
          // the time the user taps Accept.
          setIncomingCall(freshCall)
        }
        // A second, simultaneous caller gets an immediate "busy"
        // instead of silently vanishing or randomly replacing the call
        // already on screen — this query has no orderBy, so calls[0]
        // isn't stable across snapshots once more than one ringing
        // call exists for the same person.
        calls.filter((c) => c.id !== currentId).forEach((c) => setCallStatus(c.id, 'busy').catch(() => {}))
        return
      }

      if (state !== 'idle') {
        // Already on an active/connecting call of our own — tell any
        // new caller we're busy instead of leaving them on "Calling…"
        // forever.
        calls.forEach((c) => setCallStatus(c.id, 'busy').catch(() => {}))
        return
      }

      const call = calls[0]
      if (call) {
        setIncomingCall(call)
        setCallState('incoming')
      }
    })
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUid])

  const attachPeerConnectionHandlers = useCallback((pc, callId, isCaller) => {
    pc.ontrack = (event) => setRemoteStream(event.streams[0])

    pc.onicecandidate = (event) => {
      if (!event.candidate) return
      const add = isCaller ? addCallerCandidate : addCalleeCandidate
      add(callId, event.candidate).catch(() => {})
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        clearConnectTimeout()
        // Recovered from a network blip — cancel the pending "give up"
        // timer and go back to a normal active call instead of tearing
        // down. If this is the FIRST time reaching 'connected', this is
        // just the normal connect path (reconnectTimeoutRef was never
        // armed, clearReconnectTimeout is a harmless no-op).
        clearReconnectTimeout()
        setCallState('active')
        if (!durationTimerRef.current) {
          durationTimerRef.current = window.setInterval(() => setDurationSec((s) => s + 1), 1000)
        }
      } else if (pc.connectionState === 'failed') {
        clearReconnectTimeout()
        setCallError('Call failed to connect — this can happen on some networks.')
        setCallStatus(callId, 'failed').catch(() => {})
        teardown('failed')
      } else if (pc.connectionState === 'disconnected') {
        // ROOT-CAUSE FIX for "any network blip instantly kills the call":
        // 'disconnected' is not terminal — the ICE agent keeps probing
        // existing candidate pairs on its own during this state and very
        // often recovers within a few seconds on a real network hiccup
        // (brief Wi-Fi drop, switching between Wi-Fi and mobile data,
        // etc.), moving back to 'connected' without any app intervention.
        // This used to treat 'disconnected' exactly like 'closed' —
        // immediate teardown — killing perfectly recoverable calls. Now
        // it only starts a grace-period timer and shows "Reconnecting…"
        // (see CallOverlay.jsx); only if the connection is STILL not
        // back to 'connected' after RECONNECT_GRACE_MS is this treated
        // as a real, permanent drop.
        if (callStateRef.current === 'active' || callStateRef.current === 'reconnecting') {
          setCallState('reconnecting')
          clearReconnectTimeout()
          reconnectTimeoutRef.current = window.setTimeout(() => {
            if (pc.connectionState === 'connected') return
            setCallError('Connection lost.')
            setCallStatus(callId, 'ended').catch(() => {})
            teardown('ended')
          }, RECONNECT_GRACE_MS)
        }
      } else if (pc.connectionState === 'closed') {
        // A clean hangup already runs its own teardown via endCall() —
        // this only fires for a connection the app itself didn't already
        // tear down (e.g. the remote peer closed abruptly).
        clearReconnectTimeout()
        if (callStateRef.current === 'active' || callStateRef.current === 'connecting' || callStateRef.current === 'reconnecting') {
          setCallStatus(callId, 'ended').catch(() => {})
          teardown('ended')
        }
      }
    }
  }, [teardown])

  const armConnectTimeout = useCallback((callId) => {
    clearConnectTimeout()
    connectTimeoutRef.current = window.setTimeout(() => {
      if (callStateRef.current !== 'connecting') return
      setCallError('Could not connect — check your network and try again.')
      setCallStatus(callId, 'failed').catch(() => {})
      teardown('failed')
    }, CONNECT_TIMEOUT_MS)
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
      // Set immediately, BEFORE the async getUserMedia() call below —
      // this is the actual fix for the "blank page on call" bug: the
      // overlay switches from idle to visible the instant callState
      // changes (synchronous), but getUserMedia's permission prompt can
      // take real, user-paced time to resolve. Previously activeCall
      // stayed null for that whole window, so CallOverlay rendered with
      // otherUid=null, and getAvatarColor(null) threw (its `seed = ''`
      // default only covers `undefined`, not an explicit null) —
      // crashing the render with no error boundary to catch it, which
      // is what a blank/white screen actually was. callId is filled in
      // below once createCallDoc resolves; every other field callers
      // need (who, chat, type) is already known synchronously and has
      // no reason to wait on network calls.
      setActiveCall({ callId: null, chatId, type, otherUid, isCaller: true })

      try {
        const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints({ isVideo: type === 'video' }))
        setLocalStream(stream)

        const pc = new RTCPeerConnection(RTC_CONFIG)
        pcRef.current = pc
        stream.getTracks().forEach((track) => pc.addTrack(track, stream))
        applyBitrateLimits(pc)

        const callId = await createCallDoc({ callerUid: uid, calleeUid: otherUid, chatId, type })
        callIdRef.current = callId
        setActiveCall({ callId, chatId, type, otherUid, isCaller: true })
        attachPeerConnectionHandlers(pc, callId, true)

        // Unanswered calls must not ring forever — 45s, then a real
        // "missed call" outcome for both sides.
        clearRingTimeout()
        ringTimeoutRef.current = window.setTimeout(() => {
          if (callStateRef.current !== 'calling') return
          setCallStatus(callId, 'missed').catch(() => {})
          teardown('missed')
        }, RING_TIMEOUT_MS)

        const unsubscribeCall = subscribeToCall(callId, async (call) => {
          if (!call) return
          // The callee's own reported state — real signaling, not a
          // guess from a frozen video frame (see callService.js's
          // setCallMediaState comment for why this field pair exists).
          setRemoteMuted(Boolean(call.calleeMuted))
          setRemoteCameraOff(Boolean(call.calleeCameraOff))
          if (call.status === 'declined') {
            setCallError('Call declined.')
            teardown('declined')
            return
          }
          if (call.status === 'busy') {
            setCallError("They're on another call right now.")
            teardown('declined')
            return
          }
          // ROOT CAUSE of "if the other person ends the call, my call UI/
          // timer keeps running": answerCall()'s own subscription already
          // had this exact check (`data?.status === 'ended'`) — this one,
          // the CALLER's side, never did. So when the CALLEE hung up
          // first, this listener received status:'ended' and matched none
          // of the branches above, doing nothing with it. The caller only
          // ever noticed via pc.onconnectionstatechange eventually
          // reporting 'disconnected'/'closed' — real, but slow and not
          // guaranteed to fire promptly, since closing a peer connection
          // doesn't reliably push anything to the remote side. Now
          // symmetric with answerCall(): whichever side ends the call,
          // the other tears down immediately via the same signaling
          // channel, not by waiting on ICE to notice.
          if (call.status === 'ended' && callStateRef.current !== 'idle' && callStateRef.current !== 'ended') {
            teardown('ended')
            return
          }
          if (call.status === 'active' && call.answer?.type && call.answer?.sdp && !remoteDescSetRef.current) {
            remoteDescSetRef.current = true
            clearRingTimeout()
            setCallState('connecting')
            armConnectTimeout(callId)
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(call.answer))
              await drainPendingCandidates(pc)
            } catch {
              setCallError("Couldn't connect the call. Please try again.")
              await setCallStatus(callId, 'failed').catch(() => {})
              teardown('failed')
            }
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
            : err?.name === 'NotFoundError'
              ? type === 'video'
                ? 'No camera found on this device.'
                : 'No microphone found on this device.'
              : err?.message || 'Could not start the call.'
        )
        if (callIdRef.current) setCallStatus(callIdRef.current, 'failed').catch(() => {})
        teardown('failed')
      }
    },
    [attachPeerConnectionHandlers, armConnectTimeout, drainPendingCandidates, teardown]
  )

  const answerCall = useCallback(async () => {
    const uid = auth.currentUser?.uid
    const call = incomingCall
    if (!uid || !call) return
    setCallError('')
    setCallState('connecting')
    // Same fix as startCall() — set BEFORE the async getUserMedia() call,
    // not after. `call` (the incoming-call doc) already has everything
    // needed (callerUid/chatId/type), so there's no reason CallOverlay
    // should ever render with a null otherUid on this path either.
    setActiveCall({ callId: call.id, chatId: call.chatId, type: call.type, otherUid: call.callerUid, isCaller: false })
    setIncomingCall(null)
    // Also set early (not just after getUserMedia resolves) so endCall()
    // can still notify Firestore correctly if the callee backs out while
    // the permission prompt is still up.
    callIdRef.current = call.id

    try {
      const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints({ isVideo: call.type === 'video' }))
      setLocalStream(stream)

      const pc = new RTCPeerConnection(RTC_CONFIG)
      pcRef.current = pc
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))
      applyBitrateLimits(pc)

      attachPeerConnectionHandlers(pc, call.id, false)
      armConnectTimeout(call.id)

      // Belt-and-suspenders per the signaling-safety requirement: never
      // hand a missing/malformed description to the WebRTC API (that's
      // what produced the raw "Failed to read the 'type' property...
      // null is not a valid enum value" browser error before). The
      // incoming-call listener above now keeps `incomingCall` (and
      // therefore `call`) refreshed with the live Firestore doc while
      // still ringing, so `call.offer` should already be populated by
      // the time the user taps Accept — but if it somehow still isn't
      // (e.g. a very fast tap racing the caller's own offer write),
      // fail cleanly here instead of letting the constructor throw a
      // raw browser error up through the catch block below.
      if (!call.offer?.type || !call.offer?.sdp) {
        throw new Error("Couldn't connect the call. Please try again.")
      }
      await pc.setRemoteDescription(new RTCSessionDescription(call.offer))
      remoteDescSetRef.current = true

      const unsubscribeCandidates = subscribeToCallerCandidates(call.id, async (candidate) => {
        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
      })
      const unsubscribeCall = subscribeToCall(call.id, (data) => {
        if (!data) return
        // The caller's own reported state — same reasoning as the
        // caller-side listener's symmetric read of callee* fields above.
        setRemoteMuted(Boolean(data.callerMuted))
        setRemoteCameraOff(Boolean(data.callerCameraOff))
        if (data.status === 'ended') teardown('ended')
      })
      cleanupFnsRef.current.push(unsubscribeCandidates, unsubscribeCall)

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await setCallAnswer(call.id, answer)
    } catch (err) {
      setCallError(
        err?.name === 'NotAllowedError'
          ? 'Microphone/camera access was denied.'
          : err?.name === 'NotFoundError'
            ? call.type === 'video'
              ? 'No camera found on this device.'
              : 'No microphone found on this device.'
            : err?.message || 'Could not join the call.'
      )
      await setCallStatus(call.id, 'failed').catch(() => {})
      teardown('failed')
    }
  }, [incomingCall, attachPeerConnectionHandlers, armConnectTimeout, teardown])

  const declineCall = useCallback(async () => {
    if (!incomingCall) return
    await setCallStatus(incomingCall.id, 'declined').catch(() => {})
    setIncomingCall(null)
    setCallState('idle')
  }, [incomingCall])

  const endCall = useCallback(async () => {
    const callId = callIdRef.current
    const wasUnanswered = callState === 'calling'
    const finalState = wasUnanswered ? 'missed' : 'ended'
    if (callId) await setCallStatus(callId, finalState).catch(() => {})
    teardown(finalState)
  }, [callState, teardown])

  const resetCall = useCallback(() => {
    setCallState('idle')
    setCallError('')
    setActiveCall(null)
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      localStream?.getAudioTracks().forEach((track) => {
        track.enabled = !next
      })
      if (callIdRef.current) {
        setCallMediaState(callIdRef.current, Boolean(activeCallRef.current?.isCaller), { muted: next }).catch(() => {})
      }
      return next
    })
  }, [localStream])

  const toggleCamera = useCallback(() => {
    setCameraOff((prev) => {
      const next = !prev
      localStream?.getVideoTracks().forEach((track) => {
        track.enabled = !next
      })
      if (callIdRef.current) {
        setCallMediaState(callIdRef.current, Boolean(activeCallRef.current?.isCaller), { cameraOff: next }).catch(() => {})
      }
      return next
    })
  }, [localStream])

  const facingModeRef = useRef('user')
  // Mirrors facingModeRef into real state — the ref alone (read
  // synchronously inside switchCamera, avoiding a stale closure across
  // the async getUserMedia() call) never triggers a re-render, so
  // CallOverlay had no way to know when to mirror the local preview.
  // Front camera ('user') is the conventional default for every video
  // call (starting getUserMedia has no facingMode constraint at all —
  // browsers already default to front on a phone), so this starts
  // matching that same assumption.
  const [facingMode, setFacingMode] = useState('user')
  const [switchingCamera, setSwitchingCamera] = useState(false)

  // Front/back camera switch — additive, doesn't touch signaling at all:
  // acquires one fresh video-only track with the opposite facingMode,
  // swaps it into the EXISTING peer connection via replaceTrack() (the
  // standard WebRTC way to change a track mid-call with no renegotiation,
  // no new offer/answer), and rebuilds localStream as a new MediaStream
  // so the local preview <video> (keyed off localStream in CallOverlay)
  // actually updates. Only ever active while a video call is live — a
  // device with just one camera simply rejects the new getUserMedia
  // constraint, caught below, current camera stays untouched.
  const switchCamera = useCallback(async () => {
    if (!pcRef.current || !localStream || switchingCamera) return
    const type = activeCallRef.current?.type
    if (type !== 'video') return

    setSwitchingCamera(true)
    // ROOT CAUSE of "switch camera UI exists but does nothing": a plain
    // `{ facingMode: 'environment' }` constraint is only a HINT, not a
    // requirement — per spec, if a device doesn't have a camera facing
    // that direction, browsers are allowed to silently substitute
    // whatever camera IS available instead of rejecting the request.
    // getUserMedia() then resolves successfully with a track that's
    // often just the SAME camera again, so replaceTrack() "succeeds"
    // with no visible change and no error to catch — indistinguishable
    // from a no-op. `{ exact: ... }` forces the browser to genuinely
    // reject (a real caught error, handled below) when that facing
    // camera truly isn't available, instead of quietly pretending.
    const nextFacingMode = facingModeRef.current === 'user' ? 'environment' : 'user'
    let newStream
    try {
      newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: nextFacingMode } } })
    } catch {
      // Some browsers still don't honor `exact` correctly for facingMode
      // (notably older Android WebViews) and throw even when a second
      // camera genuinely exists. One retry with the plain hint — if THIS
      // also fails, there's truly no second camera, handled below.
      try {
        newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: nextFacingMode } })
      } catch (err) {
        setCallError(err?.name === 'NotAllowedError' ? 'Camera access was denied.' : "This device doesn't have another camera to switch to.")
        setSwitchingCamera(false)
        return
      }
    }

    try {
      const newTrack = newStream.getVideoTracks()[0]
      if (!newTrack) return

      const sender = pcRef.current.getSenders().find((s) => s.track && s.track.kind === 'video')
      if (sender) await sender.replaceTrack(newTrack)

      const oldVideoTrack = localStream.getVideoTracks()[0]
      oldVideoTrack?.stop()
      newTrack.enabled = !cameraOff

      const rebuiltStream = new MediaStream([...localStream.getAudioTracks(), newTrack])
      setLocalStream(rebuiltStream)
      facingModeRef.current = nextFacingMode
      setFacingMode(nextFacingMode)
    } catch {
      newStream.getTracks().forEach((t) => t.stop())
      setCallError('Could not switch cameras. Please try again.')
    } finally {
      setSwitchingCamera(false)
    }
  }, [localStream, switchingCamera, cameraOff])

  useEffect(() => {
    return () => {
      clearRingTimeout()
      clearConnectTimeout()
      clearReconnectTimeout()
      cleanupFnsRef.current.forEach((fn) => fn())
      if (pcRef.current) pcRef.current.close()
    }
  }, [])

  // Best-effort stale-call cleanup on refresh/tab-close/navigation-away.
  // Real gap this closes: neither this hook nor teardown() had ANY
  // beforeunload/pagehide handling before — an ungraceful tab close
  // during a ringing or active call left the Firestore call doc stuck
  // at 'ringing'/'active' forever (nothing else in this app — no
  // scheduled Cloud Function — sweeps stale call documents). `pagehide`
  // is used rather than `beforeunload` (more reliable on mobile
  // Safari/Chrome, doesn't block navigation with a confirmation
  // dialog). This is explicitly a BEST-EFFORT mitigation, not a
  // guarantee — a fire-and-forget Firestore write issued as the page is
  // torn down can still lose the race against actual process
  // termination, especially on an abrupt tab kill rather than a normal
  // navigation/refresh. Not awaited, since a pagehide handler cannot
  // reliably wait on an async operation.
  useEffect(() => {
    const handlePageHide = () => {
      const state = callStateRef.current
      const callId = callIdRef.current
      if (state === 'incoming' && incomingCallRef.current) {
        setCallStatus(incomingCallRef.current.id, 'declined').catch(() => {})
      } else if (callId && (state === 'calling' || state === 'connecting' || state === 'active' || state === 'reconnecting')) {
        setCallStatus(callId, state === 'calling' ? 'missed' : 'ended').catch(() => {})
      }
    }
    window.addEventListener('pagehide', handlePageHide)
    return () => window.removeEventListener('pagehide', handlePageHide)
  }, [])

  return {
    callState,
    activeCall,
    incomingCall,
    localStream,
    remoteStream,
    muted,
    cameraOff,
    remoteMuted,
    remoteCameraOff,
    callError,
    durationSec,
    startCall,
    answerCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
    switchCamera,
    switchingCamera,
    facingMode,
    resetCall
  }
}
