import { useState } from 'react'
import DiscoverCommunitiesPage from './DiscoverCommunitiesPage.jsx'

const tabs = [
  { label: 'Communities', key: 'communities' },
  { label: 'Clubs', key: 'clubs' }
]

/**
 * Top-level [Communities][Clubs] tab switcher — same tab-row visual
 * language as HomePage.jsx's own feed tabs (bg-blue-50/text-blue-600
 * active state, rounded pill buttons), not a copy-pasted duplicate of
 * that markup, just the same established pattern for a same-purpose
 * control. Both tabs render the exact same DiscoverCommunitiesPage
 * component — Clubs isn't a second parallel page, it's the same
 * community discovery experience filtered to type='official_club' (see
 * that file's own `clubsOnly` prop comment for why that's the correct,
 * non-duplicating way to do this: a club already IS a community of that
 * type in this schema).
 */
export default function CommunitiesHubPage() {
  const [activeTab, setActiveTab] = useState('communities')

  return (
    <div className="h-full flex flex-col">
      <nav className="sticky top-14 lg:top-0 z-30 bg-white dark:bg-[#11131a] grid grid-cols-2 gap-1 px-4 lg:px-6 py-1.5 border-b border-gray-100 dark:border-white/10 flex-shrink-0">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl py-2 text-[14px] font-semibold text-center transition-all duration-200 ${
                isActive
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400'
                  : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </nav>

      <div className="flex-1 min-h-0">
        {activeTab === 'clubs' ? <DiscoverCommunitiesPage clubsOnly /> : <DiscoverCommunitiesPage />}
      </div>
    </div>
  )
}
