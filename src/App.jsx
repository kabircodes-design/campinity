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