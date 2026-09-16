import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, Star, UserMinus, UserPlus, X } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { addCloseFriend, getCloseFriendsList, getUserProfile, removeCloseFriend, searchUsersForShare } from '../firebase/profileService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { getAvatarColor, getInitials } from '../firebase/postService.js'

/**
 * Same page shape as BlockedUsersPage.jsx (list + per-row action +
 * toast), plus an add-flow that mirrors GroupInfoPage.jsx's own
 * search-and-add pattern (searchUsersForShare — already the shared
 * "find someone to add to X" search this app uses, not a new one).
 * Close Friends is purely a Story-visibility signal (storyService.js's
 * getFeedStories/createStory) — this page only manages the list.
 */
export default function CloseFriendsPage() {
  const navigate = useNavigate()
  const currentUid = auth.currentUser?.uid

  const [friendUids, setFriendUids] = useState([])
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyUid, setBusyUid] = useState(null)
  const [toast, setToast] = useState('')
  const [adding, setAdding] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])

  const load = () => {
    if (!currentUid) {
      setError('Not signed in.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    getCloseFriendsList(currentUid)
      .then(async (uids) => {
        setFriendUids(uids)
        const results = await Promise.all(uids.map((uid) => getUserProfile(uid).catch(() => null)))
        const map = {}
        uids.forEach((uid, i) => {
          if (results[i]) map[uid] = results[i]
        })
        setProfiles(map)
      })
      .catch((err) => setError(err?.message || 'Could not load your close friends.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [currentUid])

  const handleSearch = (value) => {
    setSearchTerm(value)
    if (!value.trim()) {
      setSearchResults([])
      return
    }
    searchUsersForShare(value, currentUid).then((results) =>
      setSearchResults(results.filter((r) => !friendUids.includes(r.uid)))
    )
  }

  const handleAdd = async (user) => {
    if (!currentUid) return
    setError('')
    try {
      await addCloseFriend(currentUid, user.uid)
      setSearchTerm('')
      setSearchResults([])
      setAdding(false)
      setFriendUids((prev) => [...prev, user.uid])
      setProfiles((prev) => ({ ...prev, [user.uid]: user }))
    } catch (err) {
      setToast(err?.message || 'Could not add this person.')
      window.setTimeout(() => setToast(''), 2500)
    }
  }

  const handleRemove = async (uid) => {
    if (!currentUid || busyUid) return
    setBusyUid(uid)
    const previous = friendUids
    setFriendUids((prev) => prev.filter((u) => u !== uid))
    try {
      await removeCloseFriend(currentUid, uid)
      setToast('Removed from Close Friends')
      window.setTimeout(() => setToast(''), 2000)
    } catch (err) {
      setFriendUids(previous)
      setToast(err?.message || 'Could not remove this person.')
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
            <span className="text-base font-bold tracking-tight text-gray-900">Close Friends</span>
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className="ml-auto flex items-center gap-1 text-xs font-semibold text-blue-600"
            >
              <UserPlus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </header>

        <p className="px-4 pt-3 text-xs text-gray-400 leading-relaxed">
          Only people on this list can see stories you mark as Close Friends only.
        </p>

        {adding && (
          <div className="mx-4 mt-3">
            <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3.5 py-2.5">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => handleSearch(event.target.value)}
                placeholder="Search people to add..."
                className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
              />
              <button type="button" onClick={() => setAdding(false)} aria-label="Close">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            {searchResults.map((user) => (
              <button
                key={user.uid}
                type="button"
                onClick={() => handleAdd(user)}
                className="w-full flex items-center gap-3 px-2 py-2 mt-1 rounded-xl hover:bg-gray-50"
              >
                <Avatar initials={getInitials(user.displayName)} colorClass={getAvatarColor(user.uid)} size="sm" src={getProfileIdentityImage(user) || undefined} />
                <span className="text-sm font-medium text-gray-800">{user.displayName}</span>
              </button>
            ))}
          </div>
        )}

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
          ) : friendUids.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500">
                <Star className="w-5 h-5" fill="currentColor" />
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-900">No close friends yet</p>
              <p className="mt-1 text-sm text-gray-400">Add people to share Close-Friends-only stories with them.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
              {friendUids.map((uid) => {
                const profile = profiles[uid]
                const displayName = profile?.displayName || 'Student'
                const isBusy = busyUid === uid
                return (
                  <div key={uid} className="flex items-center gap-3 px-3.5 py-3">
                    <Avatar
                      initials={getInitials(displayName)}
                      colorClass={getAvatarColor(uid)}
                      size="md"
                      src={profile ? getProfileIdentityImage(profile) || undefined : undefined}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                      {profile?.username && <p className="text-xs text-gray-400 truncate">@{profile.username}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(uid)}
                      disabled={isBusy}
                      aria-label="Remove from Close Friends"
                      className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition-all duration-200"
                    >
                      <UserMinus className="w-4 h-4" />
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
