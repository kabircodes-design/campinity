/**
 * REBUILT for the new architecture — wraps checkAdminPasswordExists,
 * setAdminPassword, adminLogin, adminLogout (the platformAdmins-free
 * versions). The old checkAdminPasscodeExists/setAdminPasscode/
 * verifyAdminPasscode Cloud Functions still exist in index.js but are
 * no longer called from anywhere in the client — dead code from the
 * previous architecture, not deleted from the backend in this pass
 * (see final report).
 */
import { getFunctions, httpsCallable } from 'firebase/functions'

function fn(name) {
  return httpsCallable(getFunctions(), name)
}

export async function checkAdminPasswordExists() {
  const result = await fn('checkAdminPasswordExists')()
  return Boolean(result.data?.exists)
}

export async function setAdminPassword(password) {
  const result = await fn('setAdminPassword')({ password })
  return Boolean(result.data?.ok)
}

/**
 * Returns the session token on success, or null on a wrong password
 * (adminLogin returns { ok: false } rather than throwing for a wrong
 * password specifically — a thrown error is reserved for genuine
 * failures like "no password configured yet").
 */
export async function adminLogin(password) {
  const result = await fn('adminLogin')({ password })
  if (result.data?.ok) return result.data.sessionToken
  return null
}

export async function adminLogout(sessionToken) {
  await fn('adminLogout')({ sessionToken })
}
