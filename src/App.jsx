import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import ProtectedRoute, { AppNavigationLoader, PublicRoute, RootRoute } from './auth/components/ProtectedRoute.jsx'
import AppShell from './components/AppShell.jsx'

const LoginPage = lazy(() => import('./auth/pages/LoginPage.jsx'))
const SignupPage = lazy(() => import('./auth/pages/SignupPage.jsx'))
const ForgotPasswordPage = lazy(() => import('./auth/pages/ForgotPasswordPage.jsx'))
const VerifyEmailPage = lazy(() => import('./auth/pages/VerifyEmailPage.jsx'))
const CampusVerificationPage = lazy(() => import('./auth/pages/CampusVerificationPage.jsx'))
const CreateProfilePage = lazy(() => import('./auth/pages/CreateProfilePage.jsx'))
const HomePage = lazy(() => import('./pages/HomePage.jsx'))
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'))
const MarketplacePage = lazy(() => import('./marketplace/MarketplacePage.jsx'))
const CreateProductPage = lazy(() => import('./marketplace/CreateProductPage.jsx'))
const ProductDetailPage = lazy(() => import('./marketplace/ProductDetailPage.jsx'))
const AdsDiscoveryPage = lazy(() => import('./ads/AdsDiscoveryPage.jsx'))
const AdsDashboardPage = lazy(() => import('./ads/AdsDashboardPage.jsx'))
const CreateCampaignPage = lazy(() => import('./ads/CreateCampaignPage.jsx'))
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage.jsx'))
const DeleteAccountPage = lazy(() => import('./pages/DeleteAccountPage.jsx'))
const BlockedUsersPage = lazy(() => import('./pages/BlockedUsersPage.jsx'))
const CloseFriendsPage = lazy(() => import('./pages/CloseFriendsPage.jsx'))
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
const AppearancePage = lazy(() => import('./pages/AppearancePage.jsx'))
const AccountSettingsPage = lazy(() => import('./pages/AccountSettingsPage.jsx'))
const ActivitySettingsPage = lazy(() => import('./pages/ActivitySettingsPage.jsx'))
const MessagesSettingsPage = lazy(() => import('./pages/MessagesSettingsPage.jsx'))
const CommunitiesSettingsPage = lazy(() => import('./pages/CommunitiesSettingsPage.jsx'))
const SecuritySettingsPage = lazy(() => import('./pages/SecuritySettingsPage.jsx'))
const HashtagPage = lazy(() => import('./pages/HashtagPage.jsx'))
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
const CommunitiesHubPage = lazy(() => import('./pages/CommunitiesHubPage.jsx'))
const CreateClubPage = lazy(() => import('./pages/CreateClubPage.jsx'))
const ClubDetailPage = lazy(() => import('./pages/ClubDetailPage.jsx'))
const LostFoundPage = lazy(() => import('./pages/LostFoundPage.jsx'))
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage.jsx'))
const BadgesPage = lazy(() => import('./pages/BadgesPage.jsx'))
const ProgressPage = lazy(() => import('./pages/ProgressPage.jsx'))
const ReputationPage = lazy(() => import('./pages/ReputationPage.jsx'))
const AddAchievementPage = lazy(() => import('./pages/AddAchievementPage.jsx'))

export default function App() {
  return (
    <Suspense fallback={<AppNavigationLoader />}>
      <Routes>
        <Route path="/" element={<RootRoute landing={<LandingPage />} />} />

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
            (AppShell.jsx) and never remount navigating between these
            pages; only <Outlet/>'s content changes. This is the actual
            fix for "navigation feels like a fresh page load": these are
            every primary tab-bar/nav destination in the app, plus
            /community/:communityId (Community 2.0 rebuild — it needs the
            persistent DesktopSidebar for its own real desktop workspace
            layout, unlike a one-off drill-down page). Other detail/
            drill-down pages (chat threads, post detail, followers lists,
            community create/settings/requests, etc.) intentionally stay
            outside this group — they're not primary nav destinations, and
            forcing them into the shared shell would be a much larger,
            riskier change than this task asked for. Radar is also
            deliberately excluded — RadarPage.jsx is architected as its
            own full-screen takeover (its own back button, no sidebar
            usage at all even before this pass), not a shell-nested tab. */}
        <Route element={<ProtectedRoute stage="home"><AppShell /></ProtectedRoute>}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/communities" element={<CommunitiesHubPage />} />
          {/* Community 2.0: moved inside the shared AppShell (was its own
              full-screen page) so it gets the persistent DesktopSidebar +
              header for free on desktop, instead of centering a phone-width
              card in an otherwise empty viewport. Create/Settings/Requests
              stay standalone below, unchanged — this only moves the main
              detail page, which is the one this pass rebuilt. */}
          <Route path="/community/:communityId" element={<CommunityDetailPage />} />
          <Route path="/post/:postId" element={<PostDetailPage />} />
          <Route path="/student/:username" element={<StudentProfilePlaceholder />} />
          {/* Same fix, same reasoning, applied to the remaining profile-
              adjacent subpages a "final polish" pass flagged as still
              using the old standalone phone-width wrapper: Followers/
              Following/Message Requests/Edit Profile. */}
          <Route path="/followers/:username?" element={<FollowersPage />} />
          <Route path="/following/:username?" element={<FollowingPage />} />
          <Route path="/messages/requests" element={<RequestsPage />} />
          <Route path="/profile/edit" element={<EditProfilePage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/lost-found" element={<LostFoundPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          {/* Settings 2.0 — home + every sub-page now share the same
              AppShell/DesktopSidebar treatment as the rest of the app,
              instead of each being its own standalone phone-width card. */}
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/appearance" element={<AppearancePage />} />
          <Route path="/settings/account" element={<AccountSettingsPage />} />
          <Route path="/settings/activity" element={<ActivitySettingsPage />} />
          <Route path="/settings/messages" element={<MessagesSettingsPage />} />
          <Route path="/settings/communities" element={<CommunitiesSettingsPage />} />
          <Route path="/settings/security" element={<SecuritySettingsPage />} />
          <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
          <Route path="/settings/change-password" element={<ChangePasswordPage />} />
          <Route path="/settings/delete-account" element={<DeleteAccountPage />} />
          <Route path="/settings/privacy" element={<PrivacySettingsPage />} />
          <Route path="/settings/blocked-users" element={<BlockedUsersPage />} />
          <Route path="/settings/close-friends" element={<CloseFriendsPage />} />
          <Route path="/settings/help" element={<HelpSettingsPage />} />
          <Route path="/settings/about" element={<AboutSettingsPage />} />
          <Route path="/hashtag/:tag" element={<HashtagPage />} />
        </Route>

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
          path="/leaderboard"
          element={
            <ProtectedRoute stage="home">
              <LeaderboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/badges"
          element={
            <ProtectedRoute stage="home">
              <BadgesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/progress"
          element={
            <ProtectedRoute stage="home">
              <ProgressPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reputation"
          element={
            <ProtectedRoute stage="home">
              <ReputationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/achievements/add"
          element={
            <ProtectedRoute stage="home">
              <AddAchievementPage />
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
        {/* /club/create must also come before any dynamic /club/:communityId route. */}
        <Route
          path="/club/create"
          element={
            <ProtectedRoute stage="home">
              <CreateClubPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/club/:communityId"
          element={
            <ProtectedRoute stage="home">
              <ClubDetailPage />
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
