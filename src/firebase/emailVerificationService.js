/**
 * Email verification — ONE switch, ONE active mechanism.
 *
 *   ACTIVE NOW: 'firebase' — Firebase Authentication's built-in verification
 *   (`sendEmailVerification`). Firebase sends the email from its default
 *   sender (noreply@<project>.firebaseapp.com) using the project's email
 *   template; the link opens Firebase's hosted action page, which marks the
 *   account verified and offers "Continue" back to /verify-email?verified=1.
 *   No domain, DNS, SMTP or Resend needed. This restores the original
 *   (July 2026) flow, plus a continue link and better error handling.
 *
 *   LATER: 'custom' — the Resend-based token flow (Cloud Functions
 *   createEmailVerification / resendEmailVerification /
 *   verifyEmailVerificationToken + functions/functions/email/*). Kept intact
 *   but DORMANT. Switch back by setting VITE_EMAIL_VERIFICATION_PROVIDER=custom
 *   once a sending domain is verified in Resend — see EMAIL_VERIFICATION.md.
 *
 * Only Firebase Auth's own `emailVerified` (re-read with reload()) ever grants
 * access; nothing on the client marks an account verified.
 */
import { applyActionCode, sendEmailVerification } from 'firebase/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { Capacitor } from '@capacitor/core'
import app, { auth } from './firebase.js'

export const EMAIL_VERIFICATION_PROVIDER = import.meta.env.VITE_EMAIL_VERIFICATION_PROVIDER === 'custom' ? 'custom' : 'firebase'
export const RESEND_COOLDOWN_SECONDS = 60

const functions = getFunctions(app, 'us-central1')
const fn = (name) => httpsCallable(functions, name)

// The public web app — used when this code runs inside the Android app, whose
// WebView origin (https://localhost) can't be opened from a mail app.
const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL || 'https://campinity-app.vercel.app').replace(/\/+$/, '')

/** Where Firebase's "Continue" button returns to after verifying. */
export function verificationContinueUrl() {
  const base = Capacitor.isNativePlatform() || typeof window === 'undefined' ? PUBLIC_APP_URL : window.location.origin
  return `${base}/verify-email?verified=1`
}

const CONTINUE_URL_ERRORS = new Set(['auth/unauthorized-continue-uri', 'auth/invalid-continue-uri', 'auth/missing-continue-uri'])

async function sendFirebaseVerification(user) {
  try {
    await sendEmailVerification(user, { url: verificationContinueUrl(), handleCodeInApp: false })
  } catch (err) {
    // A continue URL that isn't an authorized domain must never block the email itself.
    if (!CONTINUE_URL_ERRORS.has(err?.code)) throw err
    await sendEmailVerification(user)
  }
  return { ok: true, provider: 'firebase', resendAvailableInSeconds: RESEND_COOLDOWN_SECONDS, expiresInMinutes: null }
}

/**
 * Sends the verification email for `user` (default: the signed-in user).
 * Resolves { ok, provider, resendAvailableInSeconds, expiresInMinutes } or
 * { ok, alreadyVerified: true }. Throws a FirebaseError on failure
 * (e.g. auth/too-many-requests, auth/network-request-failed).
 */
export async function sendVerificationEmail(user = auth.currentUser) {
  if (!user) throw Object.assign(new Error('You need to be signed in.'), { code: 'auth/no-current-user' })
  if (user.emailVerified) return { ok: true, alreadyVerified: true }
  if (EMAIL_VERIFICATION_PROVIDER === 'custom') {
    const result = await fn('resendEmailVerification')()
    return { provider: 'custom', ...result.data }
  }
  return sendFirebaseVerification(user)
}

/**
 * Completes a Firebase verification link that points into the app
 * (/verify-email?mode=verifyEmail&oobCode=…). Only used if the Firebase
 * Console action URL is ever pointed at the app; the default hosted page
 * applies the code itself.
 */
export async function applyFirebaseVerificationCode(oobCode) {
  await applyActionCode(auth, oobCode)
  return { ok: true }
}

// ---------------------------------------------------------------- custom (dormant)
const inFlight = new Map()
/**
 * Custom flow only: redeems ?token=… from a Resend email. One request per
 * link per page load (StrictMode double effect / double tap / refresh).
 * Errors carry err.details.reason: 'invalid' | 'expired' | 'already-used'
 * | 'superseded' | 'server-error'.
 */
export function verifyEmailVerificationToken(token) {
  if (!inFlight.has(token)) {
    inFlight.set(
      token,
      fn('verifyEmailVerificationToken')({ token }).then(
        (result) => result.data,
        (err) => {
          inFlight.delete(token)
          throw err
        }
      )
    )
  }
  return inFlight.get(token)
}
