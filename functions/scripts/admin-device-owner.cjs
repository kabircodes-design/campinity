#!/usr/bin/env node
/**
 * CAMPINITY ADMIN — owner-controlled device management (run on YOUR laptop).
 *
 * This script is the root of trust for admin devices. It talks to
 * Firestore with YOUR Google credentials (the same login that deploys
 * Firebase), which no app user or APK has. Use it to approve the first
 * phone, or to recover when no enrolled device is available.
 *
 * Commands
 *   create-code   one-time enrollment code (10 min, single use)
 *   list          enrolled devices (no keys printed)
 *   revoke        revoke one device and end its sessions
 *   revoke-all    revoke every device (lost/stolen phone, no other device)
 *   rotate-password  change the admin password in place (devices stay enrolled)
 *
 * Usage
 *   node functions/scripts/admin-device-owner.cjs create-code --project=campinity-app --email=you@example.com --confirm=campinity-app
 *   node functions/scripts/admin-device-owner.cjs list --project=campinity-app
 *   node functions/scripts/admin-device-owner.cjs revoke --project=campinity-app --device=<id> --confirm=campinity-app
 *   node functions/scripts/admin-device-owner.cjs revoke-all --project=campinity-app --confirm=campinity-app
 *   node functions/scripts/admin-device-owner.cjs rotate-password --project=campinity-app --confirm=campinity-app [--end-sessions]
 *   (add --emulator=127.0.0.1:8089 to run against a local Firestore emulator instead)
 *
 * --email / --uid binds the code to your Firebase account, so only that
 * account can redeem it (recommended). Writes require --confirm=<project>.
 *
 * Credentials (first that works): --emulator; Application Default
 * Credentials (gcloud auth application-default login); otherwise the
 * Firebase CLI login on this machine (`firebase login`). Nothing is
 * stored or printed except the one-time code you asked for.
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const FUNCTIONS_DIR = path.join(__dirname, '..', 'functions')
const admin = require(path.join(FUNCTIONS_DIR, 'node_modules', 'firebase-admin'))
const { createEnrollmentCodeRecord } = require(path.join(FUNCTIONS_DIR, 'adminDevice.js'))
const { rotateAdminPassword, validateNewPassword, readHidden, MIN_LENGTH } = require('./adminPasswordRotation.cjs')

function parseArgs(argv) {
  const [command, ...rest] = argv.slice(2)
  const args = Object.fromEntries(
    rest.map((a) => {
      const [k, ...v] = a.replace(/^--/, '').split('=')
      return [k, v.length ? v.join('=') : true]
    })
  )
  return { command, ...args }
}

function findFirebaseTools(explicit) {
  const candidates = []
  if (explicit) candidates.push(explicit)
  if (process.env.FIREBASE_TOOLS_DIR) candidates.push(process.env.FIREBASE_TOOLS_DIR)
  const npxRoots = [path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'), path.join(os.homedir(), '.npm', '_npx')]
  for (const root of npxRoots) {
    try {
      for (const d of fs.readdirSync(root)) candidates.push(path.join(root, d, 'node_modules', 'firebase-tools'))
    } catch {}
  }
  candidates.push(path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'firebase-tools'), '/usr/local/lib/node_modules/firebase-tools', '/usr/lib/node_modules/firebase-tools')
  return candidates.find((c) => fs.existsSync(path.join(c, 'lib', 'api.js'))) || null
}

/**
 * Returns { kind, credential, userCreds }:
 *  - emulator: no credentials
 *  - adc: Application Default Credentials (gcloud) — used for everything
 *  - firebase-cli: the Firebase CLI login. firebase-admin's Firestore client
 *    refuses refresh-token credentials, so Firestore is then opened with
 *    @google-cloud/firestore directly using the same login (authorized_user).
 */
function credentialFor(opts) {
  if (opts.emulator) return { kind: 'emulator' }
  const adc = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.env.APPDATA || path.join(os.homedir(), '.config'), 'gcloud', 'application_default_credentials.json')
  if (fs.existsSync(adc)) return { kind: 'adc', credential: admin.credential.applicationDefault() }
  // Firebase CLI login: refresh token from its config store + its own public OAuth client id.
  const store = [path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'), path.join(process.env.XDG_CONFIG_HOME || '', 'configstore', 'firebase-tools.json')].find((p) => p && fs.existsSync(p))
  const ftDir = findFirebaseTools(opts['firebase-tools-dir'])
  const refreshToken = store ? JSON.parse(fs.readFileSync(store, 'utf8'))?.tokens?.refresh_token : null
  if (!refreshToken || !ftDir) {
    throw new Error('No Google credentials found. Run `npx firebase-tools login` (or `gcloud auth application-default login`) first.')
  }
  const api = require(path.join(ftDir, 'lib', 'api.js'))
  const userCreds = { type: 'authorized_user', client_id: api.clientId(), client_secret: api.clientSecret(), refresh_token: refreshToken }
  return { kind: 'firebase-cli', credential: admin.credential.refreshToken(userCreds), userCreds }
}

const fmt = (ts) => (ts && ts.toDate ? ts.toDate().toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '-')

