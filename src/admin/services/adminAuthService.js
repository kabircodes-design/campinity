/**
 * Admin sign-in flows (API v2, device-bound). Every step is verified on
 * the server (functions/functions/adminDevice.js); this file only drives
 * them and signs challenges with this device's key.
 */
import { callAdminPublic } from './adminCallable.js'
import { getDeviceKey, signWithDeviceKey, setEnrolledDevice } from '../security/deviceKey.js'
import { messages } from '../security/requestProof.js'

export const REQUIRED_API_VERSION = 2

/** Resolves the backend's capabilities, or throws if the backend is older / unreachable. */
export async function getAdminCapabilities() {
  const caps = await callAdminPublic('adminGetCapabilities')
  if (!caps || caps.apiVersion < REQUIRED_API_VERSION || !caps.deviceAuth || !caps.verificationListReadOnly) {
    const err = new Error('The admin backend is older than this app.')
    err.code = 'admin/backend-outdated'
    throw err
  }
  return caps
}

export async function checkAdminPasswordExists() {
  const data = await callAdminPublic('checkAdminPasswordExists')
  return Boolean(data?.exists)
}

export async function setAdminPassword(password) {
  const data = await callAdminPublic('setAdminPassword', { password })
  return Boolean(data?.ok)
}

/**
 * Enrolls THIS device. Returns { ok:false } for a wrong password, or the
 * new session ({ sessionToken, expiresAtMs, deviceId }) on success.
 */
export async function enrollThisDevice({ password, enrollmentCode, label }) {
  const key = await getDeviceKey()
  const start = await callAdminPublic('adminEnrollDeviceStart', { password, enrollmentCode, label, publicKey: key.publicKeySpki, platform: key.platform })
  if (!start?.ok) return { ok: false }
  const signature = await signWithDeviceKey(messages.enroll(start.challengeId, start.nonce))
  const fin = await callAdminPublic('adminEnrollDeviceFinish', { challengeId: start.challengeId, signature })
  setEnrolledDevice({ deviceId: fin.deviceId, label })
  return { ok: true, session: { sessionToken: fin.sessionToken, expiresAtMs: fin.expiresAtMs, deviceId: fin.deviceId } }
}

/** Password + signed challenge from this (enrolled) device. */
export async function adminLogin({ password, deviceId }) {
  const start = await callAdminPublic('adminLogin', { password, deviceId })
  if (!start?.ok) return { ok: false }
  const signature = await signWithDeviceKey(messages.login(start.challengeId, start.nonce, deviceId))
  const fin = await callAdminPublic('adminLoginFinish', { challengeId: start.challengeId, signature })
  return { ok: true, session: { sessionToken: fin.sessionToken, expiresAtMs: fin.expiresAtMs, deviceId: fin.deviceId } }
}

export async function adminLogout(sessionToken) {
  await callAdminPublic('adminLogout', { sessionToken })
}
