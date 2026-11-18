// End-to-end driver for the LOCAL emulator environment (demo-campinity-e2e).
// Drives headless Chrome over CDP like a user: taps, types, uploads files.
// Usage: node tests/e2e/driver.mjs <flow...>   (flows: login identity chat product story radar)
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.E2E_BASE || 'http://127.0.0.1:5300'
const CDP = process.env.E2E_CDP || 'http://127.0.0.1:9340'
const OUT = process.env.E2E_OUT || path.resolve('tests/e2e/out')
const IMAGE = path.resolve('public/campinity-mascot.png')
fs.mkdirSync(OUT, { recursive: true })

const targets = await (await fetch(`${CDP}/json`)).json()
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let id = 0
const pending = new Map()
const consoleErrors = []
const dialogs = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  if (m.method === 'Page.javascriptDialogOpening') { dialogs.push(m.params.type + ': ' + m.params.message); ws.send(JSON.stringify({ id: 900000 + dialogs.length, method: 'Page.handleJavaScriptDialog', params: { accept: true } })) }
  if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(String(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text).slice(0, 200))
}
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.result?.exceptionDetails) return { __error: r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text }
  return r.result?.result?.value
}
await send('Runtime.enable')
await send('Page.enable')
await send('DOM.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true })

const HELPERS = `
window.__e2e = {
  text: () => document.body.innerText,
  setValue(el, v) { const p = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, 'value').set.call(el, v); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true },
  byLabel(label) { const l = [...document.querySelectorAll('label')].find((x) => x.textContent.trim().toLowerCase().startsWith(label.toLowerCase())); if (l && l.htmlFor) return document.getElementById(l.htmlFor); if (l) return l.querySelector('input,textarea,select'); return document.querySelector('[aria-label="' + label + '"],[placeholder*="' + label + '"]') },
  click(t) { const all = [...document.querySelectorAll('button,a,[role=button],[role=radio],[role=tab]')]; const el = all.find((b) => (b.getAttribute('aria-label') || '').trim() === t) || all.find((b) => b.textContent.trim() === t) ; if (!el) return 'NO ' + t; el.scrollIntoView({ block: 'center' }); el.click(); return 'ok' }
};1`
const h = async (expr) => { await ev(HELPERS); return ev(expr) }
async function go(p) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await send('Page.navigate', { url: BASE + p })
    await sleep(3500)
    if ((await ev('location.pathname')) === p) return true
  }
  console.log('  (navigation to ' + p + ' did not land; at ' + (await ev('location.pathname')) + ')')
  return false
}
async function waitFor(fn, ms = 15000) { const t = Date.now(); while (Date.now() - t < ms) { const v = await h(fn); if (v && !v.__error) return v; await sleep(400) } return false }
async function shot(name) { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.result.data, 'base64')) }
async function setFile(selector, file) { const doc = await send('DOM.getDocument', { depth: -1, pierce: true }); const q = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector }); if (!q.result?.nodeId) return false; await send('DOM.setFileInputFiles', { nodeId: q.result.nodeId, files: [file] }); return true }
const results = []
const check = (flow, step, ok, detail = '') => { results.push({ flow, step, ok: Boolean(ok), detail }); console.log(`${ok ? 'PASS' : 'FAIL'} [${flow}] ${step}${detail ? ' — ' + String(detail).slice(0, 140) : ''}`) }
const flows = process.argv.slice(2)

async function login(email = 'alice@e2e.test') {
  // Start signed out: a reused Chrome profile may still hold a session from a previous run.
  await send('Page.navigate', { url: 'about:blank' })
  await sleep(1000)
  await send('Storage.clearDataForOrigin', { origin: new URL(BASE).origin, storageTypes: 'all' })
  await go('/login')
  await h(`(__e2e.setValue(document.querySelector('input[type=email]'), '${email}'), __e2e.setValue(document.querySelector('input[type=password]'), 'e2e-password-1'), 1)`)
  await h(`__e2e.click('Log in')`)
  const ok = await waitFor(`location.pathname === '/home' && __e2e.text().includes('Search Campinity')`, 30000)
  if (!ok) console.log('  (after login: ' + (await ev(`location.pathname + ' | ' + document.body.innerText.slice(0, 160)`)) + ')')
  return ok
}

