import { Capacitor, registerPlugin } from '@capacitor/core'

/**
 * This device's admin key (P-256, ECDSA/SHA-256). The private key never
 * leaves where it was created:
 *  - CAMPINITY ADMIN Android app: generated inside Android Keystore by the
 *    native AdminDeviceKey plugin (hardware-backed where the phone has it);
 *    only the public key and signatures cross into JavaScript.
 *  - Browser (/admin on a laptop): WebCrypto key created NON-EXTRACTABLE
 *    and kept in this browser's IndexedDB. Software-protected: scripts can
 *    ask it to sign but can't read it out.
 * The server only ever sees the public key (at enrollment) and signatures.
 */
const NativeKey = registerPlugin('AdminDeviceKey')
const DEVICE_RECORD = 'campinity-admin:device'
const IDB_NAME = 'campinity-admin'
const IDB_STORE = 'keys'
const IDB_KEY = 'device-key-v1'

export const isNativeKeyAvailable = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('AdminDeviceKey')
export const devicePlatform = () => (isNativeKeyAvailable() ? 'android' : 'web')

const toB64 = (buf) => {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

// ---------------------------------------------------------------- IndexedDB (web)
function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function idbOp(mode, fn) {
  const dbh = await idb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = dbh.transaction(IDB_STORE, mode)
      const req = fn(tx.objectStore(IDB_STORE))
      tx.oncomplete = () => resolve(req && req.result)
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    dbh.close()
  }
}
const webGet = () => idbOp('readonly', (s) => s.get(IDB_KEY))
const webPut = (pair) => idbOp('readwrite', (s) => s.put(pair, IDB_KEY))
const webDelete = () => idbOp('readwrite', (s) => s.delete(IDB_KEY))

// ---------------------------------------------------------------- public API
/** Returns { publicKeySpki, platform, hardwareBacked } — creates the key on first use. */
export async function getDeviceKey() {
  if (isNativeKeyAvailable()) {
    const res = await NativeKey.getOrCreateKey()
    return { publicKeySpki: res.publicKeySpki, platform: 'android', hardwareBacked: Boolean(res.hardwareBacked) }
  }
  if (!globalThis.crypto?.subtle || !globalThis.indexedDB) throw new Error('This browser cannot hold an admin device key (needs WebCrypto and IndexedDB over HTTPS).')
  let pair = await webGet()
  if (!pair) {
    pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])
    await webPut(pair)
  }
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey) // public half only
  return { publicKeySpki: toB64(spki), platform: 'web', hardwareBacked: false }
}

/** Signs a UTF-8 message with the device key. Returns base64. */
export async function signWithDeviceKey(message) {
  if (isNativeKeyAvailable()) {
    const res = await NativeKey.sign({ message })
    return res.signature
  }
  const pair = await webGet()
  if (!pair) throw new Error('This device has no admin key. Enroll it again.')
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(message))
  return toB64(sig)
}

/** Deletes the key and the local enrollment record (re-enrollment starts fresh). */
export async function resetDeviceKey() {
  try {
    localStorage.removeItem(DEVICE_RECORD)
  } catch {}
  if (isNativeKeyAvailable()) await NativeKey.deleteKey()
  else await webDelete().catch(() => {})
}

/** { deviceId, label } after a successful enrollment on this device; not secret. */
export function getEnrolledDevice() {
  try {
    const v = JSON.parse(localStorage.getItem(DEVICE_RECORD) || 'null')
    return v && /^[a-f0-9]{32}$/.test(v.deviceId) ? v : null
  } catch {
    return null
  }
}
export function setEnrolledDevice(record) {
  try {
    localStorage.setItem(DEVICE_RECORD, JSON.stringify({ deviceId: record.deviceId, label: record.label || '' }))
  } catch {}
}
