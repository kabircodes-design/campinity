/**
 * sendVerificationEmail — the one place the custom email-verification
 * system builds and sends the verification message. Swappable
 * provider underneath (currently resendProvider.js), same pattern as
 * moderation/provider.js + moderation/openaiProvider.js.
 */
const { sendEmail } = require('./resendProvider.js')

function verificationEmailHtml(verifyUrl) {
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
    <p style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 24px;">Campinity</p>
    <h1 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 12px;">Verify your email</h1>
    <p style="font-size: 15px; color: #4b5563; line-height: 1.6; margin: 0 0 24px;">
      Tap the button below to verify your email and finish setting up your Campinity account. This link expires in 20 minutes.
    </p>
    <a href="${verifyUrl}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 999px;">
      Verify email
    </a>
    <p style="font-size: 13px; color: #9ca3af; line-height: 1.6; margin: 24px 0 0;">
      If you didn't create a Campinity account, you can safely ignore this email.
    </p>
  </div>`
}

function verificationEmailText(verifyUrl) {
  return `Verify your Campinity email\n\nOpen this link to verify your email (expires in 20 minutes):\n${verifyUrl}\n\nIf you didn't create a Campinity account, you can safely ignore this email.`
}

async function sendVerificationEmail({ to, verifyUrl }) {
  await sendEmail({
    to,
    subject: 'Verify your Campinity email',
    html: verificationEmailHtml(verifyUrl),
    text: verificationEmailText(verifyUrl)
  })
}

module.exports = { sendVerificationEmail }
