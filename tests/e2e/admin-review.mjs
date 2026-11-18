// Admin panel visual review against the LOCAL emulators only (demo-campinity-e2e).
// Uses an emulator-only test password and the fake user "alice"; never touches
// production, the real admin password, or real devices.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const BASE = 'http://127.0.0.1:5300'
const OUT = path.resolve('tests/e2e/out/admin')
const TEST_ONLY_PASSWORD = 'emulator-only-admin-pass-1'
fs.mkdirSync(OUT, { recursive: true })
const targets = await (await fetch('http://127.0.0.1:9340/json')).json()
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pending = new Map()
const errors = []
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } if (m.method === 'Runtime.exceptionThrown') errors.push(String(m.params.exceptionDetails?.exception?.description).slice(0, 160)) }
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
const waitFor = async (x, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(x)) return true; await sleep(400) } return false }
const SET = `(sel, v) => { const el = document.querySelector(sel); if (!el) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); return true }`
const set = (sel, v) => ev(`(${SET})(${JSON.stringify(sel)}, ${JSON.stringify(v)})`)
const clickText = (t) => ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(t)} || (x.getAttribute('aria-label') || '') === ${JSON.stringify(t)}); if (!b) return false; b.click(); return true })()`)
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, n + '.png'), Buffer.from(r.result.data, 'base64')) }
const log = (ok, step, d = '') => console.log(`${ok ? 'PASS' : 'FAIL'} ${step}${d ? ' — ' + d : ''}`)

await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 860, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: BASE + '/admin' })
await sleep(5000)

if (await waitFor(`document.body.innerText.includes('Create admin password')`, 25000)) {
  await set('input[placeholder="New admin password (8+ characters)"]', TEST_ONLY_PASSWORD)
  await set('input[placeholder="Confirm password"]', TEST_ONLY_PASSWORD)
  await clickText('Create admin password')
  log(await waitFor(`!!document.querySelector('input[placeholder="XXXX-XXXX-XXXX"]')`), 'first-time setup (emulator test password) -> enrollment form')
}
await shot('00-lock-enroll')
if (await ev(`!!document.querySelector('input[placeholder="XXXX-XXXX-XXXX"]')`)) {
  const out = execFileSync(process.execPath, ['functions/scripts/admin-device-owner.cjs', 'create-code', '--project=demo-campinity-e2e', '--emulator=127.0.0.1:8189', '--uid=alice', '--confirm=demo-campinity-e2e'], { encoding: 'utf8' })
  const code = (out.match(/^\s+([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})\s*$/m) || [])[1]
  log(Boolean(code), 'owner script (emulator) issued a code bound to alice')
  await set('input[placeholder="XXXX-XXXX-XXXX"]', code || '')
  await set('input[placeholder="Admin password"]', TEST_ONLY_PASSWORD)
  await set('input[placeholder="Device name"]', 'E2E browser')
  await clickText('Authorize this device')
  log(await waitFor(`document.body.innerText.includes('Overview') && !document.querySelector('input[placeholder="XXXX-XXXX-XXXX"]')`, 30000), 'device enrolled -> admin shell')
}
const sections = ['Overview', 'Users', 'Reports', 'Content Moderation', 'Verification', 'Communities', 'Colleges', 'Marketplace', 'Lost & Found', 'Achievements', 'Notice Board', 'Notifications & Announcements', 'Audit Logs', 'System Health', 'Devices']
for (const [i, s] of sections.entries()) {
  const ok = await clickText(s)
  await sleep(3500)
  const txt = await ev(`document.querySelector('main') ? document.querySelector('main').innerText.slice(0, 160).replace(/[\\n\\t ]+/g, ' ') : document.body.innerText.slice(0, 160)`)
  const bad = /not deployed|failed|error|couldn't|could not/i.test(txt || '')
  log(ok && !bad, `section: ${s}`, (txt || '').slice(0, 110))
  await shot(String(i + 1).padStart(2, '0') + '-' + s.toLowerCase().replace(/[^a-z]+/g, '-'))
}
console.log('exceptions:', errors.length ? errors.slice(0, 4) : 'none')
process.exit(0)
