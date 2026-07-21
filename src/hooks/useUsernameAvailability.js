import { useEffect, useRef, useState } from 'react'
import { checkUsernameAvailable, normalizeUsername, validateUsername } from '../firebase/usernameService.js'

const DEBOUNCE_MS = 500

/**
 * Live username availability status for a raw input value, relative to
 * `currentUsername` (the signed-in user's existing username — pass '' or
 * omit for a brand-new profile that has none yet).
 *
 * status: 'idle' | 'invalid' | 'checking' | 'available' | 'taken' | 'unchanged' | 'error'
 *
 * Debounces the actual Firestore read by DEBOUNCE_MS so it never fires
 * on every keystroke, and guards against out-of-order responses: if the
 * user keeps typing, an in-flight check that resolves late is discarded
 * rather than overwriting a newer keystroke's result.
 */
export function useUsernameAvailability(rawInput, currentUsername = '') {
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const requestIdRef = useRef(0)

  useEffect(() => {
    const normalized = normalizeUsername(rawInput)
    const normalizedCurrent = normalizeUsername(currentUsername)

    // Invalidate any in-flight check from a previous keystroke.
    requestIdRef.current += 1

    if (!normalized) {
      setStatus('idle')
      setMessage('')
      return undefined
    }

    const { valid, error } = validateUsername(normalized)
    if (!valid) {
      setStatus('invalid')
      setMessage(error)
      return undefined
    }

    if (normalized === normalizedCurrent) {
      setStatus('unchanged')
      setMessage('')
      return undefined
    }

    setStatus('checking')
    setMessage('Checking username...')

    const requestId = requestIdRef.current
    const timer = window.setTimeout(async () => {
      try {
        const available = await checkUsernameAvailable(normalized)
        if (requestIdRef.current !== requestId) return
        setStatus(available ? 'available' : 'taken')
        setMessage(available ? 'Available' : 'Username already taken')
      } catch {
        if (requestIdRef.current !== requestId) return
        setStatus('error')
        setMessage('Network error — try again')
      }
    }, DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [rawInput, currentUsername])

  const normalized = normalizeUsername(rawInput)
  const isSubmittable = status === 'available' || status === 'unchanged'

  return { status, message, normalized, isSubmittable }
}