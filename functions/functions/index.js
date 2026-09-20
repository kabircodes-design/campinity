/**
 * moderateProfilePhoto — HTTPS callable Cloud Function. This is the
 * ONLY place OpenAI is ever called from in this whole feature — never
 * from browser/React code, matching requirement 3 directly. The
 * OPENAI_API_KEY is read server-side only (see openaiProvider.js's
 * own comment) and is never sent to or readable by the client.
 *
 * UNTESTED, stated plainly: I have no way to deploy or invoke this
 * function from this environment — no Firebase CLI session, no
 * OpenAI key, no live project. This is written correctly to the best
 * of my knowledge of the Firebase Functions v2 + Admin SDK APIs, but
 * has never actually run. Do not treat this as verified working
 * code — deploy and test it for real before relying on it.
 *
 * Flow (matches the brief's architecture exactly):
 *   1. Client uploads the cropped image to a QUARANTINE path (never
 *      the final public avatar path) and calls this function with
 *      that quarantine path.
 *   2. This function verifies the caller is authenticated and owns
 *      the quarantine path (uid embedded in the path must match
 *      context.auth.uid — never trust a client-supplied uid).
 *   3. Generates a short-lived signed URL for the quarantined file
 *      (OpenAI's image_url input needs a URL, not a direct file
 *      upload — the file itself is never made publicly/permanently
 *      accessible for this step).
 *   4. Calls the moderation provider (moderateImage from
 *      openaiProvider.js — swappable per requirement 15).
 *   5. On SAFE: copies the file to the real, existing
 *      campusAvatars/{uid}/{timestamp}.jpg path (the same path
 *      ProfilePhotoEditor.jsx already used before this change — no
 *      new avatar field, no second upload system), deletes the
 *      quarantine copy, returns { decision: 'SAFE', finalUrl }.
 *   6. On REVIEW: leaves the file quarantined, writes a
 *      profilePhotoReviews/{uid} document recording the pending
 *      state, returns { decision: 'REVIEW' } — no finalUrl, caller
 *      must not update the profile.
 *   7. On BLOCK: deletes the quarantined file entirely, returns
 *      { decision: 'BLOCK' } — nothing is kept, nothing is public.
 *   8. On provider failure (thrown error, network failure, missing
 *      API key): the quarantined file is left in place (not deleted,
 *      not published), and the function re-throws as an
 *      HttpsError('unavailable', ...) so the client can show "Your
 *      image is being checked. Please try again shortly." per
 *      requirement 12 — the image is never published on a provider
 *      failure.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { setGlobalOptions } = require('firebase-functions/v2')
const admin = require('firebase-admin')
const { moderateImage } = require('./moderation/openaiProvider.js')
const { sendVerificationEmail } = require('./email/mailer.js')

admin.initializeApp()
setGlobalOptions({ maxInstances: 10 })

const bucket = () => admin.storage().bucket()
const db = () => admin.firestore()

const QUARANTINE_PREFIX = 'quarantine/profilePhotos/'
const FINAL_PREFIX = 'campusAvatars/'

exports.moderateProfilePhoto = onCall({ region: 'us-central1', secrets: ['OPENAI_API_KEY'] }, async (request) => {
  try {
    return await handleModerateProfilePhoto(request)
  } catch (err) {
    // Re-throw HttpsErrors exactly as thrown — these already carry
    // their own specific code (unauthenticated/invalid-argument/
    // permission-denied/not-found/unavailable/internal) and were
    // already logged at their own throw site where relevant. Only a
    // genuinely UNEXPECTED exception (e.g. one of the
    // profilePhotoReviews Firestore writes failing, which had no
    // error handling at all before this fix) falls through to the
    // generic branch below — and even that is now logged with its
    // real message/code before becoming the safe generic error the
    // client sees, closing the exact "do not swallow errors" gap
    // this whole debugging pass is about.
    if (err instanceof HttpsError) throw err
    console.error('[moderateProfilePhoto] unexpected error', { uid: request.auth?.uid, message: err?.message, code: err?.code })
    throw new HttpsError('internal', 'Something went wrong. Please try again.')
  }
})

async function handleModerateProfilePhoto(request) {
  const uid = request.auth?.uid
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You need to be signed in.')
  }

  const { quarantinePath } = request.data || {}
  if (!quarantinePath || typeof quarantinePath !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing quarantinePath.')
  }
  // The path must genuinely belong to this uid — never trust a
  // client-supplied path pointing at someone else's quarantined file.
  if (!quarantinePath.startsWith(`${QUARANTINE_PREFIX}${uid}/`)) {
    throw new HttpsError('permission-denied', "That file doesn't belong to you.")
  }

  const file = bucket().file(quarantinePath)
  const [exists] = await file.exists()
  if (!exists) {
    throw new HttpsError('not-found', 'That upload could not be found — please try again.')
  }

  let signedUrl
  try {
    ;[signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 10 * 60 * 1000 // 10 minutes — only needs to live long enough for the moderation call itself
    })
  } catch (err) {
    // Can't even generate a URL to check the image — same "don't
    // publish on failure" rule applies. Real cause now actually
    // logged — the previous version of this catch block logged
    // nothing about err at all, so even a correct root-cause guess
    // elsewhere would never have been confirmable from logs.
    console.error('[moderateProfilePhoto] signed URL generation failed', { uid, message: err?.message, code: err?.code })
    throw new HttpsError('unavailable', 'Your image is being checked. Please try again shortly.')
  }

  let result
  try {
    result = await moderateImage({ imageUrl: signedUrl })
  } catch (err) {
    // Provider failure — requirement 12: do NOT publish, keep
    // quarantined, tell the client to retry. The file is left exactly
    // where it is; nothing is deleted, nothing is published. Real
    // cause now actually logged (message/code, not the full raw
    // error which could include request/response bodies) — the
    // previous version only logged { uid }, never the error itself.
    console.error('[moderateProfilePhoto] provider failure', { uid, message: err?.message, code: err?.code })
    throw new HttpsError('unavailable', 'Your image is being checked. Please try again shortly.')
  }

  const moderationRecord = {
    uid,
    decision: result.decision,
    provider: result.provider,
    providerVersion: result.providerVersion,
    moderatedAt: admin.firestore.FieldValue.serverTimestamp()
    // Deliberately NOT storing result.categories or any raw provider
    // payload here — requirement 11, "do not store unnecessary raw
    // moderation data." The decision itself is the durable record;
    // which specific categories triggered is not persisted.
  }

  if (result.decision === 'BLOCK') {
    await file.delete().catch(() => {}) // best-effort — if delete fails, it's still quarantined and never public
    await db().collection('profilePhotoReviews').doc(uid).set(moderationRecord, { merge: true })
    return { decision: 'BLOCK' }
  }

  if (result.decision === 'REVIEW') {
    await db().collection('profilePhotoReviews').doc(uid).set(moderationRecord, { merge: true })
    return { decision: 'REVIEW' }
  }

  // SAFE — copy to the real, existing final path and clean up quarantine.
  const finalPath = `${FINAL_PREFIX}${uid}/${Date.now()}.jpg`
  let finalUrl
  try {
    await file.copy(bucket().file(finalPath))
    await file.delete().catch(() => {})

    // Fixed alongside adding error handling here: '03-01-2500' is an
    // ambiguous MM-DD-YYYY-shaped string I was not certain the
    // underlying @google-cloud/storage SDK parses the way intended.
    // Replaced with an unambiguous, valid ISO date far in the future
    // — removes that uncertainty entirely rather than leaving it as
    // an untested guess.
    ;[finalUrl] = await bucket().file(finalPath).getSignedUrl({
      action: 'read',
      expires: '2500-01-01T00:00:00Z'
    })
  } catch (err) {
    // This exact block (copy/delete/getSignedUrl) previously had ZERO
    // error handling — any failure here threw uncaught, which Firebase
    // Functions converts to a generic 'internal' error with no logged
    // detail. This is the strongest single candidate for the reported
    // functions/internal symptom, given the client saw exactly that
    // generic code. Now logged with the real message/code before
    // re-throwing a safe client-facing error.
    console.error('[moderateProfilePhoto] SAFE-path finalize failed', { uid, message: err?.message, code: err?.code })
    throw new HttpsError('internal', 'Something went wrong finishing your upload. Please try again.')
  }

  await db().collection('profilePhotoReviews').doc(uid).set(moderationRecord, { merge: true })

  return { decision: 'SAFE', finalUrl }
}

/**
 * =====================================================================
 * getVerifiedPostDocumentUrl — verification-access-control pass, Phase 2
 * (the PDF/document security gap).
 *
 * postService.js's uploadPostDocument used to call getDownloadURL() and
 * that permanent, bearer-token-bearing URL got stored directly on the
 * posts/{postId} document — readable by any signed-in user regardless
 * of verification status, since Storage rules only ever gated the ACT
 * of calling getDownloadURL(), never the token it hands back once
 * extracted. This function is the real fix: the post document now
 * stores only a Storage PATH (see uploadPostDocument's own comment),
 * and this is the ONLY way that path ever turns into something openable
 * — server-verifies auth, verifiedCampus, and that the requested path
 * genuinely belongs to a post the caller identified by ID (never a
 * client-supplied arbitrary path), then mints a short-lived signed URL
 * exactly the way adminGetVerificationDocumentUrl already does for ID
 * documents below — same pattern, not a new one.
 * =====================================================================
 */
exports.getVerifiedPostDocumentUrl = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'You need to be signed in.')

  const { postId } = request.data || {}
  if (!postId || typeof postId !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing postId.')
  }

  try {
    const userSnap = await db().collection('users').doc(uid).get()
    if (!userSnap.exists || userSnap.data().verifiedCampus !== true) {
      throw new HttpsError('permission-denied', 'Verify your campus to open this document.')
    }

    const postSnap = await db().collection('posts').doc(postId).get()
    if (!postSnap.exists) throw new HttpsError('not-found', 'This post no longer exists.')

    const filePath = postSnap.data().file?.path
    if (!filePath || typeof filePath !== 'string') {
      throw new HttpsError('not-found', 'This post has no document attached.')
    }

    const [url] = await bucket().file(filePath).getSignedUrl({ action: 'read', expires: Date.now() + 10 * 60 * 1000 })
    return { url }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[getVerifiedPostDocumentUrl] unexpected error', { postId, message: err?.message })
    throw new HttpsError('internal', 'Could not open this document. Please try again.')
  }
})

/**
 * checkAdminStatus — new this pass, added on top of the original
 * moderateProfilePhoto above (which is otherwise unchanged, restored
 * verbatim from the original source). The only safe way for a client
 * to find out whether the current user is a platform admin, given
 * platformAdmins/{uid} is deliberately locked to `allow read: if
 * false` for every client (confirmed by reading firestore.rules
 * directly) — even the admin themselves cannot read their own grant
 * document via the client SDK. This function uses the Admin SDK
 * (which bypasses Firestore rules entirely, same as every other
 * function in this file) to perform that one read server-side, and
 * returns only a boolean — never the platformAdmins document's
 * contents.
 *
 * IMPORTANT — this boolean is for UI purposes only (showing/hiding
 * the admin panel). It is NOT itself a security boundary: every
 * actual admin-privileged write (reports, moderationActions, role
 * changes, verification approvals, etc) is independently re-verified
 * against platformAdmins/{uid} directly inside firestore.rules for
 * that specific operation. A client that lied about this boolean
 * (impossible without modifying source, but worth stating precisely)
 * still could not perform any privileged write the rules didn't
 * already permit. This function only saves the client from needing a
 * server round-trip per privileged action just to know whether to
 * show the admin nav item at all.
 */
