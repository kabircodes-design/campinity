/**
 * The moderation word lexicon — deliberately kept separate from
 * profanityFilter.js's matching logic, per the explicit "do not use
 * a global bad-word array inside JSX / keep the list in a dedicated
 * module" requirement.
 *
 * IMPORTANT, STATED HONESTLY: this starter lexicon contains only a
 * small set of generic, mild English profanity terms, demonstrating
 * the real matching mechanism (case-insensitivity, spacing/repeated-
 * character evasion, severity tiers) — it does NOT include slurs or
 * severe hate/harassment terms. I'm not compiling that list myself;
 * it's something you should populate and review directly, since
 * getting a real-world slur/harassment lexicon right requires
 * judgment calls (regional slang, reclaimed terms, context) that
 * shouldn't be made unilaterally by whoever wires up the filter.
 * The architecture below (severity tiers, easy to extend, one term
 * per line) is built to make that population straightforward once
 * you're ready to do it.
 */

export const SEVERITY = {
  LOW: 'low',       // mild profanity — mask only
  MEDIUM: 'medium',  // insults / harassment language — mask + report signal
  HIGH: 'high'       // threats / hate / severe abuse — flag for moderation review, do not just mask
}

/**
 * Each entry: { term, severity }. `term` is the canonical, lowercase,
 * space-free form — profanityFilter.js's normalization strips spacing/
 * punctuation/repeated characters before comparing, so entries here
 * don't need every possible spelling variant listed separately.
 */
export const PROFANITY_TERMS = [
  { term: 'damn', severity: SEVERITY.LOW },
  { term: 'hell', severity: SEVERITY.LOW },
  { term: 'crap', severity: SEVERITY.LOW },
  { term: 'shit', severity: SEVERITY.LOW },
  { term: 'ass', severity: SEVERITY.LOW },
  { term: 'bitch', severity: SEVERITY.MEDIUM },
  { term: 'bastard', severity: SEVERITY.MEDIUM },
  { term: 'idiot', severity: SEVERITY.LOW },
  { term: 'stupid', severity: SEVERITY.LOW },
  // Added following a confirmed live-test report: 'madarchod' was
  // submitted through the real composer and posted unmasked. Root
  // cause was twofold — this term was never in the lexicon at all
  // (fixed here), AND the filter was never wired into any actual
  // write path (a separate, deeper issue — see this fix's own
  // report). Common Hindi/Urdu abusive terms below, same honest
  // caveat as the note above: this is not a comprehensive
  // multilingual lexicon, just the specifically reported gap plus
  // immediately adjacent common terms.
  { term: 'madarchod', severity: SEVERITY.HIGH },
  { term: 'behenchod', severity: SEVERITY.HIGH },
  { term: 'bhosdike', severity: SEVERITY.HIGH },
  { term: 'chutiya', severity: SEVERITY.MEDIUM },
  { term: 'randi', severity: SEVERITY.HIGH },
  { term: 'gandu', severity: SEVERITY.MEDIUM },
  { term: 'saala', severity: SEVERITY.LOW },
  { term: 'kutta', severity: SEVERITY.LOW }
  // Add real terms here as needed — one { term, severity } entry per
  // line, term in lowercase with no spaces. HIGH severity terms are
  // never auto-masked-and-forgotten by moderateText() below; they're
  // always additionally flagged for review, matching "do not blindly
  // treat every bad word identically."
]
