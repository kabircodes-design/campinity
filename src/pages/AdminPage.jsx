import { useState } from 'react'
import { AdminSessionProvider, useAdminSession } from '../admin/hooks/useAdminSession.jsx'
import AdminLockScreen from '../admin/components/AdminLockScreen.jsx'
import AdminSidebar from '../admin/components/AdminSidebar.jsx'
import AdminOverviewPage from '../admin/pages/AdminOverviewPage.jsx'
import AdminReportsPage from '../admin/pages/AdminReportsPage.jsx'
import AdminComingSoon from '../admin/components/AdminComingSoon.jsx'

const SECTION_TITLES = {
  'photo-verification': 'Photo Verification',
  'college-requests': 'College Requests',
  'user-verification': 'User Verification',
  moderation: 'Moderation',
  'lost-found': 'Lost & Found',
  marketplace: 'Marketplace',
  notifications: 'Notifications',
  'audit-log': 'Audit Log'
}

function AdminDashboard() {
  const [activeSection, setActiveSection] = useState('overview')

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      <AdminSidebar activeSection={activeSection} onSelectSection={setActiveSection} />
      <main className="flex-1 min-w-0 px-6 py-6 lg:px-10 lg:py-8 max-w-[900px]">
        {activeSection === 'overview' && <AdminOverviewPage />}
        {activeSection === 'reports' && <AdminReportsPage />}
        {SECTION_TITLES[activeSection] && <AdminComingSoon title={SECTION_TITLES[activeSection]} />}
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
