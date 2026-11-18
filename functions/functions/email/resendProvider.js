/**
 * Resend implementation of the sendEmail contract (see mailer.js).
 * One HTTPS POST to https://api.resend.com/emails using the platform
 * `fetch` (no npm dependency).
 *
 * Configuration (server-side only — never VITE_ variables):
 *  - RESEND_API_KEY      Secret Manager secret, injected via the `secrets`
 *                        option on the callables that send mail.
 *  - EMAIL_FROM_ADDRESS  plain config, e.g. "Campinity <verify@mail.example.com>".
 *                        Its domain MUST be verified in the Resend dashboard
 *                        (DKIM + SPF DNS records), or Resend answers 403.
 *                        Set it in functions/functions/.env.<projectId>.
 *
 * Failures throw a ResendError carrying Resend's own error *type* and a
 * redacted message (no API key, no recipient address, no link), so the
 * logs say WHY a send failed instead of just a status code.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
// Kept only as a last resort for local tooling; production must set EMAIL_FROM_ADDRESS.
const FALLBACK_FROM = 'Campinity <verify@campinity.in>'

class ResendError extends Error {
  constructor(status, type, message) {
    super(`Resend request failed: ${status}${type ? ` ${type}` : ''}${message ? ` — ${message}` : ''}`)
    this.name = 'ResendError'
    this.status = status
    this.type = type || null
  }
}

const redact = (s) =>
  String(s || '')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/https?:\/\/\S+/g, '[url]')
    .replace(/re_[A-Za-z0-9_]{6,}/g, '[key]')
    .slice(0, 300)

function senderAddress() {
  return (process.env.EMAIL_FROM_ADDRESS || '').trim() || FALLBACK_FROM
}

async function sendEmail({ to, subject, html, text, idempotencyKey, fetchImpl = globalThis.fetch }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new ResendError(0, 'not_configured', 'RESEND_API_KEY is not configured on the server')
  }

  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
  // Lets Resend drop an accidental duplicate of the same message (e.g. a retried request).
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

  let response
  try {
    response = await fetchImpl(RESEND_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ from: senderAddress(), to: [to], subject, html, text })
    })
  } catch (err) {
    throw new ResendError(0, 'network_error', redact(err && err.message))
  }

  if (!response.ok) {
    let type = null
    let message = null
    try {
      const body = await response.json()
      type = typeof body?.name === 'string' ? body.name : null
      message = typeof body?.message === 'string' ? redact(body.message) : null
    } catch {
      // non-JSON body: status code alone
    }
    throw new ResendError(response.status, type, message)
  }

  try {
    const body = await response.json()
    return { id: typeof body?.id === 'string' ? body.id : null }
  } catch {
    return { id: null }
  }
}

module.exports = { sendEmail, senderAddress, ResendError }
