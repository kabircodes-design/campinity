import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useIsAdmin } from '../../hooks/useIsAdmin.js'
import Loader from './Loader.jsx'
import Logo from '../../components/Logo.jsx'

export function FullScreenLoader() {
  return (
    <div className="min-h-screen bg-bg dark:bg-[#09090f] flex items-center justify-center">
      <Loader size="lg" tone="dark" />
    </div>
  )
}

/**
 * ROOT-CAUSE FIX for "white screen flash + left navbar disappears" on
 * navigation — specifically App.jsx's single top-level
 * <Suspense fallback={...}>, which wraps the ENTIRE <Routes> tree.
 * Pages NESTED inside AppShell (Home, Communities, Marketplace, etc.)
 * never actually hit this: AppShell itself is imported eagerly (never
 * lazy), and it has its OWN internal <Suspense> around just its
 * <Outlet/>, so switching between AppShell pages only ever shows a
 * small in-shell loader with the sidebar staying mounted throughout.
 * But a handful of pages are standalone top-level routes, not nested
 * inside AppShell's route group (ChatPage at /messages/:chatId is the
 * one the user hits constantly; GroupInfoPage is another) — each is
 * itself lazy-loaded, so the FIRST time one is visited in a session,
 * THIS root Suspense boundary is what actually fires, unmounting
 * AppShell (sidebar included) and replacing the entire screen with
 * whatever the fallback renders until that page's chunk finishes
 * loading. FullScreenLoader (above) was that fallback — a bare
 * centered spinner with no sidebar shape at all, which is the literal
 * "app shell disappears, blank screen, then the page pops in" effect
 * being reported.
 *
 * This is a deliberately separate component from FullScreenLoader,
 * not a shared edit to it — FullScreenLoader is ALSO used by
 * ProtectedRoute's own initial-auth-resolution check below, which
 * fires before we even know whether this visitor has a session at
 * all (so before we know whether they'll ever see AppShell's sidebar
 * — showing a sidebar-shaped skeleton there would be actively
 * misleading, e.g. for a signed-out visitor about to land on
 * /login). AppNavigationLoader is used ONLY for App.jsx's root
 * Suspense fallback, where we're already past auth/onboarding and
 * simply waiting on a lazy chunk mid-navigation — a fully different
 * situation that legitimately calls for a shell-shaped placeholder.
 *
 * No routing was restructured to fix this — ChatPage/GroupInfoPage
 * stay exactly where they are; this only changes what's shown WHILE
 * their chunk loads. The sidebar column here is a static, non-
 * interactive approximation (logo + pulsing bars, no real nav
 * items/unread counts — this component has no access to that data
 * and doesn't need it for a moment-long placeholder) using the exact
 * same dimensions/colors as the real DesktopSidebar/AppShell wrapper,
 * so the transition reads as "the app is still there, one part of it
 * is loading" rather than "the app disappeared." Desktop-only
 * (hidden lg:flex, matching DesktopSidebar itself) — on mobile there
 * is no sidebar to preserve the illusion of, and BottomNav is
 * deliberately absent on some of these exact pages (ChatPage), so a
 * mobile skeleton nav bar would flicker in and back out rather than
 * help.
 */
export function AppNavigationLoader() {
  return (
    <div className="min-h-screen w-full flex bg-[#f8fafc] dark:bg-[#09090f]">
      <div className="hidden lg:flex lg:flex-col w-64 flex-shrink-0 h-screen px-4 py-5 border-r border-gray-100 dark:border-white/10" aria-hidden="true">
        <div className="flex items-center px-1 mb-8">
          <Logo className="w-8 h-8" withWordmark />
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-gray-100 dark:bg-white/5 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <Loader size="lg" tone="dark" />
      </div>
    </div>
  )
}

export function resolveOnboardingRoute(profile) {
  if (profile?.profileCompleted) {
    return '/home'
  }

  if (profile?.verificationMethod === 'skipped') {
    return '/create-profile'
  }

  const status = profile?.verificationStatus
  if (!status || status === 'not_started' || status === 'pending') {
    return '/campus-verification'
  }

  return '/create-profile'
}

export function isCampusVerified(profile) {
  return profile?.verifiedCampus === true
}

