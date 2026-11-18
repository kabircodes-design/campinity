/**
 * Pure decision logic for the horizontal tab swipe (no React, no DOM
 * writes) so it can be unit-tested directly. useTabSwipe.js wires these
 * to real touch events.
 */

export const MIN_INTENT_DISTANCE = 12 // px moved before a gesture is classified at all (ignores taps/jitter)
export const HORIZONTAL_INTENT_RATIO = 1.7 // |dx| must exceed |dy| by this factor, otherwise vertical scroll wins
export const COMPLETE_DISTANCE_RATIO = 0.28 // fraction of the viewport width that completes a swipe on release
export const COMPLETE_VELOCITY = 0.5 // px/ms — a quick flick completes even below the distance threshold
export const MIN_FLICK_DISTANCE = 48 // px — a flick shorter than this never navigates, however fast

const INTERACTIVE_SELECTOR =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="slider"], video, audio, canvas, [data-no-tab-swipe]'

/**
 * True when a swipe starting on `target` must NOT switch tabs: text
 * fields, sliders, media, anything opted out with data-no-tab-swipe,
 * and anything inside a horizontally scrollable area (story rows, chip
 * rows, carousels) — that content owns its own horizontal gesture.
 * Stops at `boundary` (the swipe container).
 */
export function shouldIgnoreSwipeStart(target, boundary) {
  if (!target || typeof target.closest !== 'function') return true
  if (target.closest(INTERACTIVE_SELECTOR)) return true
  let node = target
  while (node && node !== boundary && node.nodeType === 1) {
    if (node.scrollWidth > node.clientWidth + 1) {
      const overflowX = getComputedStyle(node).overflowX
      if (overflowX === 'auto' || overflowX === 'scroll') return true
    }
    node = node.parentElement
  }
  return false
}

/** 'horizontal' | 'vertical' once movement is large enough to tell, else null. */
export function classifyIntent(dx, dy) {
  if (Math.hypot(dx, dy) < MIN_INTENT_DISTANCE) return null
  return Math.abs(dx) > Math.abs(dy) * HORIZONTAL_INTENT_RATIO ? 'horizontal' : 'vertical'
}

/**
 * What a finished horizontal drag means: 1 (next tab), -1 (previous
 * tab) or 0 (snap back). dx < 0 is a leftward swipe = next tab.
 */
export function resolveSwipe({ dx, elapsedMs, viewportWidth, canGoNext, canGoPrev }) {
  const distance = Math.abs(dx)
  const velocity = distance / Math.max(1, elapsedMs)
  const farEnough = distance > viewportWidth * COMPLETE_DISTANCE_RATIO
  const fastEnough = velocity > COMPLETE_VELOCITY && distance > MIN_FLICK_DISTANCE
  if (!farEnough && !fastEnough) return 0
  if (dx < 0) return canGoNext ? 1 : 0
  return canGoPrev ? -1 : 0
}

/** Drag offset shown while the finger moves; resists at the first/last tab. */
export function dragOffset(dx, { canGoNext, canGoPrev }) {
  const blocked = (dx < 0 && !canGoNext) || (dx > 0 && !canGoPrev)
  return blocked ? dx * 0.15 : dx
}
