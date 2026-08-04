import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import FollowUserCard from '../components/FollowUserCard.jsx'
import EmptyFollowState from '../components/EmptyFollowState.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { getUserProfileByUsername } from '../firebase/profileService.js'
import { useFollowList } from '../hooks/useFollowList.js'

/**
 * Route: /following/:username? — mirrors FollowersPage.jsx exactly,
 * same search + infinite-scroll addition on top of your pasted
 * structure, direction='following' instead of 'followers'.
 */
export default function FollowingPage() {
  const navigate = useNavigate()
  const { username } = useParams()

  const [targetUid, setTargetUid] = useState(username ? null : auth.currentUser?.uid)
  const [resolving, setResolving] = useState(Boolean(username))
  const [resolveError, setResolveError] = useState('')

  useEffect(() => {
    let cancelled = false

    if (!username) {
      setTargetUid(auth.currentUser?.uid || null)
      setResolving(false)
      return undefined
    }

    setResolving(true)
    setResolveError('')

    getUserProfileByUsername(username)
      .then((profile) => {
        if (cancelled) return
        if (!profile) {
          setResolveError('Student not found.')
        } else {
          setTargetUid(profile.uid)
        }
      })
      .catch(() => {
        if (!cancelled) setResolveError('Could not load this list.')
      })
      .finally(() => {
        if (!cancelled) setResolving(false)
      })

    return () => {
      cancelled = true
    }
  }, [username])

  const { users, loading, error, searchTerm, setSearchTerm, loadMore, hasMore, loadingMore } = useFollowList(
    targetUid,
    'following'
  )
  const isLoading = resolving || (Boolean(targetUid) && loading)
  const combinedError = resolveError || error

  const sentinelRef = useRef(null)
  useEffect(() => {
    if (!hasMore || isLoading) return undefined
    const el = sentinelRef.current
    if (!el) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore()
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, isLoading, loadMore])

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900">Following</span>
          </div>
          <div className="px-3 pb-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search following"
                className="w-full rounded-full border border-gray-200 bg-gray-50 pl-10 pr-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
              />
            </div>
          </div>
        </header>

        <main className="pb-24">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader size="lg" tone="dark" />
            </div>
          ) : combinedError ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-gray-400">{combinedError}</p>
            </div>
          ) : users.length === 0 ? (
            <EmptyFollowState message={searchTerm ? 'No matches found' : 'Not following anyone yet'} />
          ) : (
            <div>
              {users.map((user) => (
                <FollowUserCard key={user.uid} user={user} />
              ))}
              {hasMore && (
                <div ref={sentinelRef} className="py-4 flex justify-center">
                  {loadingMore && <Loader size="md" tone="dark" />}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <BottomNav />
    </div>
  )
}
