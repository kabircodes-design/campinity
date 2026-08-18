/**
 * Provider-agnostic image moderation contract. Every provider
 * implementation (openaiProvider.js, and any future one) exports a
 * single async function matching this shape:
 *
 *   moderateImage({ imageUrl }) => Promise<{
 *     decision: 'SAFE' | 'REVIEW' | 'BLOCK',
 *     categories: string[],   // which categories triggered, if any — informational only, not stored raw
 *     provider: string,
 *     providerVersion: string
 *   }>
 *
 * The orchestrator (index.js) only ever imports moderateImage from
 * whichever provider file is currently wired in — never a
 * provider-specific name like openaiModerateImage — so swapping
 * providers later is a one-line import change in index.js, not a
 * rewrite of the calling code, matching requirement 15 directly.
 */
