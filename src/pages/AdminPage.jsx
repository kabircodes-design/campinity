import { useState } from 'react'
import { AdminSessionProvider, useAdminSession } from '../admin/hooks/useAdminSession.jsx'
import AdminLockScreen from '../admin/components/AdminLockScreen.jsx'
import AdminSidebar from '../admin/components/AdminSidebar.jsx'
import AdminOverviewPage from '../admin/pages/AdminOverviewPage.jsx'
import AdminReportsPage from '../admin/pages/AdminReportsPage.jsx'
import AdminPhotoVerificationPage from '../admin/pages/AdminPhotoVerificationPage.jsx'
import AdminCollegeRequestsPage from '../admin/pages/AdminCollegeRequestsPage.jsx'
import AdminUserVerificationPage from '../admin/pages/AdminUserVerificationPage.jsx'
import AdminModerationPage from '../admin/pages/AdminModerationPage.jsx'
import AdminLostFoundPage from '../admin/pages/AdminLostFoundPage.jsx'
import AdminMarketplacePage from '../admin/pages/AdminMarketplacePage.jsx'
import AdminNotificationsPage from '../admin/pages/AdminNotificationsPage.jsx'
import AdminAuditLogPage from '../admin/pages/AdminAuditLogPage.jsx'

const SECTION_COMPONENTS = {
  overview: AdminOverviewPage,
  reports: AdminReportsPage,
  'photo-verification': AdminPhotoVerificationPage,
  'college-requests': AdminCollegeRequestsPage,
  'user-verification': AdminUserVerificationPage,
  moderation: AdminModerationPage,
  'lost-found': AdminLostFoundPage,
  marketplace: AdminMarketplacePage,
  notifications: AdminNotificationsPage,
  'audit-log': AdminAuditLogPage
}

function AdminDashboard() {
  const [activeSection, setActiveSection] = useState('overview')
  const ActiveSection = SECTION_COMPONENTS[activeSection] || AdminOverviewPage

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      <AdminSidebar activeSection={activeSection} onSelectSection={setActiveSection} />
      <main className="flex-1 min-w-0 px-6 py-6 lg:px-10 lg:py-8 max-w-[900px]">
        <ActiveSection />
      </main>
    </div>
  )
}

function AdminGate() {
  const { isLoggedIn } = useAdminSession()
  return isLoggedIn ? <AdminDashboard /> : <AdminLockScreen />
}

/**
 * Entry point for /admin. Reachable by ANY authenticated Campinity
 * user now — App.jsx's route uses stage="home", not stage="admin",
 * per the explicit architectural pivot away from platformAdmins as a
 * prerequisite. This component's password gate (AdminLockScreen) is
 * the actual boundary from here on, backed by the server-verified
 * session token every privileged admin action independently checks.
 */
export default function AdminPage() {
  return (
    <AdminSessionProvider>
      <AdminGate />
    </AdminSessionProvider>
  )
}
