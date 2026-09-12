/**
 * Turns a Firebase Auth or Cloud Functions callable error into a
 * message safe to show a user — never a raw error code, stack trace,
 * or (for callable failures that never reached a real server-thrown
 * HttpsError, e.g. a CORS/network/deployment failure) the bare code
 * string the Functions SDK falls back to.
 */
const FIREBASE_AUTH_MESSAGES = {
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Please choose a stronger password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error — please check your connection and try again.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled.',
  'auth/api-key-http-referrer-blocked': "This app isn't allowed to sign in from this address yet. Please try again shortly.",
  'auth/unauthorized-domain': "This app isn't authorized to sign in from this address yet. Please try again shortly or contact support.",
  'auth/account-exists-with-different-credential':
    'An account already exists with this email using a different sign-in method. Try logging in with your email and password instead.'
}

const GENERIC_CALLABLE_FALLBACK = 'Something went wrong. Please try again in a moment.'

export function getAuthErrorMessage(err) {
  const code = err?.code || ''

  if (FIREBASE_AUTH_MESSAGES[code]) {
    return FIREBASE_AUTH_MESSAGES[code]
  }

  if (code.startsWith('functions/')) {
    const bareCode = code.slice('functions/'.length)
    const message = err?.message
    // When a callable request never reaches a real server-thrown
    // HttpsError (a CORS failure, the function not being deployed, a
    // network drop mid-request), the Functions SDK synthesizes an error
    // whose message is just the bare code itself (e.g. "internal") —
    // not a real, client-safe message. Every HttpsError this project
    // actually throws carries an actual sentence, so only show the
    // message through when it's not just the code repeated back.
    const looksLikeRealMessage = message && message.trim().toLowerCase() !== bareCode.toLowerCase()
    return looksLikeRealMessage ? message : GENERIC_CALLABLE_FALLBACK
  }

  return err?.message || GENERIC_CALLABLE_FALLBACK
}

/**
 * Dev-only structured diagnostic logging — never includes tokens,
 * passwords, API keys, or other secrets, only what the SDK already
 * attaches to the error object itself.
 */
export function logAuthErrorForDebug(context, err) {
  if (import.meta.env.DEV) {
    console.error(`[${context}]`, { code: err?.code, message: err?.message, details: err?.details })
  }
}