exports.checkAdminStatus = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You need to be signed in.')
  }

  try {
    const snap = await db().collection('platformAdmins').doc(uid).get()
    return { isAdmin: snap.exists }
  } catch (err) {
    console.error('[checkAdminStatus] unexpected error', { uid, message: err?.message, code: err?.code })
    // Fail closed — if the check itself fails, report not-admin
    // rather than admin. A false negative just means the admin nav
    // item stays hidden until retried; a false positive would be a
    // real (if UI-only) exposure.
    return { isAdmin: false }
  }
})

/**
 * Admin passcode system — a second, independent factor on top of
 * platformAdmins/{uid}, per explicit instruction: "the passcode is
 * the ADMIN PANEL LOCK, it is NOT a replacement for Firebase
 * authorization." Both functions below independently re-verify
 * platformAdmins/{uid} themselves — they never trust that the client
 * already passed ProtectedRoute's stage="admin" check, since a Cloud
 * Function must never assume a client-side guard was actually
 * enforced.
 *
 * Storage: adminConfig/passcode, a single Firestore document locked
 * to `allow read, write: if false` for every client (same pattern as
 * platformAdmins) — readable/writable only via these two functions'
 * Admin SDK access, which bypasses Firestore rules. The passcode
 * itself is never stored in plaintext: salted + hashed with Node's
 * built-in crypto.scryptSync, no new npm dependency needed, matching
 * "do not overengineer this."
 *
 * Session model, matching the explicit clarification exactly: no
 * server-side session token/expiry system at all. verifyAdminPasscode
 * simply returns { ok: true } on a correct passcode; the client keeps
 * an in-memory-only "unlocked" flag for the lifetime of that page
 * load (see useAdminSession.js) — never localStorage/sessionStorage,
 * so a refresh or new visit always re-locks, exactly as specified
 * ("do NOT automatically unlock because the browser previously
 * visited").
 */

const PASSCODE_DOC_PATH = ['adminConfig', 'passcode']

async function requirePlatformAdmin(uid) {
  const snap = await db().collection('platformAdmins').doc(uid).get()
  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'Admin authorization required.')
  }
}

function hashPasscode(passcode, salt) {
  // scryptSync is part of Node's built-in crypto module — no new
  // dependency. 64-byte derived key is generous for a passcode
  // (bcrypt/scrypt-class strength), not the bare minimum.
  const crypto = require('crypto')
  return crypto.scryptSync(passcode, salt, 64).toString('hex')
}

/**
 * setAdminPasscode — creates the passcode the FIRST time (when no
 * adminConfig/passcode document exists yet), or resets it if one
 * already exists AND the caller is a platformAdmin (so an existing
 * admin can rotate the passcode later; this is not exposed in the
 * V1 UI per "keep it simple," but the function itself supports it
 * safely since it's already gated by requirePlatformAdmin either way).
 */
exports.setAdminPasscode = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You need to be signed in.')
  }
  await requirePlatformAdmin(uid)

  const { passcode } = request.data || {}
  if (!passcode || typeof passcode !== 'string' || passcode.length < 6) {
    throw new HttpsError('invalid-argument', 'Passcode must be at least 6 characters.')
  }

  try {
    const crypto = require('crypto')
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = hashPasscode(passcode, salt)

    await db().collection(PASSCODE_DOC_PATH[0]).doc(PASSCODE_DOC_PATH[1]).set({
      hash,
      salt,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid
    })

    return { ok: true }
  } catch (err) {
    console.error('[setAdminPasscode] unexpected error', { uid, message: err?.message, code: err?.code })
    throw new HttpsError('internal', 'Could not save the passcode. Please try again.')
  }
})

/**
 * checkAdminPasscodeExists — lets the client know whether to show the
 * first-time "Set up your admin passcode" screen or the normal
 * "Enter your admin passcode" lock screen, without ever revealing
 * anything about the passcode itself.
 */
exports.checkAdminPasscodeExists = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You need to be signed in.')
  }
  await requirePlatformAdmin(uid)

  try {
    const snap = await db().collection(PASSCODE_DOC_PATH[0]).doc(PASSCODE_DOC_PATH[1]).get()
    return { exists: snap.exists }
  } catch (err) {
    console.error('[checkAdminPasscodeExists] unexpected error', { uid, message: err?.message, code: err?.code })
    // Fail toward showing the lock screen (exists: true) rather than
    // the setup screen — if this check itself is broken, offering a
    // fresh passcode-creation screen would silently let anyone who
    // reaches this point overwrite a real, working passcode without
    // ever proving they knew the old one.
    return { exists: true }
  }
})

/**
 * verifyAdminPasscode — the actual unlock check. No rate-limiting
 * state machine (per "add reasonable brute-force protection... if it
 * can be implemented without making the system unnecessarily
 * complex" — a full attempt-counter/lockout system was judged to
 * cross that line for a V1 that's already gated behind a real
 * Firebase-authenticated platformAdmin account; the passcode is a
 * second factor for an already-authorized identity, not a public
 * login form). Cloud Functions' own per-user invocation limits and
 * the fact this is unreachable without already being a signed-in
 * platformAdmin provide meaningful practical friction without adding
 * new moving parts.
 */
exports.verifyAdminPasscode = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You need to be signed in.')
  }
  await requirePlatformAdmin(uid)

  const { passcode } = request.data || {}
  if (!passcode || typeof passcode !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing passcode.')
  }

  try {
    const snap = await db().collection(PASSCODE_DOC_PATH[0]).doc(PASSCODE_DOC_PATH[1]).get()
    if (!snap.exists) {
      throw new HttpsError('failed-precondition', 'No passcode has been set up yet.')
    }
    const { hash, salt } = snap.data()
    const attemptHash = hashPasscode(passcode, salt)

    // Constant-time comparison — avoids leaking timing information
    // about how many leading characters matched.
    const crypto = require('crypto')
    const a = Buffer.from(hash, 'hex')
    const b = Buffer.from(attemptHash, 'hex')
    const match = a.length === b.length && crypto.timingSafeEqual(a, b)

    return { ok: match }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[verifyAdminPasscode] unexpected error', { uid, message: err?.message, code: err?.code })
    throw new HttpsError('internal', 'Could not verify the passcode. Please try again.')
  }
})

/**
 * =====================================================================
 * SIMPLIFIED ADMIN AUTH — replaces the platformAdmins/checkAdminStatus/
 * useIsAdmin chain for /admin access, per explicit architectural
 * pivot. The admin password is now the ONLY gate on the admin login
 * screen itself — no Firebase-role prerequisite to even reach it.
 *
 * HONEST TRADE-OFF, stated plainly rather than silently accepted:
 * because setAdminPassword (first-time setup) has no platformAdmins
 * prerequisite anymore, ANY authenticated Campinity user who visits
 * /admin before you personally set the password could set it first
 * and lock you out. This is the direct, necessary consequence of
 * removing the platformAdmins prerequisite, which was explicitly
 * requested ("a normal user should be able to open /admin... they
 * should NOT need platformAdmins UID setup"). The mitigation is
 * operational, not architectural: set the password yourself
 * immediately after deploying this, before telling anyone (including
 * trusted friends) that /admin exists — matching "I will personally
 * create the password the first time" exactly.
 *
 * Storage: adminSession/config (password hash+salt) and
 * adminSession/tokens/{token} (active sessions), both locked to
 * `allow read, write: if false` in firestore.rules — only these
 * Cloud Functions (Admin SDK, bypasses rules) ever touch them.
 *
 * Session model: on successful password verification, a random
 * opaque token is generated and stored server-side with a 4-hour
 * expiry. The client holds this token in memory only (see
 * useAdminSession.js) — never localStorage, per explicit instruction
 * ("do not automatically trust a previous localStorage flag"). Every
 * privileged admin action (adminResolveReport below, and any future
 * ones) takes this token as a parameter and independently verifies
 * it server-side before performing the actual Firestore write via
 * the Admin SDK — this is what makes "normal users cannot perform
 * admin operations merely by knowing the frontend route" true even
 * though platformAdmins is no longer checked: the token itself, not
 * a client-side flag, is what a real admin action now requires.
 * =====================================================================
 */

const ADMIN_SESSION_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours

function adminConfigDoc() {
  return db().collection('adminSession').doc('config')
}

function adminTokenDoc(token) {
  return db().collection('adminSession').doc('tokens').collection('items').doc(token)
}

async function hashSecret(value, salt) {
  const crypto = require('crypto')
  const { promisify } = require('util')
  const scryptAsync = promisify(crypto.scrypt)
  const derivedKey = await scryptAsync(value, salt, 64)
  return derivedKey.toString('hex')
}

/**
 * Verifies a session token passed from the client, throwing if it's
 * missing, unknown, or expired. Used by every privileged admin action
 * function — the actual, real security boundary for this new
 * architecture, replacing platformAdmins' role for this feature.
 */
async function requireValidAdminSession(sessionToken) {
  if (!sessionToken || typeof sessionToken !== 'string') {
    throw new HttpsError('unauthenticated', 'Admin session required.')
  }
  const snap = await adminTokenDoc(sessionToken).get()
  if (!snap.exists) {
    throw new HttpsError('unauthenticated', 'Admin session is invalid. Please log in again.')
  }
  const data = snap.data()
  if (!data.expiresAt || data.expiresAt.toMillis() < Date.now()) {
    await adminTokenDoc(sessionToken).delete().catch(() => {})
    throw new HttpsError('unauthenticated', 'Admin session has expired. Please log in again.')
  }
  // Returned (not just validated) so every privileged action below can
  // attribute itself to a real Firebase uid in the audit log — the
  // session doc's own createdByUid, set once at adminLogin time — the
  // two existing callers (adminResolveReport/adminListReports) simply
  // don't use the return value, unaffected by this change.
  return data
}

/**
 * checkAdminPasswordExists — any authenticated Campinity user may
 * call this (no platformAdmins check), matching "a normal user should
 * be able to open /admin." Only reveals whether setup has happened,
 * never anything about the password itself.
 */
exports.checkAdminPasswordExists = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'You need to be signed in.')
  }
  try {
    const snap = await adminConfigDoc().get()
    return { exists: snap.exists }
  } catch (err) {
    console.error('[checkAdminPasswordExists] unexpected error', { message: err?.message, code: err?.code })
    // TEMPORARY DEBUG: the real error was previously visible only in
    // server-side logs (console.error above), never reaching the
    // browser — the client only ever saw a generic 'internal'
    // message. Including the real code/message directly in what's
    // thrown here so it surfaces in the browser console via
    // AdminLockScreen.jsx's existing error logging. Revert to a
    // generic message once the root cause is found and fixed.
    throw new HttpsError('internal', `DEBUG [checkAdminPasswordExists]: ${err?.code || 'no-code'} — ${err?.message || 'no message'}`)
  }
})

/**
 * setAdminPassword — first-time setup ONLY. Refuses if a password
 * already exists (returns failed-precondition), so this can never be
 * used to silently overwrite a real admin's password without a
 * separate, explicit reset mechanism (not built in this pass — not
 * requested, and adding one now would be exactly the
 * over-engineering the brief warns against).
 */
