import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import ProtectedRoute, { FullScreenLoader, PublicRoute } from './auth/components/ProtectedRoute.jsx'

const LoginPage = lazy(() => import('./auth/pages/LoginPage.jsx'))
const SignupPage = lazy(() => import('./auth/pages/SignupPage.jsx'))
const ForgotPasswordPage = lazy(() => import('./auth/pages/ForgotPasswordPage.jsx'))
const VerifyEmailPage = lazy(() => import('./auth/pages/VerifyEmailPage.jsx'))
const CampusVerificationPage = lazy(() => import('./auth/pages/CampusVerificationPage.jsx'))
const CreateProfilePage = lazy(() => import('./auth/pages/CreateProfilePage.jsx'))
const HomePage = lazy(() => import('./pages/HomePage.jsx'))
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'))
const ComingSoon = lazy(() => import('./pages/ComingSoon.jsx'))
const PostDetailPlaceholder = lazy(() => import('./pages/PostDetailPlaceholder.jsx'))
const StudentProfilePlaceholder = lazy(() => import('./pages/StudentProfilePlaceholder.jsx'))
const SearchPage = lazy(() => import('./pages/SearchPage.jsx'))
const ClubDetailPlaceholder = lazy(() => import('./pages/ClubDetailPlaceholder.jsx'))
const EventDetailPlaceholder = lazy(() => import('./pages/EventDetailPlaceholder.jsx'))

export default function App() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <SignupPage />
            </PublicRoute>
          }
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        <Route
          path="/verify-email"
          element={
            <ProtectedRoute stage="verify-email">
              <VerifyEmailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campus-verification"
          element={
            <ProtectedRoute stage="onboarding">
              <CampusVerificationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-profile"
          element={
            <ProtectedRoute stage="onboarding">
              <CreateProfilePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/home"
          element={
            <ProtectedRoute stage="home">
              <HomePage />
            </ProtectedRoute>
          }
        />

        {/* Search — now a real page (Feature 3). */}
        <Route
          path="/search"
          element={
            <ProtectedRoute stage="home">
              <SearchPage />
            </ProtectedRoute>
          }
        />

        {/* Bottom-nav + header destinations not yet built as real pages —
            real, guarded routes so every button works today; each swaps
            to its real page as that feature is built. */}
        <Route
          path="/create"
          element={
            <ProtectedRoute stage="home">
              <ComingSoon title="Create Post" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <ProtectedRoute stage="home">
              <ComingSoon title="Messages" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute stage="home">
              <ComingSoon title="Profile" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute stage="home">
              <ComingSoon title="Notifications" />
            </ProtectedRoute>
          }
        />

        {/* Dynamic feed/search destinations. */}
        <Route
          path="/post/:postId"
          element={
            <ProtectedRoute stage="home">
              <PostDetailPlaceholder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/:username"
          element={
            <ProtectedRoute stage="home">
              <StudentProfilePlaceholder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/club/:clubId"
          element={
            <ProtectedRoute stage="home">
              <ClubDetailPlaceholder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/event/:eventId"
          element={
            <ProtectedRoute stage="home">
              <EventDetailPlaceholder />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute stage="admin">
              <AdminPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<LandingPage />} />
      </Routes>
    </Suspense>
  )
}