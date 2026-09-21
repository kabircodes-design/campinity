/**
 * Shared Division/Roll-Number handling for CreateProfilePage and
 * EditProfilePage — one implementation, not two. Division is the field
 * the brief specifically asked for stronger validation on; roll number
 * is new (confirmed via audit: no such field existed anywhere in this
 * codebase before this pass), so it gets only light normalization, no
 * invented format restriction.
 */

export const DIVISION_FORMAT_HINT = 'Use capital letters. For numbered divisions, use a hyphen (e.g. S-3).'

const LETTERS_ONLY = /^[A-Za-z]+$/
const LETTER_HYPHEN_NUMBER = /^[A-Za-z]+-\d+$/

/**
 * Division is optional — an empty value is always valid (not every
 * program has one). Two real shapes are accepted:
 *   - Plain letters (A, B, AB) — case is auto-corrected to uppercase,
 *     since that's a safe, unambiguous fix (matches the brief's chosen
 *     "normalize casing" option, not a forced rejection).
 *   - Letter(s) + hyphen + digits (S-3, A-1) — same casing fix on the
 *     letter part. The hyphen itself is never inserted automatically
 *     (going from "S3" to "S-3" would be guessing at intent, not
 *     correcting a typo) — that shape is rejected with a clear error
 *     instead, per "do not silently accept malformed values."
 * Anything else (S3, s3, S 3, S_3, digits-only, etc.) is rejected.
 */
export function normalizeDivision(raw) {
  const trimmed = (raw || '').trim().replace(/\s+/g, ' ')
  if (!trimmed) return { value: '', error: '' }

  if (LETTERS_ONLY.test(trimmed)) {
    return { value: trimmed.toUpperCase(), error: '' }
  }

  if (LETTER_HYPHEN_NUMBER.test(trimmed)) {
    const [letters, digits] = trimmed.split('-')
    return { value: `${letters.toUpperCase()}-${digits}`, error: '' }
  }

  return { value: trimmed, error: DIVISION_FORMAT_HINT }
}

/** No invented format — just whitespace cleanup. Optional field. */
export function normalizeRollNumber(raw) {
  return (raw || '').trim().replace(/\s+/g, ' ')
}
