import { getFunctions, httpsCallable } from 'firebase/functions'
import { attachDeviceProof } from '../security/requestProof.js'

/**
 * Every privileged admin call goes through here. Calls that carry a
 * sessionToken are signed by this device's key (deviceProof) — the server
 * refuses them otherwise. If the server says the session is no longer
 * valid (expired, revoked device, signed out elsewhere), the whole panel
 * locks via the 'campinity-admin:session-ended' event.
 */
export const SESSION_ENDED_EVENT = 'campinity-admin:session-ended'

/**
 * A callable that isn't deployed answers 404 (functions/not-found) — or,
 * because the browser's CORS preflight fails first, a bare 'internal'.
 * Turn that into a message an admin can act on instead of "internal".
 * Authorization errors are untouched.
 */
export function explainMissingFunction(name, err) {
  const missing = err?.code === 'functions/not-found' || (err?.code === 'functions/internal' && /^internal$/i.test(err?.message || ''))
  if (!missing) return err
  const e = new Error(`This feature isn't available on the server yet (${name} is not deployed).`)
  e.code = err.code
  e.notDeployed = true
  return e
}

export async function callAdmin(name, data) {
  const body = data && data.sessionToken ? await attachDeviceProof(data) : data
  try {
    const result = await httpsCallable(getFunctions(), name)(body)
    return result.data
  } catch (err) {
    if (data && data.sessionToken && err?.code === 'functions/unauthenticated') {
      window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT, { detail: { message: err.message } }))
    }
    throw explainMissingFunction(name, err)
  }
}

/** Unsigned call for the sign-in / enrollment steps (no session yet). */
export async function callAdminPublic(name, data) {
  const result = await httpsCallable(getFunctions(), name)(data || {})
  return result.data
}
