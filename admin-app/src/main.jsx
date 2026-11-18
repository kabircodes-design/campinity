import React from 'react'
import ReactDOM from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import '../../src/index.css'
import '../../src/theme/theme-tokens.css'
import { ThemeProvider } from '../../src/theme/ThemeProvider.jsx'
import AdminAppRoot from './AdminAppRoot.jsx'

/**
 * CAMPINITY ADMIN — separate app entry. Only the Admin Control Center and
 * its own sign-in are bundled here; none of the public student app
 * (feed, chat, communities, marketplace, radar, calls…) is imported.
 * MemoryRouter: the admin UI has no URL routes of its own; it only needs
 * a router context for a couple of shared components.
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <MemoryRouter>
        <AdminAppRoot />
      </MemoryRouter>
    </ThemeProvider>
  </React.StrictMode>
)
