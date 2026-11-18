import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import DiscoverCommunitiesPage from './DiscoverCommunitiesPage.jsx'

const tabs = [
  { label: 'Communities', key: 'communities' },
  { label: 'Clubs', key: 'clubs' }
]

/**
 * Communities tab: page header (same heading/subtitle/action pattern as
 * Messages), a [Communities][Clubs] segmented switch, then discovery.
 * Both segments render the same DiscoverCommunitiesPage — a club IS a
 * community of type 'official_club' in this schema (see that file's
 * `clubsOnly` comment), so there is one discovery implementation.
 */
export default function CommunitiesHubPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('communities')
  const clubs = activeTab === 'clubs'

  return (
    <div className="min-h-screen lg:min-h-0 lg:h-full flex flex-col">
      <header className="flex-shrink-0 mx-auto w-full max-w-[560px] lg:max-w-none px-4 lg:px-6 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">Communities</h1>
            <p className="mt-0.5 text-[13px] text-gray-500">
              {clubs ? 'Official clubs on your campus' : 'Find your people on campus'}
            </p>
          </div>
          <button
            type="button"
            aria-label={clubs ? 'Create club' : 'Create community'}
            onClick={() => navigate(clubs ? '/club/create' : '/community/create')}
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-blue-600 text-white shadow-sm shadow-blue-600/30 hover:bg-blue-700 active:scale-95 transition-all duration-200"
          >
            <Plus className="w-5 h-5" strokeWidth={2.4} />
          </button>
        </div>

        <div role="tablist" aria-label="Communities or clubs" className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-gray-100 p-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-xl py-2 text-[14px] font-semibold text-center transition-all duration-200 ${
                  isActive ? 'bg-white text-gray-900 shadow-[0_1px_3px_rgba(15,23,42,0.12)]' : 'text-gray-500'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </header>

      <div className="flex-1 min-h-0">
        {clubs ? <DiscoverCommunitiesPage key="clubs" clubsOnly /> : <DiscoverCommunitiesPage key="communities" />}
      </div>
    </div>
  )
}
