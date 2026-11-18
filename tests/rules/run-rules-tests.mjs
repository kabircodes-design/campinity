// Starts a local Firestore emulator with the repo's firestore.rules (demo
// project — never touches production), runs the rules tests, then stops
// the emulator. Usage (from tests/): node rules/run-rules-tests.mjs
//
// Needs Java (JAVA_HOME, or Android Studio's bundled JBR on Windows) and
// the Firestore emulator JAR (FIRESTORE_EMULATOR_JAR, or the copy the
// Firebase CLI caches in ~/.cache/firebase/emulators).
import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const repo = resolve(here, '..', '..')
const PORT = process.env.FIRESTORE_EMULATOR_PORT || '8089'
// RULES_FILE: test a different rules file (e.g. a release variant) instead of the repo's.
const RULES = process.env.RULES_FILE ? resolve(process.env.RULES_FILE) : join(repo, 'firestore.rules')
console.log(`[rules-tests] rules: ${RULES}`)

function findJava() {
  const candidates = [
    process.env.JAVA_HOME && join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'),
    'C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\java.exe'
  ].filter(Boolean)
  return candidates.find((c) => existsSync(c)) || 'java'
}

function findJar() {
  if (process.env.FIRESTORE_EMULATOR_JAR) return process.env.FIRESTORE_EMULATOR_JAR
  const dir = join(homedir(), '.cache', 'firebase', 'emulators')
  const jar = existsSync(dir) && readdirSync(dir).filter((f) => /^cloud-firestore-emulator-.*\.jar$/.test(f)).sort().pop()
  if (!jar) throw new Error('Firestore emulator JAR not found. Set FIRESTORE_EMULATOR_JAR, or run `firebase setup:emulators:firestore` once.')
  return join(dir, jar)
}

// Ready means the Firestore admin endpoint answers, not just the HTTP root
// (the root can respond before seeding/reset requests work, which made the
// suite's setup fail intermittently).
async function waitForEmulator() {
  for (let i = 0; i < 90; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/emulator/v1/projects/demo-campinity-rules/databases/(default)/documents`, {
        method: 'DELETE'
      })
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('Firestore emulator did not become ready within 90s.')
}

// Refuse to run against a stale emulator left on the port: it could be
// serving DIFFERENT rules, making the results meaningless.
try {
  await fetch(`http://127.0.0.1:${PORT}/`)
  console.error(`Port ${PORT} is already in use (a previous emulator?). Stop it first so the tests use the current firestore.rules.`)
  process.exit(2)
} catch {
  // port free — good
}

const emulator = spawn(
  findJava(),
  ['-jar', findJar(), '--host', '127.0.0.1', '--port', PORT, '--rules', RULES, '--project_id', 'demo-campinity-rules'],
  { stdio: 'ignore' }
)

let code = 1
try {
  await waitForEmulator()
  // Run vitest with THIS Node binary (process.execPath), not whatever
  // `npx` resolves to — otherwise `node22 run-rules-tests.mjs` silently
  // ran the tests on the machine's default Node.
  const vitestEntry = resolve(here, '..', 'node_modules', 'vitest', 'vitest.mjs')
  const vitest = spawn(process.execPath, [vitestEntry, 'run', '--config', 'rules/vitest.rules.config.mjs', ...process.argv.slice(2)], {
    cwd: resolve(here, '..'),
    stdio: 'inherit',
    env: { ...process.env, FIRESTORE_EMULATOR_PORT: PORT }
  })
  code = await new Promise((r) => vitest.on('exit', r))
} finally {
  emulator.kill()
}
process.exit(code)