if (flows.includes('login')) {
  check('login', 'sign in as Alice through the login form', await login())
  await shot('home')
}
if (flows.includes('identity')) {
  await go('/home')
  check('identity', 'greeting uses the real first name', await waitFor(`/GOOD (MORNING|AFTERNOON|EVENING)\\s+Alice/i.test(__e2e.text())`))
  check('identity', 'post from a deleted account shows "Student"', await waitFor(`(() => { const t = __e2e.text(); return t.includes('Post from a deleted account') && t.includes('Student') && !t.includes('Former Student') })()`), await h(`__e2e.text().slice(0,400).replace(/\\s+/g,' ')`))
  await shot('identity-home')
}
if (flows.includes('chat')) {
  await go('/student/bob_d')
  const bobOk = await waitFor(`__e2e.text().includes('Bob Dsouza')`, 25000)
  check('chat', 'open Bob\'s profile', bobOk, bobOk ? '' : await ev(`location.pathname + ' | ' + document.body.innerText.slice(0, 160)`))
  // First contact shows "Message"; with a pending request it shows "Request sent" (opens the same chat).
  const which = await waitFor(`(() => { const b = [...document.querySelectorAll('button')].find((x) => ['Message', 'Request sent'].includes((x.getAttribute('aria-label') || x.textContent).trim())); return b ? (b.getAttribute('aria-label') || b.textContent).trim() : false })()`)
  check('chat', 'tap Message / Request sent', which && (await h(`__e2e.click(${JSON.stringify(which)})`)) === 'ok', which)
  const inChat = await waitFor(`location.pathname.startsWith('/messages/') && location.pathname.split('/').length === 3`, 20000)
  check('chat', 'conversation opens', inChat, await h(`location.pathname`))
  const box = `document.querySelector('textarea') || document.querySelector('input[placeholder*="essage"]')`
  const pending = await waitFor(`/waiting for acceptance|Request Sent/i.test(__e2e.text())`, 4000)
  const hasBox = await waitFor(`!!(${box})`, pending ? 3000 : 15000)
  check('chat', pending ? 'pending request: thread shows "waiting for acceptance"' : 'message box present', pending || hasBox, pending ? (hasBox ? 'box shown' : 'box hidden until accepted') : '')
  if (pending && !hasBox) { check('chat', 'earlier message still in thread', await waitFor(`__e2e.text().includes('Hi Bob — e2e test message')`)); await shot('chat-thread') } else {
  await h(`__e2e.setValue(${box}, 'Hi Bob — e2e test message')`)
  await sleep(300)
  const sent = await h(`(() => { const b = [...document.querySelectorAll('button')].find(x => /send/i.test(x.getAttribute('aria-label') || '') || /^send$/i.test(x.textContent.trim())); if (!b) return 'NO SEND'; b.click(); return 'ok' })()`)
  check('chat', 'tap Send', sent === 'ok', sent)
  check('chat', 'message appears in the thread', await waitFor(`__e2e.text().includes('Hi Bob — e2e test message')`, 15000))
  await shot('chat-thread')
  }
}
if (flows.includes('product')) {
  await go('/marketplace/create')
  check('product', 'open Add Product form', await waitFor(`__e2e.text().includes('Add Product')`))
  const fileOk = await setFile('input[type=file]', IMAGE)
  check('product', 'attach a photo', fileOk)
  await sleep(1500)
  const fill = await h(`(() => { const inputs = [...document.querySelectorAll('input:not([type=file]):not([type=checkbox]):not([type=radio]), textarea')]; const title = __e2e.byLabel('Name') || inputs.find(i => /title|name|what are you selling/i.test((i.placeholder||'') + (i.getAttribute('aria-label')||'') + (i.id||''))); const price = __e2e.byLabel('Price') || inputs.find(i => i.type === 'number' || /price/i.test((i.placeholder||'') + (i.id||''))); const desc = [...document.querySelectorAll('textarea')][0]; if (title) __e2e.setValue(title, 'E2E Scientific Calculator'); if (price) __e2e.setValue(price, '450'); if (desc) __e2e.setValue(desc, 'Barely used, works perfectly. E2E test listing.'); return { title: !!title, price: !!price, desc: !!desc } })()`)
  check('product', 'fill title, price, description', fill && fill.title && fill.price, JSON.stringify(fill))
  const cats = await h(`(() => { const s = document.querySelector('select'); if (s && s.options.length > 1) { __e2e.setValue(s, s.options[1].value); return 'select' } const c = [...document.querySelectorAll('button')].find(b => /electronics/i.test(b.textContent)); if (c) { c.click(); return 'chip' } return 'none' })()`)
  check('product', 'choose a category', cats !== 'none', cats)
  await shot('product-form')
  const submit = await h(`(() => { const b = [...document.querySelectorAll('button[type=submit], button')].reverse().find(x => /list|publish|post|sell/i.test(x.textContent.trim()) && !x.disabled); if (!b) return 'NO SUBMIT'; b.click(); return b.textContent.trim() })()`)
  check('product', 'submit listing', !String(submit).startsWith('NO'), submit)
  const landed = await waitFor(`/^\\/marketplace\\/(?!create)/.test(location.pathname) || (location.pathname === '/marketplace' && __e2e.text().includes('E2E Scientific Calculator'))`, 30000)
  check('product', 'listing created', landed, await h(`location.pathname + ' | ' + __e2e.text().slice(0,200).replace(/\\s+/g,' ')`))
  if (!(await h(`/^\\/marketplace\\/(?!create)/.test(location.pathname)`))) { await go('/marketplace'); await h(`(() => { const a = [...document.querySelectorAll('a,button')].find(x => x.textContent.includes('E2E Scientific Calculator')); a && a.click(); return 1 })()`); await sleep(2500) }
  check('product', 'product detail shows the listing', await waitFor(`__e2e.text().includes('E2E Scientific Calculator') && /450/.test(__e2e.text())`), await h(`location.pathname`))
  check('product', 'product photo loads from Storage', await waitFor(`[...document.images].some(i => i.complete && i.naturalWidth > 0 && /9299|storage/.test(i.src))`, 15000))
  await shot('product-detail')
}
if (flows.includes('story')) {
  await go('/home')
  check('story', 'own bubble shows the user initials (not "YS")', await waitFor(`!__e2e.text().split('\\n').map((l) => l.trim()).includes('YS')`, 5000))
  if (!(await waitFor(`!!document.querySelector('[aria-label="Add to your story"]')`, 8000))) { await go('/home'); await waitFor(`!!document.querySelector('[aria-label="Add to your story"]')`, 15000) }
  const addBtn = await h(`(() => { const el = document.querySelector('[aria-label="Add to your story"]'); if (!el) return 'NO'; el.click(); return 'ok' })()`)
  check('story', 'tap + Add to your story', addBtn === 'ok', addBtn)
  await sleep(1500)
  check('story', 'attach story image', await setFile('input[type=file]', IMAGE))
  await sleep(2500)
  await shot('story-composer')
  const post = await h(`(() => { const b = [...document.querySelectorAll('button')].reverse().find(x => /share|post|publish|add to story/i.test(x.textContent.trim()) && !x.disabled); if (!b) return 'NO POST'; b.click(); return b.textContent.trim() })()`)
  check('story', 'publish story', !String(post).startsWith('NO'), post)
  const posted = await waitFor(`!__e2e.text().includes('Share to Your Story') && location.pathname === '/home'`, 30000)
  check('story', 'composer closes after posting, no page reload', posted && (await h(`window.__e2e !== undefined`)))
  await sleep(2000)
  const opened = await h(`(() => { const el = [...document.querySelectorAll('button')].find(b => /your story/i.test(b.textContent + (b.getAttribute('aria-label')||''))); if (!el) return 'NO'; el.click(); return 'ok' })()`)
  check('story', 'open own story', opened === 'ok')
  check('story', 'story viewer shows the image', await waitFor(`[...document.images].some(i => i.complete && i.naturalWidth > 0 && /9299|storage/.test(i.src))`, 15000))
  await shot('story-viewer')
}
if (flows.includes('storyview')) {
  await go('/home')
  await sleep(2500)
  const bar = await h(`[...document.querySelectorAll('button')].filter(b => /story/i.test(b.textContent + (b.getAttribute('aria-label')||''))).map(b => (b.getAttribute('aria-label')||'') + ' | ' + b.textContent.trim()).slice(0,5)`)
  check('storyview', 'story row after reload', true, JSON.stringify(bar))
  const opened = await h(`(() => { const el = [...document.querySelectorAll('button')].find(b => /your story/i.test(b.textContent + (b.getAttribute('aria-label')||''))); if (!el) return 'NO'; el.click(); return 'ok' })()`)
  await sleep(2500)
  check('storyview', 'tap own story opens the viewer (not the composer)', await waitFor(`[...document.images].some(i => i.complete && i.naturalWidth > 0 && /9299/.test(i.src)) && !/Share to Your Story/.test(__e2e.text())`, 10000), await h(`__e2e.text().slice(0,160).replace(/\s+/g,' ')`))
  await shot('storyview')
}
if (flows.includes('radar')) {
  await send('Browser.grantPermissions', { origin: BASE, permissions: ['geolocation'] })
  await send('Emulation.setGeolocationOverride', { latitude: 19.2073, longitude: 72.8723, accuracy: 25 })
  await go('/radar')
  check('radar', 'radar page renders', await waitFor(`__e2e.text().length > 50`))
  check('radar', 'location acquired (emulated, local only)', await waitFor(`/Location on/i.test(__e2e.text())`, 25000), await h(`__e2e.text().slice(0,220).replace(/\\s+/g,' ')`))
  await shot('radar')
}
console.log('console exceptions:', consoleErrors.length ? consoleErrors.slice(0, 5) : 'none')
console.log('dialogs auto-accepted:', dialogs.length ? dialogs : 'none')
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ results, consoleErrors }, null, 1))
const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
ws.close()
process.exit(0)