exports.setAdminPassword = onCall({ region: 'us-central1' }, async (request) => {
  console.log('[setAdminPassword][1] callable entered')
  const uid = request.auth?.uid
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You need to be signed in.')
  }
  console.log('[setAdminPassword][2] auth verified', { uid })

  const { password } = request.data || {}
  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new HttpsError('invalid-argument', 'Password must be at least 8 characters.')
  }
  console.log('[setAdminPassword][5] password validation started/passed')

  try {
    const existing = await adminConfigDoc().get()
    console.log('[setAdminPassword][3] existing-password check completed', { alreadyExists: existing.exists })
    if (existing.exists) {
      throw new HttpsError('failed-precondition', 'An admin password is already set.')
    }

    const crypto = require('crypto')
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = await hashSecret(password, salt)
    console.log('[setAdminPassword][6] password hash completed')

    console.log('[setAdminPassword][7] Firestore write started')
    await adminConfigDoc().set({
      hash,
      salt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdByUid: uid
    })
    console.log('[setAdminPassword][8] Firestore write completed')

    console.log('[setAdminPassword][9] returning success')
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[setAdminPassword] unexpected error', {
      uid,
      name: err?.name,
      code: err?.code,
      message: err?.message,
      stack: err?.stack
    })
    throw new HttpsError('internal', 'Could not set the admin password. Please try again.')
  }
})

/**
 * adminLogin — verifies the password and, on success, issues a
 * short-lived session token. This token, not any Firebase role, is
 * what every subsequent privileged admin action actually requires.
 */
exports.adminLogin = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You need to be signed in.')
  }

  const { password } = request.data || {}
  if (!password || typeof password !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing password.')
  }

  try {
    const configSnap = await adminConfigDoc().get()
    if (!configSnap.exists) {
      throw new HttpsError('failed-precondition', 'No admin password has been set up yet.')
    }
    const { hash, salt } = configSnap.data()
    const attemptHash = await hashSecret(password, salt)

    const crypto = require('crypto')
    const a = Buffer.from(hash, 'hex')
    const b = Buffer.from(attemptHash, 'hex')
    const match = a.length === b.length && crypto.timingSafeEqual(a, b)

    if (!match) {
      return { ok: false }
    }

    const sessionToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_MS)
    await adminTokenDoc(sessionToken).set({
      createdByUid: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt)
    })

    return { ok: true, sessionToken }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[adminLogin] unexpected error', { uid, message: err?.message, code: err?.code })
    throw new HttpsError('internal', 'Could not verify the password. Please try again.')
  }
})

/**
 * adminLogout — explicit session invalidation, used by the dashboard's
 * "Lock Panel"/"Sign Out" action so a shared/borrowed browser can't
 * keep using an old in-memory token after the admin intends to leave.
 */
exports.adminLogout = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken } = request.data || {}
  if (sessionToken && typeof sessionToken === 'string') {
    await adminTokenDoc(sessionToken).delete().catch(() => {})
  }
  return { ok: true }
})

/**
 * adminResolveReport — the first real privileged admin action built
 * on this new architecture, as a working template for any future
 * ones. Requires a valid session token (requireValidAdminSession
 * above), NOT platformAdmins — this is the actual replacement
 * security boundary. Uses the Admin SDK directly (bypasses
 * firestore.rules entirely, which is fine and expected here — the
 * token check above is what's actually gating this, same as every
 * other function in this file already does for its own operation).
 *
 * Field names/shape match reportService.js's real, confirmed schema
 * (reporterUid, targetType, status, reviewedBy, reviewedAt,
 * moderationAction) — not invented independently of it.
 */
exports.adminResolveReport = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken, reportId, status, moderationAction } = request.data || {}
  await requireValidAdminSession(sessionToken)

  if (!reportId || !['resolved', 'dismissed'].includes(status)) {
    throw new HttpsError('invalid-argument', 'Missing reportId or invalid status.')
  }

  try {
    const reportRef = db().collection('reports').doc(reportId)
    const reportSnap = await reportRef.get()
    if (!reportSnap.exists) {
      throw new HttpsError('not-found', 'This report no longer exists.')
    }
    if (reportSnap.data().status !== 'pending') {
      throw new HttpsError('failed-precondition', `This report was already ${reportSnap.data().status}.`)
    }

    await reportRef.update({
      status,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      moderationAction: moderationAction || status,
      reviewedByAdminSession: true // marks this as reviewed via the admin-session path, not a platformAdmins uid, for audit clarity
    })

    return { ok: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[adminResolveReport] unexpected error', { reportId, message: err?.message, code: err?.code })
    throw new HttpsError('internal', 'Could not update this report. Please try again.')
  }
})

/**
 * adminListReports — the read-side counterpart to adminResolveReport,
 * added because getReportsPage (the existing client-side read) is
 * still gated by firestore.rules' platformAdmins check — a trusted
 * friend who only has the admin password (no platformAdmins entry)
 * would see empty or wrong results calling it directly. This
 * function requires the same session token as adminResolveReport and
 * reads via the Admin SDK, bypassing that rule entirely — the
 * correct, complete fix, not just fixing the write side and leaving
 * the read side silently broken for exactly the audience this whole
 * pivot was for.
 */
exports.adminListReports = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken, status, pageSize } = request.data || {}
  await requireValidAdminSession(sessionToken)

  const limitCount = Math.min(Math.max(Number(pageSize) || 30, 1), 100)

  try {
    const snap = await db()
      .collection('reports')
      .where('status', '==', status || 'pending')
      .orderBy('createdAt', 'desc')
      .limit(limitCount)
      .get()

    return { reports: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }
  } catch (err) {
    console.error('[adminListReports] unexpected error', { status, message: err?.message, code: err?.code })
    throw new HttpsError('internal', 'Could not load reports. Please try again.')
  }
})

/**
 * =====================================================================
 * ADMIN PANEL — PHOTO VERIFICATION, COLLEGE REQUESTS, MODERATION,
 * LOST & FOUND, MARKETPLACE, NOTIFICATIONS, AUDIT LOG, OVERVIEW
 * =====================================================================
 * Every function below follows the exact adminResolveReport/
 * adminListReports template directly above: requireValidAdminSession
 * (sessionToken) is the real security boundary — not platformAdmins,
 * see that section's own comment for why — and every read/write uses
 * the Admin SDK, which bypasses firestore.rules entirely (intentional:
 * the token check is what's actually gating this, same as everything
 * else in this file already does for its own operation).
 *
 * Confirmed directly, not assumed: verificationRequests, collegeRequests
 * and moderationActions have NO client read/write rule for admin
 * purposes in firestore.rules (verificationRequests only lets the
 * submitter read their own doc; collegeRequests and moderationActions
 * have no admin branch at all) — which is exactly why
 * VerificationRequestsAdminPage.jsx/CollegeRequestsAdminPage.jsx's
 * existing client-SDK reads/writes (and moderationService.js's
 * logModerationAction) no longer work for anyone, platformAdmin or
 * not. No firestore.rules changes were made or needed for any of this:
 * Cloud Functions using the Admin SDK were never subject to those
 * rules in the first place.
 *
 * Every mutating action below calls logAdminAction() — writing to the
 * SAME moderationActions collection reviewReport's own
 * logModerationAction() (moderationService.js) already targets, not a
 * second parallel audit system.
 */

async function logAdminAction({ adminUid, action, targetType, targetId, targetUid, reason }) {
  try {
    await db().collection('moderationActions').add({
      adminUid: adminUid || null,
      action,
      targetType: targetType || null,
      targetId: targetId || null,
      targetUid: targetUid || null,
      reportId: null,
      reason: reason || null,
      viaAdminSession: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    })
  } catch (err) {
    // Never let a failed audit-log write undo or block the real admin
    // action that already succeeded — logged server-side for
    // investigation instead.
    console.error('[logAdminAction] failed to write audit entry', { action, message: err?.message })
  }
}

/**
 * =====================================================================
 * GAMIFICATION (Admin-SDK side) — the two reputation events that only
 * ever happen through an admin action (campus verification approval,
 * moderation penalties), so they're applied here rather than from the
 * browser. These CANNOT import src/gamification/config.js — this
 * functions/ package is a separate Node module tree with no build step
 * wiring it to the client bundle — so the three constants below are a
 * deliberate, disclosed duplication of config.js's REPUTATION_
 * VERIFIED_CAMPUS_BONUS / REPUTATION_MODERATION_PENALTY. If those
 * change on the client, update them here too.
 *
 * Both helpers write directly to userProgress/{uid} with the Admin SDK,
 * which bypasses firestore.rules entirely (no client-side trust issue),
 * and log a matching xpLog entry so getReputationBreakdown() on the
 * client sees these events in the same place it sees everything else.
 * =====================================================================
 */
const REPUTATION_VERIFIED_CAMPUS_BONUS = 50
const REPUTATION_MODERATION_PENALTY = { restricted: -30, suspended: -75 }

async function applyVerifiedCampusReputationBonus(uid) {
  if (!uid) return
  const progressRef = db().collection('userProgress').doc(uid)
  const dedupeKey = 'campus_verified_bonus'

  try {
    const alreadyAwarded = await db()
      .collection('xpLog').doc(uid).collection('entries')
      .where('dedupeKey', '==', dedupeKey).limit(1).get()
    if (!alreadyAwarded.empty) return

    await progressRef.set(
      {
        verifiedCampus: true,
        reputationScore: admin.firestore.FieldValue.increment(REPUTATION_VERIFIED_CAMPUS_BONUS),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    )
    await db().collection('xpLog').doc(uid).collection('entries').add({
      activityType: 'campus_verified_bonus',
      xpAwarded: 0,
      pointsAwarded: 0,
      reputationAwarded: REPUTATION_VERIFIED_CAMPUS_BONUS,
      dedupeKey,
      metadata: {},
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    })
  } catch (err) {
    // Non-fatal — verification itself must still succeed even if this
    // bonus write fails; logged for follow-up rather than surfaced to
    // the admin as an error on an otherwise-successful approval.
    console.error('[applyVerifiedCampusReputationBonus] failed', { uid, message: err?.message })
  }
}

/**
 * Applies a one-time reputation penalty when a user's moderationStatus
 * transitions to 'restricted' or 'suspended'. Deduped per (uid, status)
 * so the SAME status can never double-penalize (e.g. two reports both
 * resulting in "restricted"), but escalating restricted -> suspended
 * penalizes again since that's a materially worse outcome. Reversing a
 * status back to 'active' does NOT reverse this penalty — treated as a
 * historical mark, not a toggle, since nothing in this schema tracks
 * "this specific penalty was later undone."
 */
async function applyModerationReputationPenalty(uid, status) {
  const delta = REPUTATION_MODERATION_PENALTY[status]
  if (!uid || !delta) return
  const dedupeKey = `moderation_penalty_${uid}_${status}`

  try {
    const alreadyApplied = await db()
      .collection('xpLog').doc(uid).collection('entries')
      .where('dedupeKey', '==', dedupeKey).limit(1).get()
    if (!alreadyApplied.empty) return

    await db().collection('userProgress').doc(uid).set(
      {
        reputationScore: admin.firestore.FieldValue.increment(delta),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    )
    await db().collection('xpLog').doc(uid).collection('entries').add({
      activityType: 'moderation_penalty',
      xpAwarded: 0,
      pointsAwarded: 0,
      reputationAwarded: delta,
      dedupeKey,
      metadata: { status },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    })
  } catch (err) {
    console.error('[applyModerationReputationPenalty] failed', { uid, status, message: err?.message })
  }
}

/**
 * adminGetOverviewCounts — real counts via Firestore's count() aggregation
 * (one small read per collection, not a full document fetch), replacing
 * AdminOverviewPage.jsx's "Unavailable" placeholders with real numbers.
 *
 * Extended (admin Overview dashboard upgrade) with two more cheap counts
 * on the SAME function rather than a second one — `newUsersToday` (a
 * range count() on users.createdAt, which createInitialUserDoc has
 * written on every signup since that field existed) and
 * `marketplaceListings` (a plain unfiltered count() on products — there
 * is no "pending moderation" queue for Marketplace, just hide/unhide on
 * any listing, so a total count is the only honest metric here). Both
 * are additive: the response shape only grows, nothing existing changes,
 * so AdminOverviewPage.jsx's older-if-not-yet-redeployed callers keep
 * working exactly as before.
 */
exports.adminGetOverviewCounts = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken } = request.data || {}
  await requireValidAdminSession(sessionToken)

  const countOf = async (path, field, value) => {
    let ref = db().collection(path)
    if (field) ref = ref.where(field, '==', value)
    const snap = await ref.count().get()
    return snap.data().count
  }

  const countSince = async (path, field, sinceDate) => {
    const snap = await db()
      .collection(path)
      .where(field, '>=', admin.firestore.Timestamp.fromDate(sinceDate))
      .count()
      .get()
    return snap.data().count
  }

  try {
    const startOfTodayUtc = new Date()
    startOfTodayUtc.setUTCHours(0, 0, 0, 0)

    const [reports, verification, college, lostFound, totalUsers, verifiedUsers, newUsersToday, marketplaceListings] =
      await Promise.all([
        countOf('reports', 'status', 'pending'),
        countOf('verificationRequests', 'status', 'pending'),
        countOf('collegeRequests', 'status', 'pending'),
        countOf('lostFound', 'status', 'active'),
        countOf('users'),
        countOf('users', 'verifiedCampus', true),
        countSince('users', 'createdAt', startOfTodayUtc),
        countOf('products')
      ])
    return { reports, verification, college, lostFound, totalUsers, verifiedUsers, newUsersToday, marketplaceListings }
  } catch (err) {
    console.error('[adminGetOverviewCounts] unexpected error', { message: err?.message })
    throw new HttpsError('internal', 'Could not load overview stats. Please try again.')
  }
})

