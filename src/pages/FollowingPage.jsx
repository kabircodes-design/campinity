import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import FollowUserCard from '../components/FollowUserCard.jsx'
import EmptyFollowState from '../components/EmptyFollowState.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { getUserProfileByUsername } from '../firebase/profileService.js'
import { useFollowList } from '../hooks/useFollowList.js'

/**
 * Route: /following/:username? — an optional username segment. Present
 * when viewing someone else's following list (linked from their
 * profile); absent when viewing your own (falls back to the signed-in
 * user).
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

  const { users, loading, error } = useFollowList(targetUid, 'following')
  const isLoading = resolving || (Boolean(targetUid) && loading)
  const combinedError = resolveError || error

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
            <EmptyFollowState message="Not following anyone yet" />
          ) : (
            <div>
              {users.map((user) => (
                <FollowUserCard key={user.uid} user={user} />
              ))}
            </div>
          )}
        </main>
      </div>

      <BottomNav />
    </div>
  )
}