import { signWithDeviceKey } from './deviceKey.js'

/**
 * Client half of the per-request device proof. MUST match
 * functions/functions/adminDevice.js byte for byte (stableStringify,
 * message format) — covered by tests/admin-device-client.test.jsx, which
 * verifies client-made proofs with the server's own verifier.
 */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value === undefined ? null : value)
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : stableStringify(v))).join(',')}]`
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
}

export async function sha256hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const messages = {
  login: (challengeId, nonce, deviceId) => `campinity-admin/login/v1\n${challengeId}\n${nonce}\n${deviceId}`,
  enroll: (challengeId, nonce) => `campinity-admin/enroll/v1\n${challengeId}\n${nonce}`,
  call: (tokenHash, ts, nonce, bodyHash) => `campinity-admin/call/v1\n${tokenHash}\n${ts}\n${nonce}\n${bodyHash}`
}

const randomNonce = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')

/**
 * Returns the request body to send: `data` normalised exactly as the
 * callable protocol will deliver it (undefined dropped), plus deviceProof
 * signed over it. `sign` is injectable for tests.
 */
export async function attachDeviceProof(data, { sign = signWithDeviceKey, now = Date.now } = {}) {
  const clean = JSON.parse(JSON.stringify(data || {}))
  delete clean.deviceProof
  const ts = now()
  const nonce = randomNonce()
  const message = messages.call(await sha256hex(clean.sessionToken || ''), ts, nonce, await sha256hex(stableStringify(clean)))
  return { ...clean, deviceProof: { ts, nonce, sig: await sign(message) } }
}
