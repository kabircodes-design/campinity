import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import CommunityCard from '../components/CommunityCard.jsx'
import SwipeablePage from '../components/SwipeablePage.jsx'
import Loader from '../auth/components/Loader.jsx'
import { getTrendingCommunities } from '../firebase/communityService.js'

/**
 * New — genuinely required for "Communities" to be a real bottom-nav
 * destination rather than a dead link. Reuses CommunityCard.jsx (the
 * same card HomePage's Clubs tab and SearchPage's Communities results
 * already use) and the same getTrendingCommunities fetch, rather than
 * duplicating either. Wrapped in SwipeablePage since this is one of
 * the five primary tabs now.
 */
export default function DiscoverCommunitiesPage() {
  const navigate = useNavigate()
  const [communities, setCommunities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getTrendingCommunities({ pageSize: 40 })
      .then((data) => {
        if (!cancelled) setCommunities(data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <SwipeablePage>
        <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
          <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm pb-24">
            <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
              <div className="h-14 flex items-center justify-between px-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Back"
                    onClick={() => navigate(-1)}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <span className="text-base font-bold tracking-tight text-gray-900">Communities</span>
                </div>
                <button
                  type="button"
                  aria-label="Create a community"
                  onClick={() => navigate('/community/create')}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-all duration-300"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </header>

            <main className="px-4 py-4">
              {loading ? (
                <div className="py-16 flex justify-center">
                  <Loader size="md" tone="dark" />
                </div>
              ) : communities.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm font-semibold text-gray-900">No communities yet.</p>
                  <p className="mt-1 text-sm text-gray-400">Be the first to create one.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {communities.map((community) => (
                    <CommunityCard key={community.id} community={community} />
                  ))}
                </div>
              )}
            </main>
          </div>
        </div>
      </SwipeablePage>

      <BottomNav />
    </>
  )
}
