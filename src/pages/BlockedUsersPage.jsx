import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, UserX } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { getBlockedUsers, unblockUser } from '../firebase/blockService.js'
import { getUserProfile } from '../firebase/profileService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { getAvatarColor, getInitials } from '../firebase/postService.js'

/**
 * The real Blocked Users page — App.jsx's /settings/blocked-users route
 * previously rendered <ComingSoon>, so this never existed at all.
 * Reuses blockService.js exactly as it already stands (getBlockedUsers/
 * unblockUser, the same functions ProfileHeader.jsx's block toggle
 * already calls) — no second blocking system, no new Firestore
 * collection. getBlockedUsers only returns { blockedUid, createdAt }
 * per doc, so each entry's display name/avatar is resolved via a
 * real getUserProfile call, same as every other list page in this app.
 */
export default function BlockedUsersPage() {
  const navigate = useNavigate()
  const currentUid = auth.currentUser?.uid

  const [blocked, setBlocked] = useState([])
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyUid, setBusyUid] = useState(null)
  const [toast, setToast] = useState('')

  const load = () => {
    if (!currentUid) {
      setError('Not signed in.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    getBlockedUsers(currentUid)
      .then(async (entries) => {
        setBlocked(entries)
        const results = await Promise.all(
          entries.map((entry) => getUserProfile(entry.blockedUid).catch(() => null))
        )
        const map = {}
        entries.forEach((entry, i) => {
          if (results[i]) map[entry.blockedUid] = results[i]
        })
        setProfiles(map)
      })
      .catch((err) => setError(err?.message || 'Could not load blocked users.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [currentUid])

  const handleUnblock = async (uid) => {
    if (!currentUid || busyUid) return
    setBusyUid(uid)
    const previous = blocked
    setBlocked((prev) => prev.filter((entry) => entry.blockedUid !== uid))
    try {
      await unblockUser(currentUid, uid)
      setToast('User unblocked')
      window.setTimeout(() => setToast(''), 2000)
    } catch (err) {
      setBlocked(previous)
      setToast(err?.message || "Couldn't unblock this user.")
      window.setTimeout(() => setToast(''), 2500)
    } finally {
      setBusyUid(null)
    }
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[640px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate('/settings')}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900">Blocked Users</span>
          </div>
        </header>

        <main className="px-4 py-4">
          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader size="md" tone="dark" />
            </div>
          ) : error ? (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-400">{error}</p>
              <button type="button" onClick={load} className="mt-3 text-xs font-semibold text-blue-600">
                Retry
              </button>
            </div>
          ) : blocked.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400">
                <UserX className="w-5 h-5" />
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-900">No blocked users</p>
              <p className="mt-1 text-sm text-gray-400">People you block will show up here.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
              {blocked.map((entry) => {
                const profile = profiles[entry.blockedUid]
                const displayName = profile?.displayName || 'Student'
                const isBusy = busyUid === entry.blockedUid
                return (
                  <div key={entry.blockedUid} className="flex items-center gap-3 px-3.5 py-3">
                    <Avatar
                      initials={getInitials(displayName)}
                      colorClass={getAvatarColor(entry.blockedUid)}
                      size="md"
                      src={profile ? getProfileIdentityImage(profile) || undefined : undefined}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                      {profile?.username && <p className="text-xs text-gray-400 truncate">@{profile.username}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnblock(entry.blockedUid)}
                      disabled={isBusy}
                      className="flex-shrink-0 rounded-full border border-gray-200 text-gray-700 text-xs font-semibold px-4 py-2 hover:border-red-200 hover:text-red-500 disabled:opacity-50 transition-all duration-200"
                    >
                      {isBusy ? '...' : 'Unblock'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] rounded-full bg-gray-900 text-white text-xs font-semibold px-4 py-2.5 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
