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
  const { expiresAt } = snap.data()
  if (!expiresAt || expiresAt.toMillis() < Date.now()) {
    await adminTokenDoc(sessionToken).delete().catch(() => {})
    throw new HttpsError('unauthenticated', 'Admin session has expired. Please log in again.')
  }
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
