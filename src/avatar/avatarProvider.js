/**
 * Campus Avatar generation — provider abstraction.
 *
 * HONEST ARCHITECTURAL LIMITATION, confirmed by inspecting this
 * project before writing a single line here: this is a pure
 * client-side Vite+React+Firebase app with NO backend, NO Cloud
 * Functions, and NO existing environment-variable pattern anywhere
 * (grepped the whole codebase — zero results for import.meta.env or
 * process.env). Any real AI image-generation API requires a secret
 * key. There is no way to call one from this client without shipping
 * that key inside the browser bundle, which is a real security
 * violation, not a style preference — so this file does NOT call a
 * real AI provider.
 *
 * What this file IS: a clean, isolated boundary matching exactly the
 * shape requested — generateCampusAvatar(selfieBlob, style, options)
 * — so that when this project gains a secure boundary (a Cloud
 * Function that holds the real API key server-side, or any other
 * server the client can call without exposing a secret), only THIS
 * file needs to change. No UI component calls an AI provider
 * directly anywhere in this feature.
 *
 * Current behavior: returns the selfie itself, unmodified, as a
 * placeholder "generated" result, clearly logged as such, so the
 * entire surrounding flow (capture -> style select -> processing UI
 * -> preview -> save -> profile integration) is real and fully
 * functional end to end, while being completely honest that the
 * actual style-transfer step is not implemented.
 */

export const AVATAR_STYLES = [
  { id: 'campus3d', label: 'Campus 3D', description: 'Rounded, friendly 3D look' },
  { id: 'cartoon', label: 'Clean Cartoon', description: 'Bold, simple line art' },
  { id: 'illustration', label: 'Soft Illustration', description: 'Gentle, painterly style' }
]

/**
 * @param {Blob} selfieBlob - the captured selfie image data
 * @param {string} styleId - one of AVATAR_STYLES' ids
 * @param {object} [options] - optional lightweight customization (hairstyle, glasses, etc.) — currently unused by the placeholder, forwarded unchanged so a real provider can consume them later without a signature change
 * @returns {Promise<Blob>} the generated avatar image data
 */
export async function generateCampusAvatar(selfieBlob, styleId, options = {}) {
  if (!selfieBlob) throw new Error('No selfie provided.')
  if (!AVATAR_STYLES.some((s) => s.id === styleId)) {
    throw new Error(`Unknown avatar style: "${styleId}"`)
  }

  console.warn(
    '[CampusAvatar] No secure AI provider is configured in this project — returning the selfie unmodified as a placeholder result. Swap this function\'s implementation for a real provider call once a secure server-side boundary exists.'
  )

  // Placeholder "processing time" so the real UI states (processing
  // messages, transitions) are genuinely exercised rather than
  // resolving instantly — this delay is cosmetic, not simulating a
  // fake progress percentage (the brief explicitly warns against
  // that), just giving the processing screen something real to show.
  await new Promise((resolve) => setTimeout(resolve, 1200))

  return selfieBlob
}