async function main() {
  const opts = parseArgs(process.argv)
  if (!['create-code', 'list', 'revoke', 'revoke-all', 'rotate-password'].includes(opts.command)) {
    console.log('Commands: create-code | list | revoke --device=<id> | revoke-all | rotate-password [--end-sessions]   (see the header of this file)')
    process.exit(1)
  }
  const project = typeof opts.project === 'string' ? opts.project : null
  if (!project) throw new Error('Pass --project=<firebase project id>.')
  const writes = opts.command !== 'list'
  if (writes && opts.confirm !== project) throw new Error(`Refusing to write: add --confirm=${project} to confirm the target project.`)
  if (opts.emulator) process.env.FIRESTORE_EMULATOR_HOST = String(opts.emulator)
  if (opts.command === 'rotate-password') {
    if (Object.keys(opts).some((k) => /pass|secret/i.test(k))) throw new Error('Never pass a password on the command line. It is asked for interactively.')
    // Ask BEFORE connecting, and refuse outright without a terminal.
    console.log(`Rotating the admin password for ${project}${opts.emulator ? ' (EMULATOR)' : ''}. Typing is hidden. Minimum ${MIN_LENGTH} characters.`)
    const first = await readHidden('New admin password: ')
    const problem = validateNewPassword(first)
    if (problem) throw new Error(problem)
    const second = await readHidden('Repeat new admin password: ')
    if (first !== second) throw new Error('The two entries did not match. Nothing was changed.')
    opts.newPassword = first
  }

  const creds = credentialFor(opts)
  admin.initializeApp(creds.credential ? { projectId: project, credential: creds.credential } : { projectId: project })
  let db
  let Timestamp
  if (creds.kind === 'firebase-cli') {
    const { Firestore, Timestamp: T } = require(path.join(FUNCTIONS_DIR, 'node_modules', '@google-cloud', 'firestore'))
    db = new Firestore({ projectId: project, credentials: creds.userCreds })
    Timestamp = T
  } else {
    db = admin.firestore()
    Timestamp = admin.firestore.Timestamp
  }
  console.log(`Credentials: ${creds.kind}`)
  const audit = (action, extra = {}) =>
    db.collection('moderationActions').add({ adminUid: null, action, targetType: 'adminDevice', targetId: null, targetUid: null, reportId: null, reason: 'owner script', viaOwnerScript: true, createdAt: Timestamp.now(), ...extra })

  console.log(`Project: ${project}${opts.emulator ? ` (EMULATOR ${opts.emulator})` : ''}`)

  if (opts.command === 'rotate-password') {
    const { sessionsEnded } = await rotateAdminPassword(db, Timestamp, { newPassword: opts.newPassword, endSessions: opts['end-sessions'] === true })
    opts.newPassword = null
    console.log('Admin password rotated. Enrolled devices were not changed.')
    console.log(opts['end-sessions'] ? `Ended ${sessionsEnded} active admin session(s); unlock again with the new password.` : 'Existing sessions stay valid until they expire (add --end-sessions to end them now).')
    return
  }

  if (opts.command === 'create-code') {
    let forUid = typeof opts.uid === 'string' ? opts.uid : null
    if (!forUid && typeof opts.email === 'string') forUid = (await admin.auth().getUserByEmail(opts.email)).uid
    if (!forUid) console.log('Note: no --email/--uid given — any signed-in account that also knows the admin password could redeem this code.')
    const { code, expiresAtMs } = await createEnrollmentCodeRecord(db, Timestamp, { createdVia: 'owner_script', forUid })
    await audit('admin_enrollment_code_created')
    console.log('\nOne-time enrollment code (do not share; valid 10 minutes, single use):\n')
    console.log(`    ${code}\n`)
    console.log(`Expires: ${new Date(expiresAtMs).toLocaleString()}${forUid ? `   Bound to uid: ${forUid}` : ''}`)
    return
  }

  const snap = await db.collection('adminDevices').get()
  if (opts.command === 'list') {
    if (snap.empty) return console.log('No enrolled devices.')
    for (const d of snap.docs) {
      const v = d.data()
      console.log(`${v.status === 'active' ? 'ACTIVE ' : 'REVOKED'}  ${d.id}  ${v.platform || '?'}  "${v.label || ''}"  owner=${v.ownerUid}  enrolled=${fmt(v.enrolledAt)}  lastUsed=${fmt(v.lastUsedAt)}`)
    }
    return
  }

  const targets = opts.command === 'revoke' ? snap.docs.filter((d) => d.id === opts.device) : snap.docs.filter((d) => d.data().status === 'active')
  if (opts.command === 'revoke' && !targets.length) throw new Error(`No device with id ${opts.device}.`)
  for (const d of targets) {
    await d.ref.update({ status: 'revoked', revokedAt: Timestamp.now(), revokedByDeviceId: 'owner_script' })
    const sessions = await db.collection('adminSession').doc('tokens').collection('items').where('deviceId', '==', d.id).get()
    await Promise.all(sessions.docs.map((s) => s.ref.delete()))
    await audit('admin_device_revoked', { targetId: d.id })
    console.log(`Revoked ${d.id} ("${d.data().label || ''}"), ended ${sessions.size} session(s).`)
  }
  if (!targets.length) console.log('No active devices to revoke.')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`ERROR: ${err.message}`)
    process.exit(1)
  })
