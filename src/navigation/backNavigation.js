import { getMainTabIndex } from './mainTabs.js'

/**
 * What Android's hardware Back button does on a given screen. Pure (no
 * React, no Capacitor) so it can be unit-tested; useAndroidBackButton.js
 * carries the decision out.
 *
 * Returns one of:
 *   { type: 'exit' }                       leave the app (Home, sign-in flow)
 *   { type: 'history' }                    go back one entry in the app's own history
 *   { type: 'navigate', to, replace }      go to a route
 *
 * Rules, in order:
 *  1. Home, and the signed-out/onboarding screens: exit, as Android does
 *     at an app's root.
 *  2. The other main tabs: go to Home (Instagram-style), rather than
 *     stepping back through every tab visited by swiping.
 *  3. Any other screen with earlier in-app history: go back to the
 *     screen the user actually came from (Campus Rank opened from
 *     Profile returns to Profile; from Home, to Home).
 *  4. No in-app history (deep link, notification tap, cold start): go to
 *     the screen's logical parent, so Back never dead-ends.
 */

const EXIT_ROUTES = new Set(['/', '/home', '/login', '/signup', '/forgot-password', '/verify-email', '/campus-verification', '/create-profile'])

// [pattern, parent] — first match wins; more specific patterns first.
const PARENT_RULES = [
  [/^\/messages\/requests$/, '/messages'],
  [/^\/messages\/([^/]+)\/info$/, (m) => `/messages/${m[1]}`],
  [/^\/messages\/[^/]+$/, '/messages'],
  [/^\/settings$/, '/profile'],
  [/^\/settings\/.+$/, '/settings'],
  [/^\/saved\/collection\/[^/]+$/, '/saved'],
  [/^\/(profile\/edit|followers|following|saved|progress|badges|reputation|achievements\/add)(\/.*)?$/, '/profile'],
  [/^\/leaderboard$/, '/progress'],
  [/^\/community\/([^/]+)\/(settings|requests)$/, (m) => `/community/${m[1]}`],
  [/^\/(community|club)\/[^/]+$/, '/communities'],
  [/^\/marketplace\/.+$/, '/marketplace'],
  [/^\/notifications\/[^/]+$/, '/notifications'],
  [/^\/ads\/.+$/, '/ads']
]

export function getLogicalParent(pathname) {
  for (const [pattern, parent] of PARENT_RULES) {
    const match = pathname.match(pattern)
    if (match) return typeof parent === 'function' ? parent(match) : parent
  }
  return '/home'
}

export function resolveBackAction(pathname, historyIndex) {
  if (EXIT_ROUTES.has(pathname)) return { type: 'exit' }
  if (getMainTabIndex(pathname) !== -1) return { type: 'navigate', to: '/home', replace: true }
  if (historyIndex > 0) return { type: 'history' }
  return { type: 'navigate', to: getLogicalParent(pathname), replace: true }
}