/**
 * =====================================================================
 * PHOTO VERIFICATION — verificationRequests/{requestId}, created by
 * submitVerificationRequest (verificationService.js) during the
 * college_id campus-verification path. Approval flips
 * users/{uid}.verifiedCampus to true; rejection only touches the
 * request, matching reviewVerificationRequest's original (now
 * client-side-dead) semantics exactly, just performed via Admin SDK
 * instead.
 * =====================================================================
 */
/**
 * ROOT CAUSE of "already-approved requests reappearing as pending"
 * (Bug 1): the status field itself is fine, and adminReviewVerificationRequest
 * (the actual approve/reject action below) correctly flips it — that
 * write was never broken. The real gap is a SECOND, independent path
 * that also sets verifiedCampus: adminSetUserVerification (the direct
 * search-based verify/revoke toggle on the User Verification page) has
 * no knowledge of any verificationRequests document at all — verifying
 * someone that way leaves their original submitted request sitting at
 * status: 'pending' forever, even though the user is already verified.
 * That's the exact scenario reported: verified via one page, but their
 * old request keeps showing up as pending on this one.
 *
 * Fixed at both ends: adminSetUserVerification (below) now also closes
 * out any pending request(s) for that uid when verifying someone
 * directly. This function self-heals any request already left stale by
 * that gap before this fix existed — for each pending request found,
 * if the user is already verifiedCampus: true, it's auto-resolved
 * (status -> 'approved', same fields the real approval path writes)
 * and excluded from what's returned, instead of just being hidden on
 * the client. This is a real write correcting real data, not a fake
 * fallback — a genuinely pending request for a not-yet-verified user is
 * completely unaffected.
 */
exports.adminListVerificationRequests = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken, pageSize } = request.data || {}
  const session = await requireValidAdminSession(sessionToken)
  const limitCount = Math.min(Math.max(Number(pageSize) || 30, 1), 100)

  try {
    const snap = await db()
      .collection('verificationRequests')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .limit(limitCount)
      .get()

    const staleRequestIds = []
    const requests = (
      await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data()
          const [userSnap, collegeSnap] = await Promise.all([
            db().collection('users').doc(data.uid).get().catch(() => null),
            data.collegeId ? db().collection('colleges').doc(data.collegeId).get().catch(() => null) : Promise.resolve(null)
          ])
          const userData = userSnap && userSnap.exists ? userSnap.data() : null

          if (userData?.verifiedCampus === true) {
            staleRequestIds.push(d.id)
            return null
          }

          return {
            id: d.id,
            uid: data.uid,
            collegeId: data.collegeId || null,
            documentPath: data.documentPath,
            createdAt: data.createdAt,
            displayName: userData?.displayName || userData?.fullName || 'Unknown user',
            username: userData?.username || '',
            collegeName: collegeSnap && collegeSnap.exists ? collegeSnap.data().name : ''
          }
        })
      )
    ).filter(Boolean)

    if (staleRequestIds.length > 0) {
      const batch = db().batch()
      staleRequestIds.forEach((id) => {
        batch.update(db().collection('verificationRequests').doc(id), {
          status: 'approved',
          reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
          reviewedByAdminSession: true,
          autoResolvedReason: 'user_already_verified'
        })
      })
      await batch.commit().catch((err) => {
        // Never let this cleanup write block the actual list response —
        // the request was already excluded above either way, so the
        // admin sees a correct queue this load even if the correction
        // write itself retries on a later one.
        console.error('[adminListVerificationRequests] stale-request cleanup failed', { message: err?.message })
      })
      await Promise.all(
        staleRequestIds.map((id) =>
          logAdminAction({
            adminUid: session.createdByUid,
            action: 'verification_auto_resolved',
            targetType: 'verificationRequest',
            targetId: id,
            reason: 'user_already_verified'
          })
        )
      )
    }

    return { requests }
  } catch (err) {
    console.error('[adminListVerificationRequests] unexpected error', { message: err?.message })
    throw new HttpsError('internal', 'Could not load verification requests. Please try again.')
  }
})

/**
 * ROOT CAUSE of "Unable to load verification image": this previously
 * called bucket().file(documentPath).getSignedUrl() — which, under the
 * hood, needs to RSA-sign the URL, and Cloud Functions v2 runs under
 * the project's default compute service account
 * (NNN-compute@developer.gserviceaccount.com — confirmed directly from
 * this function's own deployed service config), which does not have a
 * private key to sign with locally. Signing then requires calling the
 * IAM Credentials API's signBlob on itself, which needs the
 * "Service Account Token Creator" role bound to that same service
 * account — not granted by default. Without it, getSignedUrl() throws,
 * the catch block below converts that into a generic 'internal' error,
 * and VerificationReviewModal.jsx's catch turns that into "Unable to
 * load verification image."
 *
 * Fixed by never generating a URL at all: the Admin SDK downloads the
 * file's bytes directly (a plain object-read, which the Admin SDK
 * always has — no signing, no extra IAM role, same "bypasses Storage
 * rules the same way Admin SDK reads already bypass Firestore rules"
 * pattern every other function in this file already relies on) and
 * returns them as a base64 data URI in the callable's own response.
 * The image bytes travel through the SAME already-authenticated,
 * session-gated callable channel — never a fetchable Storage URL of
 * any kind, short-lived or not. Storage rules are untouched; nothing
 * about this makes the document more widely accessible than before.
 * Works identically for old and new verification requests — this reads
 * whatever `documentPath` already points at, regardless of when it was
 * submitted.
 */
exports.adminGetVerificationDocumentUrl = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken, documentPath } = request.data || {}
  await requireValidAdminSession(sessionToken)
  if (!documentPath || typeof documentPath !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing document path.')
  }
  try {
    const file = bucket().file(documentPath)
    const [exists] = await file.exists()
    if (!exists) throw new HttpsError('not-found', 'This document could not be found.')

    const [metadata] = await file.getMetadata()
    // Callable function responses top out around 10MB; base64 inflates
    // size by ~4/3, so this caps the SOURCE file well under that with
    // real margin for JSON overhead — generous for a phone-camera ID
    // photo, not unbounded, and a real stated limit rather than a
    // silent failure for an oversized legacy upload.
    const MAX_SOURCE_BYTES = 6 * 1024 * 1024
    if (Number(metadata.size) > MAX_SOURCE_BYTES) {
      throw new HttpsError('resource-exhausted', 'This document is too large to preview.')
    }

    const [buffer] = await file.download()
    const contentType = metadata.contentType || 'image/jpeg'
    return { url: `data:${contentType};base64,${buffer.toString('base64')}` }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[adminGetVerificationDocumentUrl] unexpected error', { documentPath, message: err?.message })
    throw new HttpsError('internal', 'Could not load this document. Please try again.')
  }
})

exports.adminReviewVerificationRequest = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken, requestId, decision, reason } = request.data || {}
  const session = await requireValidAdminSession(sessionToken)
  if (!requestId || !['approved', 'rejected'].includes(decision)) {
    throw new HttpsError('invalid-argument', 'Missing requestId or invalid decision.')
  }
  // Optional, only meaningful on rejection — an approval has nothing to
  // explain. Free text, capped generously; the client's own preset
  // reasons (Image unclear / ID doesn't match / etc.) are just strings
  // like any other, not a separate enum this function needs to know.
  const trimmedReason = typeof reason === 'string' ? reason.trim().slice(0, 200) : ''

  try {
    const reqRef = db().collection('verificationRequests').doc(requestId)
    let targetUid = null

    await db().runTransaction(async (tx) => {
      const snap = await tx.get(reqRef)
      if (!snap.exists) throw new HttpsError('not-found', 'This request no longer exists.')
      const data = snap.data()
      if (data.status !== 'pending') {
        throw new HttpsError('failed-precondition', `This request was already ${data.status}.`)
      }
      targetUid = data.uid

      if (decision === 'approved') {
        tx.update(db().collection('users').doc(data.uid), { verifiedCampus: true })
      }
      const update = {
        status: decision,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        reviewedByAdminSession: true
      }
      if (decision === 'rejected' && trimmedReason) update.rejectionReason = trimmedReason
      tx.update(reqRef, update)
    })

    if (decision === 'approved' && targetUid) {
      await applyVerifiedCampusReputationBonus(targetUid)
    }

    await logAdminAction({
      adminUid: session.createdByUid,
      action: decision === 'approved' ? 'verification_approved' : 'verification_rejected',
      targetType: 'verificationRequest',
      targetId: requestId,
      targetUid,
      reason: decision === 'rejected' ? trimmedReason || null : null
    })
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[adminReviewVerificationRequest] unexpected error', { requestId, message: err?.message })
    throw new HttpsError('internal', 'Could not update this request. Please try again.')
  }
})

/**
 * =====================================================================
 * VERIFIED CAMPUS CERTIFICATES — users/{uid}/achievementSubmissions/{id}
 * (created client-side, mirroring submitVerificationRequest's exact
 * shape: a unique-per-submission Storage path under
 * achievementCertificates/{uid}/{submissionId}/..., only the
 * `documentPath` stored in Firestore, never a public download URL) and
 * users/{uid}/verifiedAchievements/{id} (Admin-SDK-only, created here
 * on approval — never client-writable, so a user can never self-award
 * an official achievement). Preview reuses the EXISTING
 * adminGetVerificationDocumentUrl function unchanged below — it already
 * takes an arbitrary documentPath and returns a base64 data URI, so no
 * second preview function was needed for this feature.
 *
 * The submission doc id itself is the anti-farming mechanism: the
 * client derives it deterministically from (title, issuer, year) via a
 * slug (see achievementService.js), so re-submitting the exact same
 * achievement twice is structurally a Firestore "already exists" case
 * — firestore.rules blocks both overwriting an existing submission
 * (create-only) and ever updating one, so the same certificate can
 * never be resubmitted to farm a second review/reward.
 * =====================================================================
 */
