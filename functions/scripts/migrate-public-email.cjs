#!/usr/bin/env node
/**
 * REVIEW ONLY — DO NOT RUN WITHOUT EXPLICIT APPROVAL.
 *
 * Moves each user's email address off the public users/{uid} document
 * (readable by every signed-in user) into users/{uid}/private/account
 * (owner-read-only, Admin-SDK-write-only — see firestore.rules).
 *
 * Phases (run separately, in order):
 *   copy     users/{uid}.email  ->  users/{uid}/private/account.email
 *            (never overwrites a different existing private email; re-runnable)
 *   remove   delete users/{uid}.email, ONLY where the private copy exists and
 *            matches exactly (so nothing can be lost)
 *   restore  ROLLBACK: put users/{uid}.email back from the private copy
 *
 * Safety:
 *   - Default is a dry run: it reads and reports counts, writes nothing.
 *   - Writing needs BOTH --execute and --confirm=<projectId>.
 *   - Never prints email addresses (counts and uids only).
 *   - Pages through users by document id, 300 at a time; batched writes.
 *   - Requires Admin credentials (GOOGLE_APPLICATION_CREDENTIALS) — it does
 *     not use any app/client credentials.
 *
 * Usage (from the repo root):
 *   node functions/scripts/migrate-public-email.cjs --project=campinity-app --phase=copy
 *   node functions/scripts/migrate-public-email.cjs --project=campinity-app --phase=copy --execute --confirm=campinity-app
 *   (then the same with --phase=remove; --phase=restore to roll back)
 */
const path = require('node:path')

const PAGE_SIZE = 300

function parseArgs(argv) {
  const args = Object.fromEntries(
    argv.slice(2).map((a) => {
      const [k, ...v] = a.replace(/^--/, '').split('=')
      return [k, v.length ? v.join('=') : true]
    })
  )
  return {
    project: typeof args.project === 'string' ? args.project : null,
    phase: args.phase,
    execute: args.execute === true,
    confirm: typeof args.confirm === 'string' ? args.confirm : null
  }
}

const isEmail = (v) => typeof v === 'string' && v.trim() !== ''

/**
 * Pure decision for one user. `publicEmail` is users/{uid}.email (or
 * undefined), `privateEmail` is users/{uid}/private/account.email (or
 * undefined). Returns the action this phase would take.
 */
function planUser(phase, publicEmail, privateEmail) {
  if (phase === 'copy') {
    if (!isEmail(publicEmail)) return { action: 'skip', reason: 'no-public-email' }
    if (privateEmail === publicEmail) return { action: 'skip', reason: 'already-copied' }
    if (isEmail(privateEmail)) return { action: 'conflict', reason: 'private-email-differs' }
    return { action: 'copy' }
  }
  if (phase === 'remove') {
    if (publicEmail === undefined) return { action: 'skip', reason: 'already-removed' }
    if (!isEmail(privateEmail)) return { action: 'blocked', reason: 'no-private-copy' }
    if (isEmail(publicEmail) && privateEmail !== publicEmail) return { action: 'blocked', reason: 'copy-mismatch' }
    return { action: 'remove' }
  }
  if (phase === 'restore') {
    if (!isEmail(privateEmail)) return { action: 'skip', reason: 'no-private-copy' }
    if (publicEmail === privateEmail) return { action: 'skip', reason: 'already-public' }
    if (isEmail(publicEmail)) return { action: 'conflict', reason: 'public-email-differs' }
    return { action: 'restore' }
  }
  throw new Error(`Unknown phase: ${phase}`)
}

async function main() {
  const opts = parseArgs(process.argv)
  if (!opts.project) throw new Error('Pass --project=<firebase project id>.')
  if (!['copy', 'remove', 'restore'].includes(opts.phase)) throw new Error('Pass --phase=copy|remove|restore.')
  const writing = opts.execute
  if (writing && opts.confirm !== opts.project) {
    throw new Error(`Refusing to write: add --confirm=${opts.project} to confirm the target project.`)
  }

  // firebase-admin from the Functions package (not an app dependency).
  const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'))
  admin.initializeApp({ projectId: opts.project })
  const db = admin.firestore()
  const { FieldValue, FieldPath } = admin.firestore

  console.log(`${writing ? 'EXECUTING' : 'DRY RUN'} phase=${opts.phase} project=${opts.project}`)
  const totals = {}
  const flagged = []
  let last = null
  for (;;) {
    let q = db.collection('users').orderBy(FieldPath.documentId()).limit(PAGE_SIZE)
    if (last) q = q.startAfter(last)
    const page = await q.get()
    if (page.empty) break
    const privateSnaps = await db.getAll(...page.docs.map((d) => d.ref.collection('private').doc('account')))
    const batch = db.batch()
    let writes = 0
    page.docs.forEach((userDoc, i) => {
      const data = userDoc.data()
      const publicEmail = Object.prototype.hasOwnProperty.call(data, 'email') ? data.email : undefined
      const privateEmail = privateSnaps[i].exists ? privateSnaps[i].data().email : undefined
      const plan = planUser(opts.phase, publicEmail, privateEmail)
      const key = plan.reason ? `${plan.action}:${plan.reason}` : plan.action
      totals[key] = (totals[key] || 0) + 1
      if (plan.action === 'conflict' || plan.action === 'blocked') flagged.push(`${userDoc.id} (${plan.reason})`)
      if (!writing) return
      if (plan.action === 'copy') {
        batch.set(privateSnaps[i].ref, { email: publicEmail, copiedAt: FieldValue.serverTimestamp(), source: 'users.email' }, { merge: true })
        writes++
      } else if (plan.action === 'remove') {
        batch.update(userDoc.ref, { email: FieldValue.delete() })
        writes++
      } else if (plan.action === 'restore') {
        batch.update(userDoc.ref, { email: privateEmail })
        writes++
      }
    })
    if (writes) await batch.commit()
    last = page.docs[page.docs.length - 1]
    if (page.size < PAGE_SIZE) break
  }

  console.log('Result (counts only — no email addresses are printed):')
  Object.entries(totals).forEach(([k, v]) => console.log(`  ${k}: ${v}`))
  if (flagged.length) {
    console.log(`Needs manual review (${flagged.length}) — not changed:`)
    flagged.forEach((f) => console.log(`  ${f}`))
  }
  if (!writing) console.log('Dry run only. Nothing was written.')
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || err)
    process.exit(1)
  })
}

module.exports = { planUser, parseArgs }
