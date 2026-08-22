/**
 * OpenAI implementation of the moderateImage contract (see
 * provider.js). Uses the omni-moderation-latest model, which accepts
 * image_url input directly — no separate image-download/base64 step
 * needed on our side beyond generating a short-lived signed URL for
 * the quarantined file.
 *
 * UNTESTED — I have no OpenAI API key, no deployed Firebase project,
 * and no way to actually invoke this function or the real OpenAI API
 * from this environment. This is written to the documented OpenAI
 * moderation API shape as of my training data, but has not been
 * executed even once. Deploy and test with a real API key before
 * trusting this in production — see this feature's own final report
 * for the exact honest test status.
 *
 * The API key is read from a server-side environment variable
 * (process.env.OPENAI_API_KEY, set via `firebase functions:config:set`
 * or the newer `firebase functions:secrets:set` — NOT a Vite
 * VITE_-prefixed variable, which would bundle it into client-side JS
 * and expose it in the browser). This file only ever runs inside the
 * Cloud Function, never in browser code — confirmed by its own
 * location under functions/, which is never bundled by Vite.
 */

const OPENAI_MODERATION_ENDPOINT = 'https://api.openai.com/v1/moderations'
const MODEL = 'omni-moderation-latest'

/**
 * Maps OpenAI's raw category-flag response onto our three-state
 * decision model. OpenAI's moderation endpoint doesn't itself have a
 * notion of "REVIEW" — it's binary (flagged / not flagged) per
 * category. We introduce REVIEW ourselves for a narrower set of
 * categories where a false positive is plausible enough that
 * outright blocking feels too aggressive for a campus product (e.g.
 * mild violence context, self-harm intent ambiguity) — those go to
 * REVIEW instead of BLOCK. Anything flagged in the more clear-cut
 * categories (sexual content involving minors, graphic violence,
 * explicit sexual content) is BLOCK outright, no review step, since
 * there's no ambiguity worth a human second look delaying.
 */
const BLOCK_CATEGORIES = ['sexual/minors', 'violence/graphic', 'sexual']
const REVIEW_CATEGORIES = ['violence', 'self-harm', 'self-harm/intent', 'self-harm/instructions', 'harassment']

async function moderateImage({ imageUrl }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured on the server. Cannot moderate — refusing to publish unmoderated.')
  }

  const response = await fetch(OPENAI_MODERATION_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      input: [{ type: 'image_url', image_url: { url: imageUrl } }]
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI moderation request failed: ${response.status}`)
  }

  const body = await response.json()
  const result = body?.results?.[0]
  if (!result) {
    throw new Error('OpenAI moderation returned no result.')
  }

  const flaggedCategories = Object.entries(result.categories || {})
    .filter(([, flagged]) => flagged === true)
    .map(([category]) => category)

  let decision = 'SAFE'
  if (flaggedCategories.some((c) => BLOCK_CATEGORIES.includes(c))) {
    decision = 'BLOCK'
  } else if (flaggedCategories.some((c) => REVIEW_CATEGORIES.includes(c))) {
    decision = 'REVIEW'
  }

  return {
    decision,
    categories: flaggedCategories,
    provider: 'openai',
    providerVersion: MODEL
  }
}

module.exports = { moderateImage }
