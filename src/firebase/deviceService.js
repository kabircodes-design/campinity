/**
 * Device registration for push notifications — Phase 1 (foundation
 * only, no sending). Schema mirrors the ALREADY-SECURED blockedUsers/
 * mutedUsers pattern exactly (users/{uid}/devices/{deviceId}), a
 * private subcollection under the device owner's own user document,
 * owner-only in every direction — see the accompanying firestore.rules
 * addition, added as one more match block following the exact same
 * shape as notifications/blockedUsers/mutedUsers, not a new pattern.
 */
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from './firebase.js'

const DEVICE_ID_KEY = 'campinity:deviceId'

function deviceDoc(uid, deviceId) {
  return doc(db, 'users', uid, 'devices', deviceId)
}

/**
 * Stable, installation-scoped id — generated once and persisted in
 * localStorage, the same mechanism already used everywhere else in
 * this app for local-only flags (accountService.js's logOut cleanup,
 * useCampusVerificationReminder.js's seen/dismissed flags, etc.).
 * Deliberately NOT the FCM token itself: tokens rotate on refresh, but
 * this id must stay the same for the life of the install so a token
 * refresh updates the SAME device document instead of creating a new
 * one every time.
 */
export function getOrCreateDeviceId() {
  try {
    let id = window.localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      id = crypto.randomUUID()
      window.localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
  } catch {
    // Storage unavailable — fall back to a session-only id rather than
    // throwing; registration just won't persist across restarts here.
    return crypto.randomUUID()
  }
}

/**
 * Creates or updates this device's record under the signed-in user.
 * Read-then-branch (not a blind merge write) specifically so createdAt
 * is set exactly once and never overwritten by a later token refresh —
 * a merge write can't express "only set this field if it doesn't
 * already exist."
 */
export async function registerDevice(uid, deviceId, { fcmToken, appVersion, osVersion, platform = 'android' }) {
  const ref = deviceDoc(uid, deviceId)
  const existing = await getDoc(ref)
  const now = serverTimestamp()

  if (existing.exists()) {
    await updateDoc(ref, { fcmToken, appVersion, osVersion, enabled: true, updatedAt: now, lastSeenAt: now })
  } else {
    await setDoc(ref, {
      fcmToken,
      platform,
      appVersion,
      osVersion,
      enabled: true,
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now
    })
  }
}

/**
 * Called from logOut() (accountService.js) BEFORE signOut(auth) — must
 * run while the user is still authenticated, since the Firestore rule
 * for this collection is owner-only (isOwner(uid) needs
 * request.auth.uid to still equal uid at write time). Disables rather
 * than deletes: reversible, keeps the record for the next login on the
 * same device, and gives a future admin/debug view an honest history
 * instead of silent deletion.
 */
export async function disableDevice(uid, deviceId) {
  await updateDoc(deviceDoc(uid, deviceId), { enabled: false, updatedAt: serverTimestamp() })
}
