/**
 * Profanity/abusive-language filter — deterministic, dictionary-based.
 *
 * HONEST LIMITATION, stated up front and repeated at the bottom of
 * this file: this is NOT an AI safety system. It reliably catches
 * known, listed terms and their obvious spacing/punctuation/repeated-
 * character variants. It does NOT understand context, sarcasm, coded
 * harassment, threats phrased without a listed word, or misspellings
 * it has never seen. It is one layer of a system that also needs
 * reports + moderation review to be meaningfully safe — never
 * presented as sufficient on its own.
 */
import { PROFANITY_TERMS, SEVERITY } from './profanityLexicon.js'

/**
 * Builds a word-boundary-aware regex for a single term against the
 * ORIGINAL (unmodified) text — this is what prevents the false-
 * positive case explicitly called out in the brief ("do not block a
 * harmless larger word simply because it contains a prohibited
 * substring", e.g. a term inside "classic" or "assessment" should
 * not trigger on "ass"). \b in JS regex is a genuine word boundary
 * (transition between \w and non-\w), which correctly handles this
 * for normal English text.
 */
function wordBoundaryRegex(term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`, 'gi')
}

/**
 * Builds a 'fuzzy' regex for a term that matches it in the ORIGINAL
 * text even with evasion characters (spaces/hyphens/dots/underscores/
 * asterisks) and repeated letters inserted between each character —
 * e.g. matches "m-a-d-a-r-c-h-o-d" and "mmaadarrchod" as the term
 * "madarchod". This is what makes masking possible for evasion
 * attempts: unlike the normalized-substring detection in
 * detectMatches (which loses the original span once text is
 * stripped/collapsed), this regex operates directly on the real
 * string, so replace() can locate and mask the actual matched
 * substring in place.
 */
function fuzzyEvasionRegex(term) {
  const chars = term.split('').map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = chars.map((ch) => `${ch}+[\\s\\-_.*]*`).join('')
  return new RegExp(`\\b${pattern}\\b`, 'gi')
}

/**
 * Detects matches using TWO passes, not one:
 *  1. Word-boundary match against the ORIGINAL text — catches the
 *     normal case cleanly, with no false-positive risk from
 *     normalization merging unrelated words.
 *  2. A normalized-substring check as a fallback specifically for
 *     spacing/punctuation evasion ("m a d a r c h o d") — since
 *     stripping spaces necessarily loses word boundaries, this pass
 *     is intentionally substring-based and therefore has a higher
 *     false-positive risk than pass 1. It only runs on terms that
 *     didn't already match in pass 1, and is scoped to terms of at
 *     least 4 normalized characters to reduce accidental short-
 *     substring collisions (a 3-letter term substring-matching
 *     inside an unrelated normalized word is far more likely than a
 *     6+ letter one).
 */
export function detectMatches(text) {
  if (!text) return []
  const matches = []

  for (const entry of PROFANITY_TERMS) {
    const boundaryMatches = text.match(wordBoundaryRegex(entry.term))
    if (boundaryMatches) {
      matches.push({ term: entry.term, severity: entry.severity, matched: boundaryMatches, method: 'word-boundary' })
      continue
    }
    if (entry.term.length >= 4 && fuzzyEvasionRegex(entry.term).test(text)) {
      matches.push({ term: entry.term, severity: entry.severity, matched: [entry.term], method: 'normalized-evasion' })
    }
  }

  return matches
}

/**
 * Masks every literal occurrence of each matched term in the
 * ORIGINAL text. Word-boundary matches use the exact boundary regex.
 * Normalized-evasion matches (spacing/punctuation/repeated-character
 * tricks) use the fuzzy regex above, which CAN locate the real span
 * in the original string — this is the fix for the confirmed bug
 * where evasion attempts were detected but silently left unmasked.
 */
function maskText(text, matches) {
  let masked = text
  matches.forEach((m) => {
    const regex = m.method === 'word-boundary' ? wordBoundaryRegex(m.term) : fuzzyEvasionRegex(m.term)
    masked = masked.replace(regex, (match) => '*'.repeat(match.length))
  })
  return masked
}

/**
 * The main entry point every text-submission surface should call.
 * Returns:
 *   { text, wasModerated, highestSeverity, hadEvasionAttempt, flaggedForReview }
 * - text: the sanitized (masked) text to actually persist/display.
 * - flaggedForReview: true when a HIGH-severity term is present —
 *   caller should route this toward moderation review, not just
 *   silently mask and move on, per "flag for moderation instead of
 *   blindly treating everything the same."
 */
export function moderateText(rawText) {
  const text = rawText || ''
  const matches = detectMatches(text)

  if (matches.length === 0) {
    return { text, wasModerated: false, highestSeverity: null, hadEvasionAttempt: false, flaggedForReview: false }
  }

  const severityRank = { [SEVERITY.LOW]: 1, [SEVERITY.MEDIUM]: 2, [SEVERITY.HIGH]: 3 }
  const highestSeverity = matches.reduce(
    (highest, m) => (severityRank[m.severity] > severityRank[highest] ? m.severity : highest),
    SEVERITY.LOW
  )
  const hadEvasionAttempt = matches.some((m) => m.method === 'normalized-evasion')

  return {
    text: maskText(text, matches),
    wasModerated: true,
    highestSeverity,
    hadEvasionAttempt,
    flaggedForReview: highestSeverity === SEVERITY.HIGH
  }
}

/**
 * NOT AN AI SAFETY SYSTEM — this filter reliably catches known,
 * listed terms and their obvious spacing/repeated-character variants.
 * It does not understand context, sarcasm, coded harassment, or
 * novel misspellings. Use alongside reports + moderation review, not
 * as a substitute for them.
 */
export const FILTER_LIMITATIONS_NOTICE =
  'Automated language filtering catches known patterns only — it is not a substitute for reports and human moderation review.'
