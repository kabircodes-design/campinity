/**
 * Resend implementation of the sendEmail contract (see mailer.js).
 * Resend was picked because this project already has no email
 * infrastructure at all (confirmed by searching the repo for Resend,
 * SendGrid, Mailgun, Postmark, SMTP, Nodemailer, Brevo, Amazon SES —
 * none exist) and Resend needs nothing beyond a single HTTPS POST, no
 * new npm dependency (uses the platform `fetch`, same approach as
 * openaiProvider.js in ../moderation).
 *
 * NOT CONFIGURED YET. RESEND_API_KEY is not set in this project's
 * Secret Manager. Calling this will throw until an admin runs:
 *   firebase functions:secrets:set RESEND_API_KEY
 * and verifies a sending domain (e.g. campinity.in) in the Resend
 * dashboard. See the final report for exact steps.
 *
 * The API key is read from a server-side environment variable
 * (process.env.RESEND_API_KEY, populated by Firebase Secret Manager
 * via the `secrets` option on the callable functions that use this
 * module) — NEVER a Vite VITE_-prefixed variable, which would bundle
 * it into client-side JS. This file only runs inside Cloud Functions,
 * never in browser code.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured on the server. Cannot send email.')
  }

  const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'Campinity <verify@campinity.in>'

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [to],
      subject,
      html,
      text
    })
  })

  if (!response.ok) {
    // Never include the response body verbatim in logs/errors — it can
    // echo back request details. Status code is enough to diagnose.
    throw new Error(`Resend request failed: ${response.status}`)
  }
}

module.exports = { sendEmail }
