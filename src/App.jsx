import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import ProtectedRoute, { FullScreenLoader, PublicRoute } from './auth/components/ProtectedRoute.jsx'
import AppShell from './components/AppShell.jsx'

const LoginPage = lazy(() => import('./auth/pages/LoginPage.jsx'))
const SignupPage = lazy(() => import('./auth/pages/SignupPage.jsx'))
const ForgotPasswordPage = lazy(() => import('./auth/pages/ForgotPasswordPage.jsx'))
const VerifyEmailPage = lazy(() => import('./auth/pages/VerifyEmailPage.jsx'))
const CampusVerificationPage = lazy(() => import('./auth/pages/CampusVerificationPage.jsx'))
const CreateProfilePage = lazy(() => import('./auth/pages/CreateProfilePage.jsx'))
const HomePage = lazy(() => import('./pages/HomePage.jsx'))
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'))
const ComingSoon = lazy(() => import('./pages/ComingSoon.jsx'))
const MarketplacePage = lazy(() => import('./marketplace/MarketplacePage.jsx'))
const CreateProductPage = lazy(() => import('./marketplace/CreateProductPage.jsx'))
const ProductDetailPage = lazy(() => import('./marketplace/ProductDetailPage.jsx'))
const AdsDiscoveryPage = lazy(() => import('./ads/AdsDiscoveryPage.jsx'))
const AdsDashboardPage = lazy(() => import('./ads/AdsDashboardPage.jsx'))
const CreateCampaignPage = lazy(() => import('./ads/CreateCampaignPage.jsx'))
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage.jsx'))
const DeleteAccountPage = lazy(() => import('./pages/DeleteAccountPage.jsx'))
const BlockedUsersPage = lazy(() => import('./pages/BlockedUsersPage.jsx'))
const NotificationSettingsPage = lazy(() => import('./pages/NotificationSettingsPage.jsx'))
const PrivacySettingsPage = lazy(() => import('./pages/PrivacySettingsPage.jsx'))
const HelpSettingsPage = lazy(() => import('./pages/HelpSettingsPage.jsx'))
const AboutSettingsPage = lazy(() => import('./pages/AboutSettingsPage.jsx'))
const StudentProfilePlaceholder = lazy(() => import('./pages/StudentProfilePlaceholder.jsx'))
const SearchPage = lazy(() => import('./pages/SearchPage.jsx'))
const ClubDetailPlaceholder = lazy(() => import('./pages/ClubDetailPlaceholder.jsx'))
const EventDetailPlaceholder = lazy(() => import('./pages/EventDetailPlaceholder.jsx'))
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'))
const EditProfilePage = lazy(() => import('./pages/EditProfilePage.jsx'))
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'))
const CreatePostPage = lazy(() => import('./pages/CreatePostPage.jsx'))
const PostDetailPage = lazy(() => import('./pages/PostDetailPage.jsx'))
const MessagesPage = lazy(() => import('./pages/MessagesPage.jsx'))
const RequestsPage = lazy(() => import('./pages/RequestsPage.jsx'))
const GroupInfoPage = lazy(() => import('./messaging/GroupInfoPage.jsx'))
const RadarPage = lazy(() => import('./pages/RadarPage.jsx'))
const SavedLibraryPage = lazy(() => import('./saved/SavedLibraryPage.jsx'))
const CollectionPage = lazy(() => import('./saved/CollectionPage.jsx'))
const ChatPage = lazy(() => import('./pages/ChatPage.jsx'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage.jsx'))
const NotificationDetailPage = lazy(() => import('./pages/NotificationDetailPage.jsx'))
const AddCollegePage = lazy(() => import('./pages/AddCollegePage.jsx'))
const CollegePage = lazy(() => import('./pages/CollegePage.jsx'))
const CollegeRequestsAdminPage = lazy(() => import('./pages/CollegeRequestsAdminPage.jsx'))
const VerifyCollegePage = lazy(() => import('./pages/VerifyCollegePage.jsx'))
const VerificationRequestsAdminPage = lazy(() => import('./pages/VerificationRequestsAdminPage.jsx'))
const ModerationDashboardPage = lazy(() => import('./pages/ModerationDashboardPage.jsx'))
const CommunityJoinRequestsPage = lazy(() => import('./pages/CommunityJoinRequestsPage.jsx'))
const FollowersPage = lazy(() => import('./pages/FollowersPage.jsx'))
const FollowingPage = lazy(() => import('./pages/FollowingPage.jsx'))
const CreateCommunityPage = lazy(() => import('./pages/CreateCommunityPage.jsx'))
const CommunityDetailPage = lazy(() => import('./pages/CommunityDetailPage.jsx'))
const CommunitySettingsPage = lazy(() => import('./pages/CommunitySettingsPage.jsx'))
const DiscoverCommunitiesPage = lazy(() => import('./pages/DiscoverCommunitiesPage.jsx'))
const LostFoundPage = lazy(() => import('./pages/LostFoundPage.jsx'))
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage.jsx'))

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
          path="/radar"
          element={
            <ProtectedRoute stage="home">
              <RadarPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/saved"
          element={
            <ProtectedRoute stage="home">
              <SavedLibraryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/saved/collection/:collectionId"
          element={
            <ProtectedRoute stage="home">
              <CollectionPage />
            </ProtectedRoute>
          }
        />

        {/* Persistent shell — sidebar/header/bottom-nav mount ONCE here
            (AppShell.jsx) and never remount navigating between these 5
            pages; only <Outlet/>'s content changes. This is what fixes
            "navigation feels like a fresh page load" for the app's
            highest-traffic destinations. See AppShell.jsx's own comment
            for why Search/Notifications/Profile/Settings aren't part of
            this group (still on an older, structurally different
            layout that predates this pass — they still benefit from
            the shared AuthContext fix below, just not this shell). */}
        <Route element={<ProtectedRoute stage="home"><AppShell /></ProtectedRoute>}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/communities" element={<DiscoverCommunitiesPage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/lost-found" element={<LostFoundPage />} />
          <Route path="/messages" element={<MessagesPage />} />
        </Route>

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
          path="/messages/requests"
          element={
            <ProtectedRoute stage="home">
              <RequestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages/:chatId/info"
          element={
            <ProtectedRoute stage="home">
              <GroupInfoPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages/:chatId"
          element={
            <ProtectedRoute stage="home">
              <ChatPage />
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
          path="/college-requests"
          element={
            <ProtectedRoute stage="admin">
              <CollegeRequestsAdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/verify-college"
          element={
            <ProtectedRoute stage="home">
              <VerifyCollegePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/verification-requests"
          element={
            <ProtectedRoute stage="admin">
              <VerificationRequestsAdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/moderation"
          element={
            <ProtectedRoute stage="admin">
              <ModerationDashboardPage />
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
          path="/leaderboard"
          element={
            <ProtectedRoute stage="home">
              <LeaderboardPage />
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
          path="/marketplace/create"
          element={
            <ProtectedRoute stage="home">
              <CreateProductPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/marketplace/:productId"
          element={
            <ProtectedRoute stage="home">
              <ProductDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Campinity Ads — PROTOTYPE ONLY, isolated dummy-data area,
            entirely separate from the real /marketplace above. */}
        <Route
          path="/ads"
          element={
            <ProtectedRoute stage="home">
              <AdsDiscoveryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ads/dashboard"
          element={
            <ProtectedRoute stage="home">
              <AdsDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ads/create-campaign"
          element={
            <ProtectedRoute stage="home">
              <CreateCampaignPage />
            </ProtectedRoute>
          }
        />

        {/* /community/create must come before the dynamic
            /community/:communityId route, or "create" would be matched
            as a communityId param instead. */}
        <Route
          path="/community/create"
          element={
            <ProtectedRoute stage="home">
              <CreateCommunityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/community/:communityId/settings"
          element={
            <ProtectedRoute stage="home">
              <CommunitySettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/community/:communityId/requests"
          element={
            <ProtectedRoute stage="home">
              <CommunityJoinRequestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/community/:communityId"
          element={
            <ProtectedRoute stage="home">
              <CommunityDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/followers/:username?"
          element={
            <ProtectedRoute stage="home">
              <FollowersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/following/:username?"
          element={
            <ProtectedRoute stage="home">
              <FollowingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/notifications"
          element={
            <ProtectedRoute stage="home">
              <NotificationSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/change-password"
          element={
            <ProtectedRoute stage="home">
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/delete-account"
          element={
            <ProtectedRoute stage="home">
              <DeleteAccountPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/privacy"
          element={
            <ProtectedRoute stage="home">
              <PrivacySettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/blocked-users"
          element={
            <ProtectedRoute stage="home">
              <BlockedUsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/help"
          element={
            <ProtectedRoute stage="home">
              <HelpSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/about"
          element={
            <ProtectedRoute stage="home">
              <AboutSettingsPage />
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
            <ProtectedRoute stage="admin-entry">
              <AdminPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<LandingPage />} />
      </Routes>
    </Suspense>
  )
}