/**
 * Root ("/") route guard — used ONLY to fix Android app startup showing
 * Landing, or a wrong intermediate onboarding page, before the real
 * destination, without touching Landing/web at all.
 *
 * Root cause #1: <Route path="/" element={<LandingPage />} /> in
 * App.jsx has never been auth-aware — it renders unconditionally, with
 * no ProtectedRoute/PublicRoute wrapper, regardless of Firebase auth
 * state. That's correct for the web/Vercel marketing site (visitors,
 * including already-signed-in ones, should land on Landing at the root
 * URL there). But it means an already-authenticated user cold-launching
 * the Android app also briefly saw Landing, since nothing gated it.
 *
 * Root cause #2 (found via real-device logcat, not guessed — see
 * useAuthUser.js's own comment for the full evidence): even after
 * fixing #1, a fully-onboarded account could still briefly redirect to
 * Campus Verification/Create Profile before correcting itself to Home,
 * because Firestore's onSnapshot delivers a first, empty, from-cache
 * callback on every cold start before the real server data arrives a
 * few hundred ms later. `profileSettled` (from the shared AuthContext,
 * not a new listener) is specifically what fixes this: it only becomes
 * true once that real, server-confirmed snapshot has landed, so this
 * component keeps waiting instead of computing a redirect from
 * incomplete data.
 *
 * This component reuses the exact same decision rules PublicRoute and
 * ProtectedRoute stage="home" already apply elsewhere (not new rules):
 * once resolved, send an authenticated+onboarded user straight to
 * /home, an unverified-email user to /verify-email, a not-yet-onboarded
 * user through resolveOnboardingRoute, and anyone else to /login — the
 * existing authentication flow, not a bypass of it. Web/Vercel is
 * completely unaffected: Capacitor.isNativePlatform() is false in any
 * browser, so this renders <LandingPage/> exactly as before, and none
 * of the below (including the SplashScreen call) ever runs there.
 *
 * The native splash (`launchAutoHide: false` in capacitor.config.json)
 * stays on screen covering the WebView the entire time this component
 * is still resolving — SplashScreen.hide() below is called at the
 * exact moment (and not one render earlier) a concrete destination is
 * about to be revealed, so the handoff is splash → final page directly,
 * with no spinner/blank frame ever visible in between.
 */
export function RootRoute({ landing }) {
  const isNative = Capacitor.isNativePlatform()
  const { user, profile, loading, profileSettled } = useAuth()

  const stillResolving = loading || (!!user && !profileSettled)

  useEffect(() => {
    if (!isNative || stillResolving) return
    SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {})
  }, [isNative, stillResolving])

  if (!isNative) return landing

  if (stillResolving) return <FullScreenLoader />

  if (!user) return <Navigate to="/login" replace />
  if (!user.emailVerified) return <Navigate to="/verify-email" replace />
  if (!profile?.profileCompleted) return <Navigate to={resolveOnboardingRoute(profile)} replace />

  return <Navigate to="/home" replace />
}

export default function ProtectedRoute({ stage, children }) {
  // Reads the ONE shared, persistent auth subscription (AuthContext,
  // mounted once in main.jsx) instead of calling useAuthUser() itself
  // — this used to create a brand-new onAuthStateChanged + profile
  // onSnapshot + presence-heartbeat listener on every single
  // navigation (every route has its own ProtectedRoute instance), which
  // is why `loading` went back to true and this component's own
  // spinner flashed on every page change. Now `loading` only matters
  // once, at initial app load.
  const { user, profile, loading } = useAuth()
  // Only actually calls the checkAdminStatus Cloud Function for the
  // stage that reads its result — see useIsAdmin.js's own comment for
  // why this was previously firing on every single protected route.
  const { isAdmin, loading: adminLoading } = useIsAdmin(stage === 'admin')
  const location = useLocation()

  if (loading) return <FullScreenLoader />

  // A verification-link click can land on this route with no active
  // session at all (a different browser/device than the one used to
  // sign up, or a session that already expired) — the token itself,
  // not an authenticated session, is what verifyEmailVerificationToken
  // checks server-side. Let VerifyEmailPage render and handle it.
  if (stage === 'verify-email' && !user && new URLSearchParams(location.search).has('token')) {
    return children
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (stage === 'verify-email') {
    if (user.emailVerified) {
      return <Navigate to={resolveOnboardingRoute(profile)} replace />
    }
    return children
  }

  if (!user.emailVerified) {
    return <Navigate to="/verify-email" replace />
  }

  if (stage === 'onboarding') {
    if (profile?.profileCompleted) {
      return <Navigate to="/home" replace />
    }
    return children
  }

  // /admin has its own independent gate (AdminGate/AdminLockScreen's
  // password + server-verified session token) that has nothing to do
  // with normal-user onboarding. Requiring profileCompleted here as
  // well was actively wrong (an authenticated, email-verified admin
  // could get routed through /campus-verification and dumped on /home
  // before ever reaching AdminPage) and unnecessary (AdminLockScreen
  // never reads `profile` at all). Still requires real Firebase auth +
  // a verified email above — only the onboarding-completion
  // requirement is skipped.
  if (stage === 'admin-entry') {
    return children
  }

  if (!profile?.profileCompleted) {
    return <Navigate to={resolveOnboardingRoute(profile)} replace />
  }

  if (stage === 'admin') {
    if (adminLoading) return <FullScreenLoader />
    if (!isAdmin) {
      return (
        <div className="min-h-screen bg-bg dark:bg-[#09090f] flex items-center justify-center px-6 text-center">
          <p className="text-sm text-ink-soft dark:text-gray-400">Access denied — admin only.</p>
        </div>
      )
    }
  }

  return children
}

export function PublicRoute({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <FullScreenLoader />

  if (user && user.emailVerified && profile?.profileCompleted) {
    return <Navigate to="/home" replace />
  }

  return children
}
