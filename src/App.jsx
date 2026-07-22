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
const StudentProfilePlaceholder = lazy(() => import('./pages/StudentProfilePlaceholder.jsx'))
const SearchPage = lazy(() => import('./pages/SearchPage.jsx'))
const ClubDetailPlaceholder = lazy(() => import('./pages/ClubDetailPlaceholder.jsx'))
const EventDetailPlaceholder = lazy(() => import('./pages/EventDetailPlaceholder.jsx'))
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'))
const EditProfilePage = lazy(() => import('./pages/EditProfilePage.jsx'))
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'))
const CreatePostPage = lazy(() => import('./pages/CreatePostPage.jsx'))
const PostDetailPage = lazy(() => import('./pages/PostDetailPage.jsx'))
const ChatListPage = lazy(() => import('./pages/ChatListPage.jsx'))
const ChatScreenPage = lazy(() => import('./pages/ChatScreenPage.jsx'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage.jsx'))
const NotificationDetailPage = lazy(() => import('./pages/NotificationDetailPage.jsx'))
const AddCollegePage = lazy(() => import('./pages/AddCollegePage.jsx'))
const CollegePage = lazy(() => import('./pages/CollegePage.jsx'))

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
          path="/search"
          element={
            <ProtectedRoute stage="home">
              <SearchPage />
            </ProtectedRoute>
          }
        />

        {/* Create Post — now a real page (Feature 4B). */}
        <Route
          path="/create"
          element={
            <ProtectedRoute stage="home">
              <CreatePostPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/messages"
          element={
            <ProtectedRoute stage="home">
              <ChatListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages/:conversationId"
          element={
            <ProtectedRoute stage="home">
              <ChatScreenPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute stage="home">
              <NotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications/:notificationId"
          element={
            <ProtectedRoute stage="home">
              <NotificationDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/college/add"
          element={
            <ProtectedRoute stage="home">
              <AddCollegePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/college/:collegeId"
          element={
            <ProtectedRoute stage="home">
              <CollegePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute stage="home">
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/edit"
          element={
            <ProtectedRoute stage="home">
              <EditProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute stage="home">
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/followers"
          element={
            <ProtectedRoute stage="home">
              <ComingSoon title="Followers" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/following"
          element={
            <ProtectedRoute stage="home">
              <ComingSoon title="Following" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/notifications"
          element={
            <ProtectedRoute stage="home">
              <ComingSoon title="Notification Settings" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/privacy"
          element={
            <ProtectedRoute stage="home">
              <ComingSoon title="Privacy" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/blocked-users"
          element={
            <ProtectedRoute stage="home">
              <ComingSoon title="Blocked Users" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/help"
          element={
            <ProtectedRoute stage="home">
              <ComingSoon title="Help & Support" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/about"
          element={
            <ProtectedRoute stage="home">
              <ComingSoon title="About Campinity" />
            </ProtectedRoute>
          }
        />

        {/* Post Detail + Comments — now a real page (Feature 4B). */}
        <Route
          path="/post/:postId"
          element={
            <ProtectedRoute stage="home">
              <PostDetailPage />
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