const FLAG_KEY = 'campinity:justOnboarded'

/**
 * A one-shot flag, not router state — deliberately, so the welcome
 * intro is robust to every edge case in the brief (refresh, back
 * button, an already-authenticated user landing on /home some other
 * way): it only ever fires because CreateProfilePage.jsx set it right
 * before navigating, and it's consumed (read + immediately cleared) the
 * very first time HomePage.jsx checks it. Any later mount of HomePage —
 * a refresh, a return visit, clicking Home in the nav — reads nothing
 * and behaves exactly as it always has.
 */
export function markJustOnboarded() {
  try {
    window.sessionStorage.setItem(FLAG_KEY, '1')
  } catch {
    // Storage unavailable (private mode, disabled storage) — the user
    // still reaches Home normally, they just don't get the intro.
  }
}

export function consumeJustOnboardedFlag() {
  try {
    const flag = window.sessionStorage.getItem(FLAG_KEY)
    if (flag) window.sessionStorage.removeItem(FLAG_KEY)
    return Boolean(flag)
  } catch {
    return false
  }
}

export function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
