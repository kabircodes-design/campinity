import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAdminSession } from './useAdminSession.jsx'
import { callAdmin } from '../services/adminCallable.js'
import { getAdminCapabilities } from '../services/adminAuthService.js'

/**
 * Admin Control Center workspace state shared by the shell and pages:
 *  - which section is open (+ optional params, e.g. a pre-filled user
 *    search from the top bar or a user to open from an alert),
 *  - the dashboard snapshot (adminGetDashboard), loaded ONCE per unlock
 *    and refreshed on demand — so the top-bar alerts and the Overview
 *    page share one read instead of each issuing their own. No polling,
 *    no listeners: the dashboard is ~130 count aggregations, so it is
 *    only re-run when an admin asks for it.
 */
const AdminWorkspaceContext = createContext(null)

export function AdminWorkspaceProvider({ children, initialSection = 'overview' }) {
  const { sessionToken } = useAdminSession()
  const [section, setSection] = useState(initialSection)
  const [params, setParams] = useState({})
  const [dashboard, setDashboard] = useState(null)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState('')
  const requestRef = useRef(0)
  // Re-checked on every unlock/resume (a stored session skips the lock screen).
  const [capabilities, setCapabilities] = useState(undefined) // undefined = checking, null = outdated/unreachable
  useEffect(() => {
    getAdminCapabilities().then(setCapabilities).catch(() => setCapabilities(null))
  }, [])

  const reloadDashboard = useCallback(() => {
    if (!sessionToken) return
    const id = ++requestRef.current
    setDashboardLoading(true)
    setDashboardError('')
    callAdmin('adminGetDashboard', { sessionToken })
      .then((data) => {
        if (requestRef.current === id) setDashboard(data || null)
      })
      .catch((err) => {
        if (requestRef.current === id) setDashboardError(err?.message || 'Could not load the dashboard.')
      })
      .finally(() => {
        if (requestRef.current === id) setDashboardLoading(false)
      })
  }, [sessionToken])

  useEffect(() => {
    reloadDashboard()
  }, [reloadDashboard])

  const navigate = useCallback((next, nextParams = {}) => {
    setSection(next)
    setParams(nextParams)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }, [])

  const value = useMemo(
    () => ({ section, params, navigate, dashboard, dashboardLoading, dashboardError, reloadDashboard, capabilities }),
    [section, params, navigate, dashboard, dashboardLoading, dashboardError, reloadDashboard, capabilities]
  )
  return <AdminWorkspaceContext.Provider value={value}>{children}</AdminWorkspaceContext.Provider>
}

export function useAdminWorkspace() {
  const ctx = useContext(AdminWorkspaceContext)
  if (!ctx) throw new Error('useAdminWorkspace must be used within an AdminWorkspaceProvider')
  return ctx
}
