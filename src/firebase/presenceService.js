import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
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

/**
 * Secure presence (prepared, OFF by default): with VITE_SECURE_PRESENCE
 * set to 'true', the heartbeat goes to presence/{uid} instead of the
 * public users/{uid} doc. presence/{uid} is only readable by signed-in
 * users who are not blocked in either direction and only while the
 * owner shows their activity — enforced by firestore.rules
 * (match /presence/{uid}). Turn the flag on only AFTER those rules are
 * deployed; until then the existing users-doc path keeps working.
 */
export const SECURE_PRESENCE = import.meta.env.VITE_SECURE_PRESENCE === 'true'

export async function touchPresence(uid) {
  if (!uid) return
  const target = SECURE_PRESENCE ? doc(db, 'presence', uid) : doc(db, 'users', uid)
  await setDoc(target, { lastActiveAt: serverTimestamp() }, { merge: true }).catch(() => {})
}

/**
 * "Show activity status" switch. Off: the heartbeat stops (useAuthUser)
 * and the last stored timestamp is cleared, so nothing — not even the
 * moment you switched it off — stays readable. Reciprocal, like other
 * messengers: while yours is hidden you don't see other people's either.
 */
export async function setActivityStatusVisible(uid, visible) {
  if (!uid) return
  const profileUpdate = visible ? { activityStatusVisible: true } : { activityStatusVisible: false, lastActiveAt: null }
  await setDoc(doc(db, 'users', uid), profileUpdate, { merge: true })
  if (SECURE_PRESENCE) {
    await setDoc(doc(db, 'presence', uid), visible ? { visible: true } : { visible: false, lastActiveAt: null }, { merge: true })
  }
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

/**
 * Presence for chat surfaces, from the same heartbeat (lastActiveAt).
 * Deliberately coarse — the heartbeat is every 30s, so nothing finer
 * than minutes is claimed:
 *   < 45s           "Active now"        (online)
 *   < 5 min         "Active recently"
 *   < 60 min        "Active 12 min ago"
 *   same day        "Active today"
 *   previous day    "Active yesterday"
 *   < 7 days        "Active Mon"
 *   older           "Active 3 Nov"
 *   no data         null  (show nothing rather than a guess)
 */
export function formatPresence(lastActiveMs, now = Date.now()) {
  if (!lastActiveMs) return { online: false, label: null }
  const diff = now - lastActiveMs
  if (diff < ONLINE_WINDOW_MS) return { online: true, label: 'Active now' }
  if (diff < RECENT_WINDOW_MS) return { online: false, label: 'Active recently' }
  if (diff < 60 * 60 * 1000) return { online: false, label: `Active ${Math.floor(diff / 60000)} min ago` }
  const then = new Date(lastActiveMs)
  const today = new Date(now)
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  if (lastActiveMs >= startOfToday) return { online: false, label: 'Active today' }
  if (lastActiveMs >= startOfToday - 24 * 60 * 60 * 1000) return { online: false, label: 'Active yesterday' }
  if (lastActiveMs >= startOfToday - 6 * 24 * 60 * 60 * 1000) {
    return { online: false, label: `Active ${then.toLocaleDateString(undefined, { weekday: 'short' })}` }
  }
  return { online: false, label: `Active ${then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` }
}

/**
 * Live presence for one user: { lastActiveMs, visible }. Hidden (their
 * own setting) and unreadable (secure rules: blocked either way) both
 * come back as no presence at all — never a guess.
 */
export function subscribeToPresence(uid, onChange) {
  if (!uid) return () => {}
  if (SECURE_PRESENCE) {
    return onSnapshot(
      doc(db, 'presence', uid),
      (snap) => {
        const data = snap.exists() ? snap.data() : null
        onChange({ lastActiveMs: data?.lastActiveAt?.toMillis?.() ?? null, visible: data ? data.visible !== false : true })
      },
      () => onChange({ lastActiveMs: null, visible: false })
    )
  }
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      const data = snap.exists() ? snap.data() : null
      onChange({ lastActiveMs: data?.lastActiveAt?.toMillis?.() ?? null, visible: data ? data.activityStatusVisible !== false : true })
    },
    () => onChange({ lastActiveMs: null, visible: false })
  )
}
