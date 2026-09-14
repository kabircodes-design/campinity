import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase.js'

/**
 * Lightweight presence — this project has no Realtime Database, only
 * Firestore, and Firestore has no server-side onDisconnect hook. A true
 * "instantly know when someone's tab closed" system would need RTDB (a
 * second database product) or an external presence service — out of
 * scope for "use the existing Firebase setup." This is the honest,
 * lightweight alternative: a heartbeat timestamp on the user's own
 * profile doc (users/{uid}.lastActiveAt), refreshed periodically while
 * the app is open. "Online" is then a heuristic — lastActiveAt within
 * ONLINE_WINDOW_MS — not a guarantee. If a tab is killed abruptly
 * (crash, force-quit, network loss) rather than closed normally, the
 * user will still show "Online" for up to that window before aging out
 * to "Offline." This limitation is stated here rather than hidden.
 *
 * Write cost is intentionally low: one Firestore write per signed-in
 * user per HEARTBEAT_INTERVAL_MS (30s), not per render, not per
 * keystroke, and only ever to the user's OWN doc (already owner-write
 * per firestore.rules — no rule change needed for this).
 */
export const HEARTBEAT_INTERVAL_MS = 30 * 1000
export const ONLINE_WINDOW_MS = 45 * 1000 // > heartbeat interval, so one missed tick doesn't flicker offline
const RECENT_WINDOW_MS = 5 * 60 * 1000

export async function touchPresence(uid) {
  if (!uid) return
  await setDoc(doc(db, 'users', uid), { lastActiveAt: serverTimestamp() }, { merge: true }).catch(() => {})
}

/** true/false/null (null = no presence data at all, e.g. never signed in since this feature shipped). */
export function isOnline(profile) {
  const ms = profile?.lastActiveAt?.toMillis?.()
  if (!ms) return null
  return Date.now() - ms < ONLINE_WINDOW_MS
}

/** Human-readable presence line for a chat header — "Online" / "Last seen recently" / "Last seen Xh ago" / "Offline". */
export function presenceLabel(profile) {
  const ms = profile?.lastActiveAt?.toMillis?.()
  if (!ms) return 'Offline'
  const diff = Date.now() - ms
  if (diff < ONLINE_WINDOW_MS) return 'Online'
  if (diff < RECENT_WINDOW_MS) return 'Last seen recently'
  const hours = Math.round(diff / 3600000)
  if (hours < 1) return 'Last seen recently'
  if (hours < 24) return `Last seen ${hours}h ago`
  const days = Math.round(hours / 24)
  return `Last seen ${days}d ago`
}
