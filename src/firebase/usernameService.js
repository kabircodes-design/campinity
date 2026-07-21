import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase.js'

const USERNAMES_COLLECTION = 'usernames'
const USERS_COLLECTION = 'users'

const USERNAME_PATTERN = /^[a-z0-9_]+$/
const MIN_LENGTH = 3
const MAX_LENGTH = 20

/**
 * Normalizes raw user input into the canonical form used as the
 * usernames/{username} document id: lowercase, trimmed, leading '@'
 * stripped, all whitespace removed (usernames never contain spaces, so
 * "collapse multiple spaces" collapses all the way down to none).
 */
export function normalizeUsername(raw) {
  return (raw || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/\s+/g, '')
}

/**
 * Validates an already-normalized username. Returns { valid, error }.
 */
export function validateUsername(normalized) {
  if (!normalized) {
    return { valid: false, error: 'Username is required' }
  }
  if (normalized.length < MIN_LENGTH) {
    return { valid: false, error: `Username must be at least ${MIN_LENGTH} characters` }
  }
  if (normalized.length > MAX_LENGTH) {
    return { valid: false, error: `Username must be ${MAX_LENGTH} characters or fewer` }
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    return { valid: false, error: 'Only lowercase letters, numbers, and underscores are allowed' }
  }
  return { valid: true, error: '' }
}

/**
 * Single-read availability check, for live "Checking… / Available /
 * Username already taken" UI feedback only. This is NOT the source of
 * truth for uniqueness — it's a cheap read that can go stale the instant
 * after it resolves. reserveUsername()'s transaction below is the only
 * thing that actually guarantees uniqueness; this function existing
 * separately is what keeps the transaction from being called on every
 * keystroke.
 */
export async function checkUsernameAvailable(normalized) {
  const snap = await getDoc(doc(db, USERNAMES_COLLECTION, normalized))
  return !snap.exists()
}

/**
 * Atomically reserves `newUsername` for `uid`, releasing `oldUsername`
 * (if provided and different) in the SAME transaction.
 *
 * Transaction contract:
 *   1. Read usernames/{newUsername}.
 *      - Exists, owned by a DIFFERENT uid -> throw (taken).
 *      - Exists, owned by THIS uid, or doesn't exist -> proceed.
 *   2. If oldUsername is provided, normalizes to something different
 *      from newUsername, and its reservation belongs to this uid,
 *      delete that reservation.
 *   3. Set usernames/{newUsername} -> { uid, createdAt }.
 *   4. Update users/{uid}.username -> newUsername.
 *
 * Firestore re-validates every document this transaction read against
 * its state at commit time. If two users race for the same username,
 * whichever transaction commits first "wins" that document; the other's
 * read of usernames/{newUsername} is now stale, so Firestore retries it
 * automatically — on retry it sees the now-existing document and this
 * function throws the same "already taken" error, never silently
 * overwriting the winner.
 *
 * Throws an Error with `.code` set to 'invalid-username' or
 * 'username-taken' so callers can show the right message. Resolves with
 * the normalized username that was actually reserved (or already held).
 */
export async function reserveUsername({ uid, newUsername, oldUsername = '' }) {
  const normalizedNew = normalizeUsername(newUsername)
  const { valid, error } = validateUsername(normalizedNew)
  if (!valid) {
    const err = new Error(error)
    err.code = 'invalid-username'
    throw err
  }

  const normalizedOld = oldUsername ? normalizeUsername(oldUsername) : ''

  // "If username is unchanged, do nothing."
  if (normalizedNew === normalizedOld) {
    return normalizedNew
  }

  const newRef = doc(db, USERNAMES_COLLECTION, normalizedNew)
  const oldRef = normalizedOld ? doc(db, USERNAMES_COLLECTION, normalizedOld) : null
  const userRef = doc(db, USERS_COLLECTION, uid)

  await runTransaction(db, async (transaction) => {
    const newSnap = await transaction.get(newRef)

    if (newSnap.exists() && newSnap.data().uid !== uid) {
      const err = new Error('Username already taken')
      err.code = 'username-taken'
      throw err
    }

    if (oldRef) {
      const oldSnap = await transaction.get(oldRef)
      if (oldSnap.exists() && oldSnap.data().uid === uid) {
        transaction.delete(oldRef)
      }
    }

    transaction.set(newRef, { uid, createdAt: serverTimestamp() })
    transaction.update(userRef, { username: normalizedNew })
  })

  return normalizedNew
}