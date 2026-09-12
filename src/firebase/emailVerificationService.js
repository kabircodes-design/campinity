/**
 * Wraps the custom email-verification Cloud Functions (see
 * functions/functions/index.js) — the replacement for Firebase's
 * hosted sendEmailVerification()/oobCode flow. Same fn() pattern as
 * src/admin/services/adminAuthService.js.
 */
import { getFunctions, httpsCallable } from 'firebase/functions'
import app from './firebase.js'

// Explicit region — must match the `region` every function in
// functions/functions/index.js is deployed with ('us-central1'). Passing
// the already-initialized app avoids spinning up a second Firebase app
// instance just for Functions.
const functions = getFunctions(app, 'us-central1')

function fn(name) {
  return httpsCallable(functions, name)
}

/** Sends the first verification email for the signed-in user. */
export async function createEmailVerification() {
  const result = await fn('createEmailVerification')()
  return result.data
}

/** Requests a new verification email, invalidating any previous one. Rate-limited server-side. */
export async function resendEmailVerification() {
  const result = await fn('resendEmailVerification')()
  return result.data
}

/**
 * Redeems a verification token from the emailed link. Returns
 * { ok: true } on success, or throws a FirebaseError whose
 * `err.details?.reason` is one of 'invalid' | 'expired' | 'already-used'
 * | 'server-error'.
 */
export async function verifyEmailVerificationToken(token) {
  const result = await fn('verifyEmailVerificationToken')({ token })
  return result.data
}
