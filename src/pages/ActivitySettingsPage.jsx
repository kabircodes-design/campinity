import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bookmark } from 'lucide-react'
import Loader from '../auth/components/Loader.jsx'
import Avatar from '../components/Avatar.jsx'
import SettingsItem from '../components/SettingsItem.jsx'
import ContentPreferences from '../onboarding/ContentPreferences.jsx'
import { auth } from '../firebase/firebase.js'
import { getUserProfiles } from '../firebase/profileService.js'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { getMutedUsers, unmuteUser } from '../firebase/muteService.js'

/**
 * "Content & Activity" — Saved reuses the existing /saved route
 * (SavedLibraryPage.jsx, untouched). Content preferences is
 * ContentPreferences.jsx, relocated here from Settings' old home page
 * (it was never really an "appearance" control, and this is its real
 * home per the brief's own Part 9 spec). Muted content lists the real
 * per-member mutes (users/{uid}/mutedUsers) built alongside the
 * community moderation pass — not a fabricated "hidden content" list.
 */
export default function ActivitySettingsPage() {
  const navigate = useNavigate()
  const uid = auth.currentUser?.uid

  const [mutedUsers, setMutedUsers] = useState([])
  const [profiles, setProfiles] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [busyUid, setBusyUid] = useState(null)

  useEffect(() => {
    if (!uid) {
      setLoading(false)
      return
    }
    getMutedUsers(uid)
      .then(async (docs) => {
        setMutedUsers(docs)
        const profileMap = await getUserProfiles(docs.map((d) => d.mutedUid))
        setProfiles(profileMap)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [uid])

  const handleUnmute = async (targetUid) => {
    if (!uid || busyUid) return
    setBusyUid(targetUid)
    try {
      await unmuteUser(uid, targetUid)
      setMutedUsers((prev) => prev.filter((m) => m.mutedUid !== targetUid))
    } catch {
      // best-effort
    } finally {
      setBusyUid(null)
    }
  }

  return (
    <div className="h-full w-full max-w-[100vw] lg:overflow-y-auto lg:min-w-0 overflow-x-hidden bg-gray-50 dark:bg-[#09090f]">
      <div className="mx-auto max-w-[480px] lg:max-w-[640px] bg-white dark:bg-[#11131a] min-h-full lg:min-h-0 lg:my-4 lg:rounded-2xl lg:border lg:border-gray-100 dark:lg:border-white/10 lg:shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:lg:shadow-none">
        <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#11131a]/95 backdrop-blur-md border-b border-gray-100 dark:border-white/10 lg:rounded-t-2xl">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate('/settings')}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-50">Content & Activity</span>
          </div>
        </header>

        <main className="py-2 pb-10">
          <SettingsItem icon={Bookmark} label="Saved" description="Posts you've saved" onClick={() => navigate('/saved')} />

          <p className="px-4 pt-5 pb-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Content preferences</p>
          <ContentPreferences />

          <p className="px-4 pt-3 pb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Muted accounts</p>
          {loading ? (
            <div className="py-10 flex justify-center">
              <Loader size="md" tone="dark" />
            </div>
          ) : mutedUsers.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">You haven't muted anyone.</p>
          ) : (
            <div className="mx-4 rounded-2xl border border-gray-100 divide-y divide-gray-100 dark:border-white/10 dark:divide-white/10 overflow-hidden">
              {mutedUsers.map((m) => {
                const profile = profiles.get(m.mutedUid)
                const displayName = profile?.displayName || 'Student'
                return (
                  <div key={m.mutedUid} className="flex items-center gap-3 px-4 py-3.5">
                    <Avatar
                      initials={getInitials(displayName)}
                      colorClass={getAvatarColor(m.mutedUid)}
                      size="sm"
                      src={profile ? getProfileIdentityImage(profile) || undefined : undefined}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">{displayName}</p>
                      {profile?.username && <p className="text-xs text-gray-400 dark:text-gray-500">@{profile.username}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnmute(m.mutedUid)}
                      disabled={busyUid === m.mutedUid}
                      className="flex-shrink-0 rounded-full border border-gray-200 dark:border-white/15 text-gray-600 dark:text-gray-300 text-xs font-semibold px-3.5 py-1.5 hover:border-gray-300 dark:hover:border-white/25 disabled:opacity-50 transition-all duration-200"
                    >
                      {busyUid === m.mutedUid ? '…' : 'Unmute'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