async function sendSystemNotification(uid, data) {
  try {
    await db().collection('users').doc(uid).collection('notifications').add({
      actorUid: uid,
      actorName: 'Campinity',
      actorAvatar: '',
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...data
    })
  } catch (err) {
    console.error('[sendSystemNotification] failed', { uid, type: data?.type, message: err?.message })
  }
}

exports.adminListAchievementSubmissions = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken, status, pageSize } = request.data || {}
  await requireValidAdminSession(sessionToken)
  const limitCount = Math.min(Math.max(Number(pageSize) || 30, 1), 100)
  const statusFilter = ['pending', 'approved', 'rejected'].includes(status) ? status : 'pending'

  try {
    const snap = await db()
      .collectionGroup('achievementSubmissions')
      .where('status', '==', statusFilter)
      .orderBy('submittedAt', 'desc')
      .limit(limitCount)
      .get()

    const submissions = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data()
        const uid = d.ref.parent.parent.id
        const [userSnap, collegeSnap] = await Promise.all([
          db().collection('users').doc(uid).get().catch(() => null),
          data.collegeId ? db().collection('colleges').doc(data.collegeId).get().catch(() => null) : Promise.resolve(null)
        ])
        const userData = userSnap && userSnap.exists ? userSnap.data() : null

        return {
          id: d.id,
          uid,
          title: data.title || '',
          issuer: data.issuer || '',
          category: data.category || 'other',
          year: data.year || null,
          description: data.description || '',
          documentPath: data.documentPath || null,
          fileType: data.fileType || null,
          status: data.status,
          submittedAt: data.submittedAt,
          rejectionReason: data.rejectionReason || null,
          displayName: userData?.displayName || userData?.fullName || 'Unknown user',
          username: userData?.username || '',
          profilePhoto: userData?.profilePhoto || '',
          collegeName: collegeSnap && collegeSnap.exists ? collegeSnap.data().name : ''
        }
      })
    )

    return { submissions }
  } catch (err) {
    console.error('[adminListAchievementSubmissions] unexpected error', { message: err?.message })
    throw new HttpsError('internal', 'Could not load achievement submissions. Please try again.')
  }
})

exports.adminReviewAchievementSubmission = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken, uid, submissionId, decision, reason } = request.data || {}
  const session = await requireValidAdminSession(sessionToken)
  if (!uid || !submissionId || !['approved', 'rejected'].includes(decision)) {
    throw new HttpsError('invalid-argument', 'Missing uid/submissionId or invalid decision.')
  }
  const trimmedReason = typeof reason === 'string' ? reason.trim().slice(0, 200) : ''

  try {
    const subRef = db().collection('users').doc(uid).collection('achievementSubmissions').doc(submissionId)
    let submissionData = null

    await db().runTransaction(async (tx) => {
      const snap = await tx.get(subRef)
      if (!snap.exists) throw new HttpsError('not-found', 'This submission no longer exists.')
      const data = snap.data()
      if (data.status !== 'pending') {
        throw new HttpsError('failed-precondition', `This submission was already ${data.status}.`)
      }
      submissionData = data

      if (decision === 'approved') {
        // Doc id reused from the submission — the same "doc id as
        // idempotency key" pattern userBadges/{uid}/earned already
        // uses, so re-approving (which can't happen anyway, status is
        // checked above) could never create a duplicate record.
        const achievementRef = db().collection('users').doc(uid).collection('verifiedAchievements').doc(submissionId)
        tx.set(achievementRef, {
          title: data.title,
          issuer: data.issuer,
          collegeId: data.collegeId || null,
          category: data.category || 'other',
          year: data.year || null,
          description: data.description || '',
          verified: true,
          verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          verifiedBy: session.createdByUid,
          relatedSubmissionId: submissionId,
          earnedAt: admin.firestore.FieldValue.serverTimestamp(),
          seen: false
        })
      }

      const update = {
        status: decision,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        reviewedByAdminSession: true
      }
      if (decision === 'rejected' && trimmedReason) update.rejectionReason = trimmedReason
      tx.update(subRef, update)
    })

    if (decision === 'approved') {
      await sendSystemNotification(uid, {
        type: 'achievement_verified',
        achievementId: submissionId,
        achievementTitle: submissionData?.title || 'Achievement'
      })
    } else {
      await sendSystemNotification(uid, {
        type: 'achievement_rejected',
        achievementTitle: submissionData?.title || 'Achievement',
        rejectionReason: trimmedReason || null
      })
    }

    await logAdminAction({
      adminUid: session.createdByUid,
      action: decision === 'approved' ? 'achievement_verified' : 'achievement_rejected',
      targetType: 'achievementSubmission',
      targetId: submissionId,
      targetUid: uid,
      reason: decision === 'rejected' ? trimmedReason || null : null
    })
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[adminReviewAchievementSubmission] unexpected error', { uid, submissionId, message: err?.message })
    throw new HttpsError('internal', 'Could not update this submission. Please try again.')
  }
})

/**
 * =====================================================================
 * COLLEGE REQUESTS — collegeRequests/{requestId}, created by
 * AddCollegePage.jsx. Approval logic ported line-for-line from
 * collegeRequestService.js's reviewCollegeRequest (same slug-dedup
 * transaction, same "never overwrite an existing college" guarantee),
 * just performed via Admin SDK since that function's client-SDK path
 * is unreachable under the current rules (collegeRequests has no
 * client read/write rule for anyone).
 * =====================================================================
 */
function slugifyCollegeNameServer(name) {
  const STOPWORDS = new Set(['of', 'and', 'the', '&'])
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !STOPWORDS.has(word))
    .join('-')
}

function parseLocationServer(location) {
  const parts = (location || '').split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) return { city: parts[0], state: parts[1] }
  if (parts.length === 1) return { city: parts[0], state: '' }
  return { city: '', state: '' }
}

exports.adminListCollegeRequests = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken, pageSize } = request.data || {}
  await requireValidAdminSession(sessionToken)
  const limitCount = Math.min(Math.max(Number(pageSize) || 30, 1), 100)

  try {
    const snap = await db().collection('collegeRequests').where('status', '==', 'pending').limit(limitCount).get()
    return { requests: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }
  } catch (err) {
    console.error('[adminListCollegeRequests] unexpected error', { message: err?.message })
    throw new HttpsError('internal', 'Could not load college requests. Please try again.')
  }
})

exports.adminReviewCollegeRequest = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken, requestId, decision } = request.data || {}
  const session = await requireValidAdminSession(sessionToken)
  if (!requestId || !['approved', 'rejected'].includes(decision)) {
    throw new HttpsError('invalid-argument', 'Missing requestId or invalid decision.')
  }

  try {
    const reqRef = db().collection('collegeRequests').doc(requestId)

    await db().runTransaction(async (tx) => {
      const snap = await tx.get(reqRef)
      if (!snap.exists) throw new HttpsError('not-found', 'This request no longer exists.')
      const data = snap.data()
      if (data.status !== 'pending') {
        throw new HttpsError('failed-precondition', `This request was already ${data.status}.`)
      }

      if (decision === 'approved') {
        const slug = slugifyCollegeNameServer(data.name)
        const collegeRef = db().collection('colleges').doc(slug)
        const existing = await tx.get(collegeRef)
        if (!existing.exists) {
          const { city, state } = parseLocationServer(data.location)
          tx.set(collegeRef, {
            name: data.name,
            nameLower: (data.name || '').trim().toLowerCase(),
            city,
            cityLower: city.toLowerCase(),
            state,
            stateLower: state.toLowerCase(),
            verified: false
          })
        }
        // Already exists — deliberately no write, matching "must NOT
        // be deleted, renamed, overwritten, or duplicated."
      }
      tx.update(reqRef, { status: decision })
    })

    await logAdminAction({
      adminUid: session.createdByUid,
      action: decision === 'approved' ? 'college_request_approved' : 'college_request_rejected',
      targetType: 'collegeRequest',
      targetId: requestId
    })
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[adminReviewCollegeRequest] unexpected error', { requestId, message: err?.message })
    throw new HttpsError('internal', 'Could not update this request. Please try again.')
  }
})

/**
 * =====================================================================
 * USER VERIFICATION — deliberately distinct from Photo Verification
 * above: that section reviews the QUEUE of pending ID-document
 * submissions; this is a direct search/lookup over the real `users`
 * collection (already client-readable, so the search itself doesn't
 * need a Cloud Function — see adminAuthService.js's sibling client
 * helper — but the WRITE, a manual verifiedCampus override for edge
 * cases outside the normal queue, does).
 * =====================================================================
 */
exports.adminSetUserVerification = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken, uid, verified } = request.data || {}
  const session = await requireValidAdminSession(sessionToken)
  if (!uid || typeof verified !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Missing uid or verified flag.')
  }

  try {
    const userRef = db().collection('users').doc(uid)
    const snap = await userRef.get()
    if (!snap.exists) throw new HttpsError('not-found', 'This user no longer exists.')
    await userRef.update({ verifiedCampus: verified })

    if (verified) {
      await applyVerifiedCampusReputationBonus(uid)
    }

    // Bug 1 fix (prospective half): this is a second, independent path
    // to verifiedCampus besides adminReviewVerificationRequest, and it
    // used to have no idea a verificationRequests document could even
    // exist. Verifying someone here without also closing out their
    // pending request left it stuck at status: 'pending' forever, so it
    // kept reappearing in the Photo Verification queue even though the
    // user was already verified. Only runs on the verify direction —
    // revoking (verified === false) doesn't reopen or touch a request,
    // that's a separate concern from an existing submission.
    if (verified) {
      // Single-field equality query (uid only, no second .where()) —
      // deliberately avoids needing a new uid+status composite index;
      // a single user has at most a couple of these documents, so
      // filtering 'pending' in memory is cheap and doesn't add another
      // index this deploy would depend on.
      const requestsSnap = await db().collection('verificationRequests').where('uid', '==', uid).get()
      const pendingDocs = requestsSnap.docs.filter((d) => d.data().status === 'pending')
      if (pendingDocs.length > 0) {
        const batch = db().batch()
        pendingDocs.forEach((d) => {
          batch.update(d.ref, {
            status: 'approved',
            reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
            reviewedByAdminSession: true,
            autoResolvedReason: 'verified_via_user_search'
          })
        })
        await batch.commit()
      }
    }

    await logAdminAction({
      adminUid: session.createdByUid,
      action: verified ? 'user_verified_manual' : 'user_unverified_manual',
      targetType: 'user',
      targetId: uid,
      targetUid: uid
    })
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[adminSetUserVerification] unexpected error', { uid, message: err?.message })
    throw new HttpsError('internal', 'Could not update this user. Please try again.')
  }
})

/**
 * =====================================================================
 * MODERATION — the richer action set ModerationDashboardPage.jsx/
 * moderationService.js already modeled (content_removed/restricted/
 * suspended, not just resolve/dismiss), brought into the new
 * session-token-gated panel. Reads the SAME reports/{reportId} queue
 * adminListReports already serves — this is not a second report
 * system, just a richer action available on the same data.
 * =====================================================================
 */
