import { useEffect, useState } from 'react'

/**
 * Real, feature-detected audio-output switching for calls — NOT a fake
 * speaker/earpiece toggle. There is no cross-browser API that exposes
 * "earpiece vs loudspeaker" as a concept (confirmed: no such control
 * exists in the Web platform), so this deliberately does not pretend to
 * offer one. What genuinely exists and is safe to use is
 * HTMLMediaElement.setSinkId() + enumerateDevices()'s real
 * 'audiooutput' list — supported on desktop Chrome/Edge and Android
 * Chrome, NOT on Safari/iOS (no setSinkId at all there). Where
 * unsupported, `supported` is false and callers must not render any
 * control — the platform's own default output applies, unmodified.
 */
export function useAudioOutputDevices() {
  const [supported, setSupported] = useState(false)
  const [devices, setDevices] = useState([])

  useEffect(() => {
    const isSupported =
      typeof HTMLMediaElement !== 'undefined' &&
      'setSinkId' in HTMLMediaElement.prototype &&
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices?.enumerateDevices
    setSupported(Boolean(isSupported))
    if (!isSupported) return undefined

    let cancelled = false
    const refresh = () => {
      navigator.mediaDevices
        .enumerateDevices()
        .then((list) => {
          if (!cancelled) setDevices(list.filter((d) => d.kind === 'audiooutput'))
        })
        .catch(() => {})
    }
    refresh()
    // Devices can change mid-call (headphones plugged in/out) — a real
    // browser event, not polling.
    navigator.mediaDevices.addEventListener?.('devicechange', refresh)
    return () => {
      cancelled = true
      navigator.mediaDevices.removeEventListener?.('devicechange', refresh)
    }
  }, [])

  return { supported, devices }
}

/** Applies a chosen output device to every given media element — never throws, best-effort per element (a call must never break because one element's setSinkId rejected). */
export async function applySinkId(mediaElements, deviceId) {
  await Promise.all(
    mediaElements.filter(Boolean).map((el) => el.setSinkId?.(deviceId).catch(() => {}))
  )
}
