import { useEffect, useRef } from 'react'

/**
 * Open overlays (sheets, dialogs, modals, viewers) register a close
 * function here while they're open. Android's hardware Back
 * (useAndroidBackButton) closes the most recently opened one first and
 * only navigates when nothing is open — previously Back always
 * navigated, leaving the page underneath with the sheet still mounted
 * or, worse, losing the page the sheet belonged to.
 *
 * Browser Back is unaffected (this is only consulted by the native
 * listener). The keyboard is handled by Android itself before the app
 * ever receives Back, so dismissing the keyboard still comes first.
 */
const stack = []

export function pushOverlay(close) {
  const entry = { close }
  stack.push(entry)
  return () => {
    const index = stack.indexOf(entry)
    if (index !== -1) stack.splice(index, 1)
  }
}

/** Closes the top-most open overlay. Returns true if one was closed. */
export function closeTopOverlay() {
  const top = stack[stack.length - 1]
  if (!top) return false
  try {
    top.close()
  } catch {
    // A misbehaving close handler must not break Back entirely.
    const index = stack.indexOf(top)
    if (index !== -1) stack.splice(index, 1)
    return false
  }
  return true
}

export function openOverlayCount() {
  return stack.length
}

/**
 * Registers `onClose` for Android Back while `open` is true. The latest
 * onClose is always used (ref), and registration happens once per open,
 * not on every render.
 */
export function useBackToClose(open, onClose) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    if (!open) return undefined
    return pushOverlay(() => onCloseRef.current?.())
  }, [open])
}