exports.adminModerateContent = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken, reportId, moderationAction, targetType, targetId, targetOwnerUid, parentPostId } = request.data || {}
  const session = await requireValidAdminSession(sessionToken)
  const VALID_ACTIONS = ['resolved', 'dismissed', 'content_removed', 'restricted', 'suspended']
  if (!reportId || !VALID_ACTIONS.includes(moderationAction)) {
    throw new HttpsError('invalid-argument', 'Missing reportId or invalid action.')
  }

  try {
    const reportRef = db().collection('reports').doc(reportId)
    const reportSnap = await reportRef.get()
    if (!reportSnap.exists) throw new HttpsError('not-found', 'This report no longer exists.')
    if (reportSnap.data().status !== 'pending') {
      throw new HttpsError('failed-precondition', `This report was already ${reportSnap.data().status}.`)
    }

    if (moderationAction === 'content_removed') {
      if (targetType === 'post' && targetId) {
        await db().collection('posts').doc(targetId).delete().catch(() => {})
      } else if (targetType === 'comment' && targetId && parentPostId) {
        await db().collection('posts').doc(parentPostId).collection('comments').doc(targetId).delete().catch(() => {})
      } else if (targetType === 'story' && targetId) {
        await db().collection('stories').doc(targetId).delete().catch(() => {})
      }
      // Any other targetType: the report is still resolved below, but
      // no content deletion is attempted — a real, stated limitation
      // (matching ModerationDashboardPage.jsx's own comment on the
      // comment/parentPostId gap) rather than a silent no-op presented
      // as success.
    }

    if ((moderationAction === 'restricted' || moderationAction === 'suspended') && targetOwnerUid) {
      await db().collection('users').doc(targetOwnerUid).update({ moderationStatus: moderationAction })
      await applyModerationReputationPenalty(targetOwnerUid, moderationAction)
    }

    await reportRef.update({
      status: 'resolved',
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      moderationAction,
      reviewedByAdminSession: true
    })

    await logAdminAction({
      adminUid: session.createdByUid,
      action: moderationAction,
      targetType: targetType || 'report',
      targetId: targetId || reportId,
      targetUid: targetOwnerUid || null,
      reason: `report:${reportId}`
    })
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[adminModerateContent] unexpected error', { reportId, message: err?.message })
    throw new HttpsError('internal', 'Could not complete this action. Please try again.')
  }
})

/**
 * =====================================================================
 * LOST & FOUND — lostFound/{itemId}. "Remove" sets status: 'removed',
 * a new status value alongside the existing 'active'/'resolved' — the
 * user-facing getLostFoundItems() query always filters by an exact
 * status ('active' or 'resolved'), so a 'removed' item is automatically
 * excluded from both without any change to that read path at all.
 * Reversible via "restore", matching the brief's stated preference for
 * status-based over destructive moderation.
 * =====================================================================
 */
exports.adminListLostFound = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken, status, pageSize } = request.data || {}
  await requireValidAdminSession(sessionToken)
  const limitCount = Math.min(Math.max(Number(pageSize) || 30, 1), 100)

  try {
    const snap = await db()
      .collection('lostFound')
      .where('status', '==', status || 'active')
      .orderBy('createdAt', 'desc')
      .limit(limitCount)
      .get()
    return { items: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }
  } catch (err) {
    console.error('[adminListLostFound] unexpected error', { message: err?.message })
    throw new HttpsError('internal', 'Could not load Lost & Found listings. Please try again.')
  }
})

exports.adminModerateLostFoundItem = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken, itemId, action } = request.data || {}
  const session = await requireValidAdminSession(sessionToken)
  if (!itemId || !['remove', 'restore'].includes(action)) {
    throw new HttpsError('invalid-argument', 'Missing itemId or invalid action.')
  }

  try {
    const ref = db().collection('lostFound').doc(itemId)
    const snap = await ref.get()
    if (!snap.exists) throw new HttpsError('not-found', 'This listing no longer exists.')

    await ref.update({
      status: action === 'remove' ? 'removed' : 'active',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    })

    await logAdminAction({
      adminUid: session.createdByUid,
      action: action === 'remove' ? 'lostfound_removed' : 'lostfound_restored',
      targetType: 'lostFoundItem',
      targetId: itemId,
      targetUid: snap.data().createdBy || null
    })
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[adminModerateLostFoundItem] unexpected error', { itemId, message: err?.message })
    throw new HttpsError('internal', 'Could not update this listing. Please try again.')
  }
})

/**
 * =====================================================================
 * MARKETPLACE — products/{productId}. Adds a real `hidden` boolean
 * (default false, additive — every existing product document without
 * this field is treated as not-hidden by marketplaceService.js's own
 * mapProductDoc default). Reversible via "unhide", same reasoning as
 * Lost & Found above.
 * =====================================================================
 */
exports.adminListMarketplaceProducts = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken, pageSize } = request.data || {}
  await requireValidAdminSession(sessionToken)
  const limitCount = Math.min(Math.max(Number(pageSize) || 30, 1), 100)

  try {
    const snap = await db().collection('products').orderBy('createdAt', 'desc').limit(limitCount).get()
    return { products: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }
  } catch (err) {
    console.error('[adminListMarketplaceProducts] unexpected error', { message: err?.message })
    throw new HttpsError('internal', 'Could not load marketplace listings. Please try again.')
  }
})

exports.adminModerateProduct = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken, productId, action } = request.data || {}
  const session = await requireValidAdminSession(sessionToken)
  if (!productId || !['hide', 'unhide'].includes(action)) {
    throw new HttpsError('invalid-argument', 'Missing productId or invalid action.')
  }

  try {
    const ref = db().collection('products').doc(productId)
    const snap = await ref.get()
    if (!snap.exists) throw new HttpsError('not-found', 'This listing no longer exists.')

    await ref.update({ hidden: action === 'hide' })

    await logAdminAction({
      adminUid: session.createdByUid,
      action: action === 'hide' ? 'product_hidden' : 'product_unhidden',
      targetType: 'product',
      targetId: productId,
      targetUid: snap.data().sellerId || null
    })
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[adminModerateProduct] unexpected error', { productId, message: err?.message })
    throw new HttpsError('internal', 'Could not update this listing. Please try again.')
  }
})

/**
 * =====================================================================
 * USER MODERATION STATUS — users/{uid}.moderationStatus, the same field
 * adminModerateContent already writes when a report leads to "restrict"/
 * "suspend." This is the same action reachable directly from a user
 * search result (AdminUserVerificationPage.jsx) instead of only via an
 * existing report — same field, same allowed values, no new schema.
 * =====================================================================
 */
exports.adminSetUserModerationStatus = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken, uid, status } = request.data || {}
  const session = await requireValidAdminSession(sessionToken)
  const VALID_STATUSES = ['active', 'restricted', 'suspended']
  if (!uid || !VALID_STATUSES.includes(status)) {
    throw new HttpsError('invalid-argument', 'Missing uid or invalid status.')
  }

  try {
    const userRef = db().collection('users').doc(uid)
    const snap = await userRef.get()
    if (!snap.exists) throw new HttpsError('not-found', 'This user no longer exists.')
    // 'active' clears the flag entirely rather than storing a value that
    // would otherwise need every reader to special-case as "not really
    // restricted" — matches how verifiedCampus/hidden fields elsewhere
    // in this admin panel use absence-of-field as the "normal" state.
    await userRef.update({
      moderationStatus: status === 'active' ? admin.firestore.FieldValue.delete() : status
    })

    if (status === 'restricted' || status === 'suspended') {
      await applyModerationReputationPenalty(uid, status)
    }

    await logAdminAction({
      adminUid: session.createdByUid,
      action: status === 'active' ? 'user_restored' : status === 'suspended' ? 'suspended' : 'restricted',
      targetType: 'user',
      targetId: uid,
      targetUid: uid
    })
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[adminSetUserModerationStatus] unexpected error', { uid, message: err?.message })
    throw new HttpsError('internal', 'Could not update this user. Please try again.')
  }
})

/**
 * =====================================================================
 * COMMUNITIES — communities/{id} + communityMembers/{communityId_uid} +
 * communityBans/{communityId_uid}, the exact same collections/schema
 * communityService.js's client-side createCommunity/joinCommunity/
 * removeMember/banMember already use (confirmed by reading that file
 * directly). Community owners/admins already have remove/ban through
 * the app itself, gated by firestore.rules checking their real
 * community role — a platform admin using only the password session has
 * no such role, so these mirror that exact transaction logic via the
 * Admin SDK instead of duplicating a second moderation model.
 * =====================================================================
 */
exports.adminListCommunities = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken, pageSize } = request.data || {}
  await requireValidAdminSession(sessionToken)
  const limitCount = Math.min(Math.max(Number(pageSize) || 30, 1), 100)

  try {
    const snap = await db().collection('communities').orderBy('createdAt', 'desc').limit(limitCount).get()
    return { communities: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }
  } catch (err) {
    console.error('[adminListCommunities] unexpected error', { message: err?.message })
    throw new HttpsError('internal', 'Could not load communities. Please try again.')
  }
})

/** Members of one community, newest first, enriched with displayName/username the same way adminListVerificationRequests enriches its queue. */
exports.adminListCommunityMembers = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken, communityId, pageSize } = request.data || {}
  await requireValidAdminSession(sessionToken)
  if (!communityId) throw new HttpsError('invalid-argument', 'Missing communityId.')
  const limitCount = Math.min(Math.max(Number(pageSize) || 50, 1), 200)

  try {
    const snap = await db()
      .collection('communityMembers')
      .where('communityId', '==', communityId)
      .orderBy('joinedAt', 'desc')
      .limit(limitCount)
      .get()

    const members = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data()
        const userSnap = await db().collection('users').doc(data.uid).get().catch(() => null)
        const userData = userSnap && userSnap.exists ? userSnap.data() : null
        return {
          uid: data.uid,
          role: data.role || 'member',
          joinedAt: data.joinedAt,
          displayName: userData?.displayName || userData?.fullName || 'Unknown user',
          username: userData?.username || ''
        }
      })
    )
    return { members }
  } catch (err) {
    console.error('[adminListCommunityMembers] unexpected error', { communityId, message: err?.message })
    throw new HttpsError('internal', 'Could not load members. Please try again.')
  }
})

