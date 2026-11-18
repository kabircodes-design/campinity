import { AdminSessionProvider, useAdminSession } from '../admin/hooks/useAdminSession.jsx'
import { AdminWorkspaceProvider, useAdminWorkspace } from '../admin/hooks/useAdminWorkspace.jsx'
import AdminLockScreen from '../admin/components/AdminLockScreen.jsx'
import AdminShell from '../admin/components/AdminShell.jsx'
import AdminOverviewPage from '../admin/pages/AdminOverviewPage.jsx'
import AdminUsersPage from '../admin/pages/AdminUsersPage.jsx'
import AdminReportsPage from '../admin/pages/AdminReportsPage.jsx'
import AdminPhotoVerificationPage from '../admin/pages/AdminPhotoVerificationPage.jsx'
import AdminAchievementVerificationPage from '../admin/pages/AdminAchievementVerificationPage.jsx'
import AdminCollegeRequestsPage from '../admin/pages/AdminCollegeRequestsPage.jsx'
import AdminCommunitiesPage from '../admin/pages/AdminCommunitiesPage.jsx'
import AdminModerationPage from '../admin/pages/AdminModerationPage.jsx'
import AdminLostFoundPage from '../admin/pages/AdminLostFoundPage.jsx'
import AdminMarketplacePage from '../admin/pages/AdminMarketplacePage.jsx'
import AdminNotificationsPage from '../admin/pages/AdminNotificationsPage.jsx'
import AdminAuditLogPage from '../admin/pages/AdminAuditLogPage.jsx'
import AdminSystemHealthPage from '../admin/pages/AdminSystemHealthPage.jsx'
import AdminDevicesPage from '../admin/pages/AdminDevicesPage.jsx'
import AdminNoticesPage from '../admin/pages/AdminNoticesPage.jsx'

/**
 * Sections are in-memory state (useAdminWorkspace), not router
 * sub-routes: the whole Control Center only exists behind the in-memory
 * admin session, and a refresh intentionally re-locks it.
 *
 * 'user-verification' is kept as an alias of Users: the Users workspace
 * now covers search + manual verify/unverify (same adminSetUserVerification
 * callable) with suspension and history alongside it.
 */
const SECTION_COMPONENTS = {
  overview: AdminOverviewPage,
  users: AdminUsersPage,
  'user-verification': AdminUsersPage,
  reports: AdminReportsPage,
  'photo-verification': AdminPhotoVerificationPage,
  'achievement-verification': AdminAchievementVerificationPage,
  'college-requests': AdminCollegeRequestsPage,
  communities: AdminCommunitiesPage,
  moderation: AdminModerationPage,
  'lost-found': AdminLostFoundPage,
  marketplace: AdminMarketplacePage,
  notifications: AdminNotificationsPage,
  'audit-log': AdminAuditLogPage,
  'system-health': AdminSystemHealthPage,
  devices: AdminDevicesPage,
  notices: AdminNoticesPage
}

function AdminDashboard() {
  const { section, navigate } = useAdminWorkspace()
  const ActiveSection = SECTION_COMPONENTS[section] || AdminOverviewPage
  return (
    <AdminShell>
      {/* key: switching sections remounts the page so each one loads fresh. */}
      <ActiveSection key={section} onNavigateSection={navigate} />
    </AdminShell>
  )
}

function AdminGate({ onSignOut, accountLabel }) {
  const { isLoggedIn } = useAdminSession()
  return isLoggedIn ? (
    <AdminWorkspaceProvider>
      <AdminDashboard />
    </AdminWorkspaceProvider>
  ) : (
    <AdminLockScreen onSignOut={onSignOut} accountLabel={accountLabel} />
  )
}

/**
 * Entry point for /admin. The password gate (AdminLockScreen) is the
 * boundary; every privileged call is independently re-authorized on the
 * server via the session token (requireValidAdminSession).
 */
export default function AdminPage({ onSignOut, accountLabel } = {}) {
  return (
    <AdminSessionProvider>
      <AdminGate onSignOut={onSignOut} accountLabel={accountLabel} />
    </AdminSessionProvider>
  )
}
