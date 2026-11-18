/**
 * Admin password rotation — the pure, testable core used by
 * `admin-device-owner.cjs rotate-password`.
 *
 * Guarantees (each covered by tests/rules/admin-password-rotation.emulator.test.mjs):
 *  - Only UPDATES the existing adminSession/config document inside a
 *    transaction. If it does not exist, it refuses — it never creates,
 *    deletes or recreates it.
 *  - Same storage format the Cloud Functions verify: hex scrypt(password,
 *    salt, 64) with a fresh 16-byte hex salt. createdAt / createdByUid are
 *    left untouched; rotatedAt is added.
 *  - Enrolled devices (adminDevices/*) are never touched, so device
 *    enrollment survives the rotation.
 *  - Optional endSessions deletes active admin sessions
 *    (adminSession/tokens/items/*) so every device must unlock again with
 *    the new password. The adminSession/tokens parent doc is left alone.
 *  - The password is never logged, returned or written anywhere except as
 *    the salted hash; the audit entry carries no secret.
 */
const crypto = require('node:crypto')
const { promisify } = require('node:util')

const scrypt = promisify(crypto.scrypt)
const MIN_LENGTH = 12
const MAX_LENGTH = 256

async function hashSecret(value, salt) {
  return (await scrypt(value, salt, 64)).toString('hex')
}

function validateNewPassword(pw) {
  if (typeof pw !== 'string' || !pw) return 'No password entered.'
  if (pw.length < MIN_LENGTH) return `The new password must be at least ${MIN_LENGTH} characters.`
  if (pw.length > MAX_LENGTH) return `The new password must be at most ${MAX_LENGTH} characters.`
  if (pw.trim() !== pw) return 'The new password must not start or end with spaces.'
  if (new Set(pw).size < 5) return 'The new password is too repetitive.'
  return null
}

/**
 * @param db        Firestore instance (admin SDK or @google-cloud/firestore)
 * @param Timestamp matching Timestamp class
 * @param opts      { newPassword, endSessions?: boolean }
 * @returns { sessionsEnded }
 */
async function rotateAdminPassword(db, Timestamp, { newPassword, endSessions = false }) {
  const problem = validateNewPassword(newPassword)
  if (problem) throw new Error(problem)

  const configRef = db.collection('adminSession').doc('config')
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = await hashSecret(newPassword, salt)

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(configRef)
    if (!snap.exists) throw new Error('adminSession/config does not exist. Refusing: this command only rotates an existing password and never creates one.')
    const cur = snap.data() || {}
    if (typeof cur.hash !== 'string' || typeof cur.salt !== 'string') throw new Error('adminSession/config is not in the expected format. Refusing to modify it.')
    const a = Buffer.from(cur.hash, 'hex')
    const b = Buffer.from(await hashSecret(newPassword, cur.salt), 'hex')
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) throw new Error('The new password is the same as the current one. Choose a different password.')
    tx.update(configRef, { hash, salt, rotatedAt: Timestamp.now() })
  })

  let sessionsEnded = 0
  if (endSessions) {
    const items = await db.collection('adminSession').doc('tokens').collection('items').get()
    for (let i = 0; i < items.docs.length; i += 400) {
      const batch = db.batch()
      items.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref))
      await batch.commit()
    }
    sessionsEnded = items.size
  }

  await db.collection('moderationActions').add({
    adminUid: null,
    action: 'admin_password_rotated',
    targetType: 'adminSession',
    targetId: 'config',
    targetUid: null,
    reportId: null,
    reason: 'owner script',
    viaOwnerScript: true,
    sessionsEnded,
    createdAt: Timestamp.now()
  })
  return { sessionsEnded }
}

/**
 * Reads a line from the terminal without echoing it. Refuses when stdin
 * is not an interactive terminal, so the password can never come from a
 * pipe, file, argument or environment variable.
 */
function readHidden(prompt, { input = process.stdin, output = process.stderr } = {}) {
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    return Promise.reject(new Error('rotate-password must be run in an interactive terminal (passwords are never accepted from pipes, files, arguments or environment variables).'))
  }
  return new Promise((resolve, reject) => {
    output.write(prompt)
    let value = ''
    const done = (err) => {
      input.setRawMode(false)
      input.pause()
      input.removeListener('data', onData)
      output.write('\n')
      if (err) reject(err)
      else resolve(value)
    }
    const onData = (buf) => {
      for (const ch of buf.toString('utf8')) {
        if (ch === '\r' || ch === '\n') return done()
        if (ch === '\u0003') return done(new Error('Cancelled.'))
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1)
        else if (ch >= ' ') value += ch
      }
    }
    input.setRawMode(true)
    input.resume()
    input.on('data', onData)
  })
}

module.exports = { rotateAdminPassword, validateNewPassword, readHidden, hashSecret, MIN_LENGTH }