exports.adminModerateCommunityMember = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken, communityId, targetUid, action } = request.data || {}
  const session = await requireValidAdminSession(sessionToken)
  const VALID_ACTIONS = ['remove', 'ban', 'unban']
  if (!communityId || !targetUid || !VALID_ACTIONS.includes(action)) {
    throw new HttpsError('invalid-argument', 'Missing communityId/targetUid or invalid action.')
  }

  const memberRef = db().collection('communityMembers').doc(`${communityId}_${targetUid}`)
  const banRef = db().collection('communityBans').doc(`${communityId}_${targetUid}`)
  const communityRef = db().collection('communities').doc(communityId)

  try {
    if (action === 'unban') {
      await banRef.delete().catch(() => {})
    } else {
      // 'remove' and 'ban' both start with the same membership cleanup —
      // ban additionally writes the communityBans record removeMember
      // never does, exactly mirroring communityService.js's own
      // removeMember vs banMember distinction.
      await db().runTransaction(async (tx) => {
        const communitySnap = await tx.get(communityRef)
        if (!communitySnap.exists) throw new HttpsError('not-found', 'This community no longer exists.')
        const community = communitySnap.data()
        if (community.ownerId === targetUid) {
          throw new HttpsError('failed-precondition', 'The owner cannot be removed or banned — transfer ownership first.')
        }

        const memberSnap = await tx.get(memberRef)
        if (memberSnap.exists) {
          tx.delete(memberRef)
          tx.update(communityRef, { membersCount: admin.firestore.FieldValue.increment(-1) })
          const admins = community.admins || []
          const moderators = community.moderators || []
          if (admins.includes(targetUid)) tx.update(communityRef, { admins: admin.firestore.FieldValue.arrayRemove(targetUid) })
          if (moderators.includes(targetUid)) tx.update(communityRef, { moderators: admin.firestore.FieldValue.arrayRemove(targetUid) })
        }

        if (action === 'ban') {
          tx.set(banRef, {
            communityId,
            uid: targetUid,
            bannedBy: session.createdByUid,
            bannedAt: admin.firestore.FieldValue.serverTimestamp()
          })
        }
      })
    }

    await logAdminAction({
      adminUid: session.createdByUid,
      action: action === 'remove' ? 'community_member_removed' : action === 'ban' ? 'community_member_banned' : 'community_member_unbanned',
      targetType: 'communityMember',
      targetId: communityId,
      targetUid
    })
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[adminModerateCommunityMember] unexpected error', { communityId, targetUid, message: err?.message })
    throw new HttpsError('internal', 'Could not complete this action. Please try again.')
  }
})

/**
 * =====================================================================
 * NOTIFICATIONS — a real admin broadcast, using the EXACT
 * notifications/{notificationId} schema and 'announcement' type
 * createCommunityAnnouncementNotifications (notificationService.js)
 * already established (same field shape, same 450-per-batch fan-out) —
 * not a second notification system. Rendered by the app's existing
 * notificationText.js 'announcement' case with zero new client code:
 * communityName: 'Campinity' reads as "Campinity posted an update."
 * capped at 5000 recipients for an all-users send — a real, stated
 * bound, not silently unlimited.
 * =====================================================================
 */
/**
 * Phase 2 campus-announcements pass: this function already was a real
 * admin-only broadcast (notification-only). Extended, not duplicated:
 * - optional `collegeId` scopes the recipient list to one college
 *   instead of every user on the platform — the actual "campus-wide"
 *   half of "Campus Announcements."
 * - optional `title`/`pinned`/`priority`/`expiresAt` are new, and a
 *   broadcast (never a single targetUsername — that stays a private
 *   notification, not a public notice) now ALSO persists a real
 *   announcements/{id} document, so students can see it as a standing
 *   "Campus Notice" even after the notification itself is read/missed,
 *   not just a one-shot toast. No second notification system — the
 *   per-user fan-out below is byte-for-byte the same batched write this
 *   function already did.
 */
exports.adminSendNotification = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken, message, targetUsername, collegeId, title, pinned, priority, expiresAt } = request.data || {}
  const session = await requireValidAdminSession(sessionToken)
  const trimmed = (message || '').trim()
  if (!trimmed) throw new HttpsError('invalid-argument', 'Message is required.')
  if (trimmed.length > 280) throw new HttpsError('invalid-argument', 'Message must be 280 characters or fewer.')
  const isBroadcast = !targetUsername || !targetUsername.trim()
  const VALID_PRIORITIES = ['normal', 'important', 'urgent']
  const normalizedPriority = VALID_PRIORITIES.includes(priority) ? priority : 'normal'

  try {
    let recipientUids = []
    if (!isBroadcast) {
      const userSnap = await db().collection('users').where('username', '==', targetUsername.trim()).limit(1).get()
      if (userSnap.empty) throw new HttpsError('not-found', 'No user found with that username.')
      recipientUids = [userSnap.docs[0].id]
    } else {
      const MAX_RECIPIENTS = 5000
      let usersQuery = db().collection('users').limit(MAX_RECIPIENTS)
      if (collegeId && collegeId.trim()) usersQuery = db().collection('users').where('collegeId', '==', collegeId.trim()).limit(MAX_RECIPIENTS)
      const usersSnap = await usersQuery.get()
      recipientUids = usersSnap.docs.map((d) => d.id)
    }

    for (let i = 0; i < recipientUids.length; i += 450) {
      const batch = db().batch()
      recipientUids.slice(i, i + 450).forEach((uid) => {
        const notifRef = db().collection('users').doc(uid).collection('notifications').doc()
        batch.set(notifRef, {
          actorUid: uid, // system notification — same "actorUid === target" convention createBadgeNotification/createLevelUpNotification already use for a non-person sender
          actorName: 'Campinity',
          actorAvatar: '',
          type: 'announcement',
          communityId: null,
          communityName: 'Campinity',
          message: trimmed,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        })
      })
      await batch.commit()
    }

    let announcementId = null
    if (isBroadcast) {
      const expiresAtTimestamp = expiresAt ? admin.firestore.Timestamp.fromMillis(Number(expiresAt)) : null
      const announcementRef = await db().collection('announcements').add({
        title: (title || '').trim().slice(0, 120) || null,
        body: trimmed,
        authorId: session.createdByUid,
        collegeId: collegeId && collegeId.trim() ? collegeId.trim() : null,
        pinned: Boolean(pinned),
        priority: normalizedPriority,
        visibility: 'public',
        expiresAt: expiresAtTimestamp,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })
      announcementId = announcementRef.id
    }

    await logAdminAction({
      adminUid: session.createdByUid,
      action: 'notification_sent',
      targetType: targetUsername ? 'user' : 'all_users',
      targetId: announcementId,
      targetUid: targetUsername ? recipientUids[0] : null,
      reason: trimmed.slice(0, 100)
    })
    return { ok: true, recipientCount: recipientUids.length, announcementId }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[adminSendNotification] unexpected error', { message: err?.message })
    throw new HttpsError('internal', 'Could not send this notification. Please try again.')
  }
})

/** Toggle pin on a campus announcement — same admin-session pattern as every other admin write here. */
exports.adminSetAnnouncementPinned = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken, announcementId, pinned } = request.data || {}
  const session = await requireValidAdminSession(sessionToken)
  if (!announcementId) throw new HttpsError('invalid-argument', 'Missing announcementId.')

  try {
    const ref = db().collection('announcements').doc(announcementId)
    const snap = await ref.get()
    if (!snap.exists) throw new HttpsError('not-found', 'This announcement no longer exists.')
    await ref.update({ pinned: Boolean(pinned), updatedAt: admin.firestore.FieldValue.serverTimestamp() })
    await logAdminAction({
      adminUid: session.createdByUid,
      action: pinned ? 'announcement_pinned' : 'announcement_unpinned',
      targetType: 'announcement',
      targetId: announcementId
    })
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[adminSetAnnouncementPinned] unexpected error', { announcementId, message: err?.message })
    throw new HttpsError('internal', 'Could not update this announcement. Please try again.')
  }
})

/** Remove a campus announcement — the notifications already sent are unaffected, only the persisted "Campus Notice" record is deleted. */
exports.adminDeleteAnnouncement = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken, announcementId } = request.data || {}
  const session = await requireValidAdminSession(sessionToken)
  if (!announcementId) throw new HttpsError('invalid-argument', 'Missing announcementId.')

  try {
    await db().collection('announcements').doc(announcementId).delete()
    await logAdminAction({
      adminUid: session.createdByUid,
      action: 'announcement_removed',
      targetType: 'announcement',
      targetId: announcementId
    })
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[adminDeleteAnnouncement] unexpected error', { announcementId, message: err?.message })
    throw new HttpsError('internal', 'Could not remove this announcement. Please try again.')
  }
})

/** adminListAuditLog — read side of logAdminAction() above, the actual "Audit Log" admin section. */
exports.adminListAuditLog = onCall({ region: 'us-central1' }, async (request) => {
  const { sessionToken, pageSize } = request.data || {}
  await requireValidAdminSession(sessionToken)
  const limitCount = Math.min(Math.max(Number(pageSize) || 50, 1), 200)

  try {
    const snap = await db().collection('moderationActions').orderBy('createdAt', 'desc').limit(limitCount).get()
    return { entries: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }
  } catch (err) {
    console.error('[adminListAuditLog] unexpected error', { message: err?.message })
    throw new HttpsError('internal', 'Could not load the audit log. Please try again.')
  }
})

/**
 * =====================================================================
 * CUSTOM EMAIL VERIFICATION — replaces Firebase's hosted
 * sendEmailVerification()/__/auth/action/oobCode flow with our own
 * cryptographically-random, SHA-256-hashed, single-use tokens stored
 * in emailVerificationTokens/{tokenHash} (locked to
 * `allow read, write: if false` in firestore.rules — Admin SDK only,
 * same pattern as adminSession/platformAdmins above). Firebase
 * Authentication itself is NOT replaced — accounts, sessions, Google
 * Sign-In and password reset are untouched; only how emailVerified
 * gets flipped to true changes.
 *
 * The raw token only ever exists in memory long enough to build the
 * verification URL and hand it to the mailer — it is never stored,
 * returned to the caller, or logged. Only its SHA-256 hash (which also
 * doubles as the Firestore document ID, so lookup is a direct get(),
 * no query needed) is persisted.
 *
 * Email sending itself goes through email/mailer.js -> resendProvider.js.
 * No email provider existed anywhere in this repo before this change
 * (confirmed by searching for Resend/SendGrid/Mailgun/Postmark/SMTP/
 * Nodemailer/Brevo/SES and every functions/env config). Resend was
 * chosen as the provider — see this feature's final report for setup
 * steps. Until RESEND_API_KEY is configured via
 * `firebase functions:secrets:set RESEND_API_KEY`, these functions'
 * token/Firestore logic is fully wired and correct, but the actual
 * send will fail — that failure is surfaced as a clear 'unavailable'
 * error rather than silently pretending an email went out.
 * =====================================================================
 */

const EMAIL_VERIFICATION_TOKEN_BYTES = 32 // 32 bytes = 256 bits of entropy, well above the brief's 32-byte floor
const EMAIL_VERIFICATION_TOKEN_TTL_MS = 20 * 60 * 1000 // 20 minutes — within the requested 15-30 minute window
const EMAIL_VERIFICATION_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const EMAIL_VERIFICATION_RATE_LIMIT_MAX = 3 // matches the brief's suggested "max 3 per 15 minutes per user"
const EMAIL_VERIFICATION_STALE_CLAIM_MS = 2 * 60 * 1000 // see claimEmailVerificationToken below
// APP_BASE_URL is a plain (non-secret) env var, NOT Secret Manager — set
// it via functions/functions/.env.<projectId> if it should ever differ
// from this default in production. functions/functions/.env.local (used
// only by the emulator, never deployed) overrides it to localhost for
// local testing so production links can never point at localhost.
// Default is the actual deployed app (confirmed live, returns 200) —
// campinity.in does not currently resolve to anything and must not be
// used as the default until/unless it's a real custom domain for this
// app.
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://campinity-app.vercel.app'

function emailVerificationTokens() {
  return db().collection('emailVerificationTokens')
}

// emailVerificationActiveTokens/{uid} — a single pointer doc per user to
// whichever token is currently their "live" one. Storing this instead of
// querying emailVerificationTokens by uid means invalidating a previous
// token is always a direct-by-ID get/update, never a compound Firestore
// query — sidesteps any question of whether such a query would need a
// manual composite index (Task 10).
function emailVerificationActiveTokenDoc(uid) {
  return db().collection('emailVerificationActiveTokens').doc(uid)
}

