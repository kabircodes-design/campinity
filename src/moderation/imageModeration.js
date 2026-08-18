/**
 * Client-side image moderation interface — requirement 15's
 * "the application should call moderateImage(), not
 * openaiModerateImage()" applied to the client side too. This is the
 * ONLY function any UI component should ever call for image
 * moderation. It never talks to OpenAI directly (that would violate
 * requirement 3) — it invokes the moderateProfilePhoto Cloud Function,
 * which is the only place OpenAI is ever called from.
 *
 * If a Phase 2 needs a different callable per surface (post images,
 * community covers, etc.), those should each call their own Cloud
 * Function but through this same shaped client wrapper — not a
 * separate ad-hoc httpsCallable() call scattered through component
 * code.
 *
 * UNTESTED alongside the rest of this feature — see this feature's
 * final report for the honest test status.
 */
import { getFunctions, httpsCallable } from 'firebase/functions'

/**
 * @param {{ quarantinePath: string }} params
 * @returns {Promise<{ decision: 'SAFE' | 'REVIEW' | 'BLOCK', finalUrl?: string }>}
 */
export async function moderateImage({ quarantinePath }) {
  // No explicit app argument — uses the default initialized Firebase
  // app (already set up elsewhere in this project via firebase.js's
  // own initializeApp() call, which every other service file in this
  // project relies on implicitly the same way).
  const functions = getFunctions()
  const callable = httpsCallable(functions, 'moderateProfilePhoto')
  const result = await callable({ quarantinePath })
  return result.data
}
