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
