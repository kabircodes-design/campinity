/**
 * sendVerificationEmail — builds and sends the Campinity verification
 * email. Provider underneath: resendProvider.js.
 *
 * Email-client-safe HTML: table layout, inline styles, no external CSS,
 * no images required (the wordmark is text, so nothing breaks when images
 * are blocked), a bulletproof button plus a copyable fallback link, and a
 * plain-text alternative. Expiry wording comes from the real TTL.
 */
const { sendEmail } = require('./resendProvider.js')

const BRAND = 'CAMPINITY'
const TAGLINE = 'Find Your Campus. Find Your People.'
const ACCENT = '#1677ff'

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

function verificationEmailHtml({ verifyUrl, expiresInMinutes, recipientName }) {
  const url = escapeHtml(verifyUrl)
  const hello = recipientName ? `Hi ${escapeHtml(recipientName)},` : 'Hi there,'
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Verify your email for Campinity</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Confirm your email to finish creating your Campinity account. This link expires in ${expiresInMinutes} minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6fb;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
        <tr>
          <td style="padding:0 4px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <div style="font-size:18px;font-weight:800;letter-spacing:0.14em;color:#10131a;">${BRAND}</div>
            <div style="margin-top:2px;font-size:12px;font-weight:500;color:#6b7280;">${TAGLINE}</div>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;border:1px solid #e6e9f0;border-radius:16px;padding:32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:700;color:#10131a;">Verify your email address</h1>
            <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#374151;">${hello}</p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">
              Confirm this email address to finish creating your Campinity account and start connecting with your campus.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
              <tr>
                <td align="center" bgcolor="${ACCENT}" style="border-radius:12px;">
                  <a href="${url}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;background:${ACCENT};">Verify email address</a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#6b7280;">
              This link expires in <strong style="color:#374151;">${expiresInMinutes} minutes</strong> and can be used once.
            </p>
            <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#6b7280;">Button not working? Copy and paste this link into your browser:</p>
            <p style="margin:0 0 24px;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${url}" target="_blank" rel="noopener" style="color:${ACCENT};text-decoration:underline;">${url}</a></p>
            <hr style="border:none;border-top:1px solid #e6e9f0;margin:0 0 16px;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
              <strong style="color:#374151;">Didn't sign up?</strong> You can safely ignore this email — no account will be verified without this link.
              Campinity will never ask for your password by email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#9ca3af;">
            You received this because this address was used to create a Campinity account. This is an automated message — replies aren't monitored.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

function verificationEmailText({ verifyUrl, expiresInMinutes, recipientName }) {
  return [
    `${BRAND} — ${TAGLINE}`,
    '',
    recipientName ? `Hi ${recipientName},` : 'Hi there,',
    '',
    'Confirm this email address to finish creating your Campinity account.',
    '',
    'Verify your email:',
    verifyUrl,
    '',
    `This link expires in ${expiresInMinutes} minutes and can be used once.`,
    '',
    "Didn't sign up? You can safely ignore this email — no account will be verified without this link.",
    'Campinity will never ask for your password by email.'
  ].join('\n')
}

async function sendVerificationEmail({ to, verifyUrl, expiresInMinutes = 20, recipientName = '', idempotencyKey }) {
  return sendEmail({
    to,
    subject: 'Verify your email for Campinity',
    html: verificationEmailHtml({ verifyUrl, expiresInMinutes, recipientName }),
    text: verificationEmailText({ verifyUrl, expiresInMinutes, recipientName }),
    idempotencyKey
  })
}

module.exports = { sendVerificationEmail, _internal: { verificationEmailHtml, verificationEmailText } }
