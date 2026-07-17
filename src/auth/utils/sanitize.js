/**
 * Lightweight input sanitization for controlled form fields.
 *
 * This is a UI-layer safeguard only — it strips characters that have no
 * legitimate place in the fields we collect (name, email, password) and
 * trims incidental whitespace. It is NOT a substitute for server-side
 * validation/sanitization once Firebase (or any backend) is wired up;
 * treat this as defense-in-depth for what gets echoed back into the DOM.
 */

/** Strips angle brackets to prevent stray markup from being typed/pasted in. */
export function stripMarkup(value = '') {
  return value.replace(/[<>]/g, '')
}

/** Collapses leading/trailing whitespace without touching internal spacing (e.g. full names). */
export function trimEdges(value = '') {
  return value.replace(/^\s+/, '').replace(/\s+$/, '')
}

/** General-purpose sanitizer for single-line text fields (name, email). */
export function sanitizeText(value = '') {
  return stripMarkup(value)
}

/** Email gets lowercased + fully trimmed since it's used as a lookup key. */
export function sanitizeEmail(value = '') {
  return stripMarkup(value).trim().toLowerCase()
}

/**
 * Passwords are sanitized minimally — we only strip control characters.
 * We deliberately do NOT trim or alter case, since whitespace/case may be
 * intentional parts of the secret.
 */
export function sanitizePassword(value = '') {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x1F\x7F]/g, '')
}
