import { getFunctions, httpsCallable } from 'firebase/functions'

/**
 * Thin wrapper so every admin page doesn't repeat getFunctions()/
 * httpsCallable() boilerplate — not a new pattern, just avoiding
 * copy-paste of the one adminAuthService.js/AdminReportsPage.jsx
 * already established.
 */
export function callAdmin(name, data) {
  return httpsCallable(getFunctions(), name)(data).then((result) => result.data)
}
