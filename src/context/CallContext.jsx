import { createContext, useContext, useMemo } from 'react'
import { useCall } from '../hooks/useCall.js'
import IncomingCallToast from '../components/IncomingCallToast.jsx'
import CallOverlay from '../components/CallOverlay.jsx'

const CallActionsContext = createContext(null)

/**
 * THE fix for two real bugs at once:
 *
 * 1. "Calling another user does not reach them" — useCall() used to be
 *    called directly inside MessagesPage.jsx and ChatPage.jsx, so
 *    incoming-call detection only ran while the recipient happened to
 *    be on a Messages route. Mounted here instead (in main.jsx, above
 *    <App/>/<Routes/> — same pattern as PostingStatusProvider), it runs
 *    for the entire authenticated session regardless of which page is
 *    open.
 *
 * 2. "Recipient's whole app freezes during a call" — useCall()'s
 *    durationSec ticks every second for the length of an active call.
 *    When the hook lived inside ChatPage (which also owns the full
 *    message-list state), every tick re-rendered that entire page —
 *    hundreds of message bubbles, scroll effects, everything — once a
 *    second. Here, `children` (the app's actual routed pages) is a prop
 *    this component receives from ITS OWN parent in main.jsx and never
 *    creates itself — so when useCall()'s internal state changes and
 *    CallProvider re-renders, `children`'s element reference is
 *    unchanged and React bails out of re-rendering that entire subtree.
 *    Only CallOverlay/IncomingCallToast (rendered directly here, as real
 *    children of THIS component) ever re-render on a tick — a small,
 *    cheap, fully isolated part of the tree, never Home/ChatPage/
 *    Marketplace/anything else.
 *
 * Pages only ever consume useCallActions() — `startCall` (a stable
 * function reference) and `isBusy` (a boolean that changes only at
 * call start/end, not every second) — never the fast-changing call
 * state itself, so a page that just shows a "Call" button in its
 * header doesn't re-render on every duration tick either.
 */
export function CallProvider({ children }) {
  const call = useCall()
  const isBusy = call.callState !== 'idle'

  // Memoized on the DERIVED boolean, not the raw callState string —
  // callState changes on every transition (calling → connecting →
  // active → ended), which would otherwise hand consumers a new
  // `actions` object (and re-render them) several times per call even
  // though `isBusy` itself only flips twice: true at call start, false
  // again once the terminal screen auto-dismisses back to idle.
  const actions = useMemo(() => ({ startCall: call.startCall, isBusy }), [call.startCall, isBusy])

  return (
    <CallActionsContext.Provider value={actions}>
      {children}
      {call.callState === 'incoming' ? <IncomingCallToast call={call} /> : <CallOverlay call={call} />}
    </CallActionsContext.Provider>
  )
}

export function useCallActions() {
  const context = useContext(CallActionsContext)
  if (!context) {
    throw new Error('useCallActions must be used within a CallProvider')
  }
  return context
}