function emailVerificationRateLimitDoc(uid) {
  return db().collection('emailVerificationRateLimits').doc(uid)
}

function hashVerificationToken(rawToken) {
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(rawToken).digest('hex')
}

/**
 * Server-side rate limit, independent of anything the client claims —
 * a fixed-window counter stored per-uid so this never needs a Firestore
 * range query (which would require a manual composite index) just to
 * count recent sends. Throws resource-exhausted once the window's
 * budget is used up; otherwise increments (or starts a fresh window).
 */
async function enforceEmailVerificationRateLimit(uid) {
  const rateRef = emailVerificationRateLimitDoc(uid)
  await db().runTransaction(async (transaction) => {
    const snap = await transaction.get(rateRef)
    const now = Date.now()
    const data = snap.exists ? snap.data() : null
    const windowExpired = !data?.windowStart || now - data.windowStart.toMillis() > EMAIL_VERIFICATION_RATE_LIMIT_WINDOW_MS

    if (windowExpired) {
      transaction.set(rateRef, { windowStart: admin.firestore.Timestamp.fromMillis(now), count: 1 })
      return
    }

    if (data.count >= EMAIL_VERIFICATION_RATE_LIMIT_MAX) {
      throw new HttpsError('resource-exhausted', 'Too many verification emails requested. Please wait a few minutes and try again.')
    }

    transaction.update(rateRef, { count: admin.firestore.FieldValue.increment(1) })
  })
}

/**
 * Generates a fresh token and sends the verification email BEFORE
 * touching Firestore at all. Only once the send has actually succeeded
 * does this persist the new token and invalidate the previous one for
 * this uid, in a single transaction. This ordering matters (Task 8): the
 * previous implementation invalidated the old token and wrote the new
 * one first, then sent the email — so a Resend failure left the user
 * with a freshly "active" token they were never actually sent, while
 * their previous (possibly still-valid) link had already been burned.
 * With this ordering, a send failure leaves any previous token exactly
 * as it was — nothing the user already has stops working.
 */
async function issueEmailVerificationToken(uid, email) {
  await enforceEmailVerificationRateLimit(uid)

  const crypto = require('crypto')
  const rawToken = crypto.randomBytes(EMAIL_VERIFICATION_TOKEN_BYTES).toString('hex')
  const tokenHash = hashVerificationToken(rawToken)
  const verifyUrl = `${APP_BASE_URL}/verify-email?token=${rawToken}`

  try {
    await sendVerificationEmail({ to: email, verifyUrl })
  } catch (err) {
    // Do not log verifyUrl/rawToken — only the failure itself.
    console.error('[issueEmailVerificationToken] send failed', { uid, message: err?.message })
    throw new HttpsError('unavailable', 'Could not send the verification email. Please try again shortly.')
  }

  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS)
  const activeRef = emailVerificationActiveTokenDoc(uid)

  try {
    await db().runTransaction(async (transaction) => {
      const activeSnap = await transaction.get(activeRef)
      const previousTokenHash = activeSnap.exists ? activeSnap.data()?.tokenHash : null

      if (previousTokenHash && previousTokenHash !== tokenHash) {
        transaction.update(emailVerificationTokens().doc(previousTokenHash), {
          status: 'invalidated',
          invalidatedAt: admin.firestore.FieldValue.serverTimestamp()
        })
      }

      transaction.set(emailVerificationTokens().doc(tokenHash), {
        uid,
        email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt,
        status: 'active'
      })
      transaction.set(activeRef, { tokenHash, expiresAt })
    })
  } catch (err) {
    // The email is already out with a working link at this point — a
    // failure here just means we couldn't also invalidate the *previous*
    // link or update the pointer doc. Not ideal, but never worse than
    // before this pass, and never silently swallowed.
    console.error('[issueEmailVerificationToken] persist failed after send', { uid, message: err?.message })
    throw new HttpsError('internal', 'The verification email was sent, but something went wrong finishing setup. If the link in your email does not work, please resend.')
  }
}

/**
 * Atomically claims a token for verification: active -> claiming. Using
 * a three-state model (active / claiming / verified / invalidated)
 * instead of a plain used boolean (Task 9) means a transient failure in
 * the Admin Auth call that follows this (outside any Firestore
 * transaction) can never permanently strand a token as "used" without
 * the email ever actually being verified — see the caller below, which
 * rolls the status back to 'active' on any such failure. A stale
 * 'claiming' status (a previous attempt crashed between claiming and
 * finishing) is treated as retryable after EMAIL_VERIFICATION_STALE_CLAIM_MS;
 * a fresh 'claiming' status is treated the same as already-used, so two
 * concurrent requests for the same token still cannot both succeed.
 */
async function claimEmailVerificationToken(tokenRef) {
  return db().runTransaction(async (transaction) => {
    const snap = await transaction.get(tokenRef)
    if (!snap.exists) {
      throw new HttpsError('not-found', 'This verification link is invalid.', { reason: 'invalid' })
    }

    const data = snap.data()
    if (!data.expiresAt || data.expiresAt.toMillis() < Date.now()) {
      throw new HttpsError('failed-precondition', 'This verification link has expired.', { reason: 'expired' })
    }
    if (data.status === 'verified' || data.status === 'invalidated') {
      throw new HttpsError('failed-precondition', 'This verification link has already been used.', { reason: 'already-used' })
    }
    if (data.status === 'claiming') {
      const claimAgeMs = data.claimedAt ? Date.now() - data.claimedAt.toMillis() : Infinity
      if (claimAgeMs < EMAIL_VERIFICATION_STALE_CLAIM_MS) {
        throw new HttpsError('failed-precondition', 'This verification link is already being processed. Please wait a moment and try again.', { reason: 'already-used' })
      }
      // Stale claim from a crashed/failed previous attempt — safe to retry.
    }

    transaction.update(tokenRef, { status: 'claiming', claimedAt: admin.firestore.FieldValue.serverTimestamp() })
    return { uid: data.uid, email: data.email }
  })
}

/**
 * createEmailVerification — called once right after signup. UID and
 * email come only from the authenticated Firebase Auth context/Admin
 * SDK lookup, never from client-supplied data.
 *
 * NOT declaring `secrets: ['RESEND_API_KEY']` here yet — Firebase
 * Functions v2 refuses to deploy a function that references a secret
 * that doesn't exist in Secret Manager yet, and RESEND_API_KEY has
 * never been set for this project (confirmed via
 * `firebase functions:secrets:access`, which 404'd). Once it's set
 * (see this bugfix's final report), add `secrets: ['RESEND_API_KEY']`
 * back to both this function and resendEmailVerification below and
 * redeploy — until then, process.env.RESEND_API_KEY is simply
 * undefined and resendProvider.js throws its own clear "not
 * configured" error, which is the intended, honest failure mode.
 */
exports.createEmailVerification = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You need to be signed in.')
  }

  try {
    const userRecord = await admin.auth().getUser(uid)
    if (userRecord.emailVerified) {
      return { ok: true, alreadyVerified: true }
    }
    if (!userRecord.email) {
      throw new HttpsError('failed-precondition', 'This account has no email address to verify.')
    }

    await issueEmailVerificationToken(uid, userRecord.email)
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[createEmailVerification] unexpected error', { uid, message: err?.message, code: err?.code })
    throw new HttpsError('internal', 'Could not send the verification email. Please try again.')
  }
})

/**
 * resendEmailVerification — Phase 5. Same authenticated-only,
 * server-derived-email rules as createEmailVerification, plus the
 * shared rate limit inside issueEmailVerificationToken above. See the
 * comment on createEmailVerification above re: RESEND_API_KEY not
 * being declared in `secrets` yet.
 */
exports.resendEmailVerification = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You need to be signed in.')
  }

  try {
    const userRecord = await admin.auth().getUser(uid)
    if (userRecord.emailVerified) {
      return { ok: true, alreadyVerified: true }
    }
    if (!userRecord.email) {
      throw new HttpsError('failed-precondition', 'This account has no email address to verify.')
    }

    await issueEmailVerificationToken(uid, userRecord.email)
    return { ok: true }
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[resendEmailVerification] unexpected error', { uid, message: err?.message, code: err?.code })
    throw new HttpsError('internal', 'Could not resend the verification email. Please try again.')
  }
})

/**
 * verifyEmailVerificationToken — Phase 3. Deliberately does NOT require
 * request.auth: the person clicking the emailed link may be on a
 * different browser/device than the one they signed up on (exactly why
 * Firebase's own oobCode links don't require an active session either).
 * The token itself, hashed and matched against Firestore, is the only
 * credential. claimEmailVerificationToken above atomically transitions
 * active -> claiming so two concurrent requests with the same token
 * cannot both succeed; emailVerified is only flipped via the Admin SDK
 * afterward, and the client can never set it directly (no firestore.rules
 * path lets a client touch emailVerified, and the Firebase Auth user
 * record itself is only ever writable server-side).
 *
 * If the Admin Auth call fails after a successful claim (Task 9), the
 * claim is rolled back to 'active' so the same token remains usable —
 * a transient Admin Auth failure must never permanently burn a token
 * the user never actually got verified with.
 */
exports.verifyEmailVerificationToken = onCall({ region: 'us-central1' }, async (request) => {
  const { token } = request.data || {}

  if (!token || typeof token !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing verification token.', { reason: 'invalid' })
  }
  // A 32-byte token hex-encodes to 64 characters. Reject anything wildly
  // off that shape before it ever touches Firestore.
  if (token.length < 32 || token.length > 128 || !/^[a-f0-9]+$/i.test(token)) {
    throw new HttpsError('invalid-argument', 'This verification link is invalid.', { reason: 'invalid' })
  }

  const tokenHash = hashVerificationToken(token)
  const tokenRef = emailVerificationTokens().doc(tokenHash)

  let claim
  try {
    claim = await claimEmailVerificationToken(tokenRef)
  } catch (err) {
    if (err instanceof HttpsError) throw err
    console.error('[verifyEmailVerificationToken] claim failed', { message: err?.message, code: err?.code })
    throw new HttpsError('internal', 'Something went wrong. Please try again.', { reason: 'server-error' })
  }

  try {
    const userRecord = await admin.auth().getUser(claim.uid)
    // If the account's email changed since this token was issued, the
    // token is stale — do not verify an email it was never issued for.
    if (claim.email && userRecord.email && userRecord.email !== claim.email) {
      throw new HttpsError('failed-precondition', 'This verification link is no longer valid.', { reason: 'invalid' })
    }

    await admin.auth().updateUser(claim.uid, { emailVerified: true })
    await tokenRef.update({ status: 'verified', verifiedAt: admin.firestore.FieldValue.serverTimestamp() })
    return { ok: true }
  } catch (err) {
    // Roll the claim back so a legitimate retry can still complete —
    // see this function's own doc comment and Task 9.
    await tokenRef.update({ status: 'active', claimedAt: admin.firestore.FieldValue.delete() }).catch((rollbackErr) => {
      console.error('[verifyEmailVerificationToken] rollback failed', { uid: claim.uid, message: rollbackErr?.message })
    })

    if (err instanceof HttpsError) throw err
    console.error('[verifyEmailVerificationToken] finalize failed', { uid: claim.uid, message: err?.message, code: err?.code })
    if (err?.code === 'auth/user-not-found') {
      throw new HttpsError('not-found', 'This account no longer exists.', { reason: 'invalid' })
    }
    throw new HttpsError('internal', 'Something went wrong. Please try again.', { reason: 'server-error' })
  }
})
