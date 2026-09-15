/**
 * useIsAdmin — the correct, secure replacement for the previous
 * client-side check (profile?.role === 'admin'), which was a
 * confirmed vulnerability: any signed-in user could self-write
 * role: 'admin' to their own users/{uid} document (that field was
 * never excluded from self-edit in firestore.rules before this
 * pass) and pass the old check entirely.
 *
 * Calls the checkAdminStatus Cloud Function, which reads
 * platformAdmins/{uid} server-side via the Admin SDK (the only
 * mechanism that can — that collection is locked to `allow read: if
 * false` for every client, even the admin themselves). Returns a
 * boolean the client cannot forge into a real privileged write: every
 * actual admin-only Firestore operation independently re-verifies
 * platformAdmins/{uid} inside the rules themselves, not just here.
 *
 * Result is cached in memory for the session (not persisted anywhere)
 * to avoid re-calling the function on every route check — a fresh
 * page load re-checks once.
 *
 * `enabled` (health-audit fix): ProtectedRoute.jsx is the only caller,
 * and it used to call this unconditionally on EVERY protected route —
 * Home, Messages, Profile, Settings, Stories, Radar, every page in the
 * app — even though the result is only ever read when stage==='admin'
 * (a handful of legacy routes: /college-requests, /verification-requests,
 * etc.). The module-level cache already prevented a second network
 * call per session, but the FIRST protected page any signed-in user
 * ever opens — almost always Home, never an admin route — still fired
 * a real checkAdminStatus Cloud Function round-trip for no reason.
 * Defaults to true so this stays a strictly additive, opt-in change —
 * no other call site exists today, but nothing breaks if one is added
 * later without passing this.
 */
import { useEffect, useState } from 'react'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { auth } from '../firebase/firebase.js'

let cachedResult = null // { uid, isAdmin } — invalidated if the signed-in uid changes

export function useIsAdmin(enabled = true) {
  const [isAdmin, setIsAdmin] = useState(cachedResult?.isAdmin ?? null)
  const [loading, setLoading] = useState(enabled && cachedResult === null)

  useEffect(() => {
    if (!enabled) return

    const uid = auth.currentUser?.uid
    if (!uid) {
      setIsAdmin(false)
      setLoading(false)
      return
    }

    if (cachedResult && cachedResult.uid === uid) {
      setIsAdmin(cachedResult.isAdmin)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    const functions = getFunctions()
    const callable = httpsCallable(functions, 'checkAdminStatus')
    callable()
      .then((result) => {
        if (cancelled) return
        const admin = Boolean(result.data?.isAdmin)
        cachedResult = { uid, isAdmin: admin }
        setIsAdmin(admin)
      })
      .catch((err) => {
        // FIX: previously discarded the real error entirely — any
        // failure silently became "not admin" with zero trace of why.
        // Logged now so the actual cause (e.g. functions/not-found if
        // checkAdminStatus was never deployed, or permission-denied,
        // or a network error) is visible in the browser console
        // instead of masked behind a generic Access Denied screen.
        console.error('[useIsAdmin] checkAdminStatus call failed', { code: err?.code, message: err?.message })
        // Fail closed — a failed check means "not admin," never
        // "assume admin," matching checkAdminStatus's own
        // fail-closed behavior server-side.
        if (!cancelled) setIsAdmin(false)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { isAdmin, loading }
}
