import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BellOff, Compass } from 'lucide-react'
import Loader from '../auth/components/Loader.jsx'
import SettingsItem from '../components/SettingsItem.jsx'
import { auth } from '../firebase/firebase.js'
import { getCommunityById, getMutedCommunityMemberships, setCommunityMuted } from '../firebase/communityService.js'

/**
 * Community-specific notifications/mute already live inside each
 * community's own "•••" menu (Mute Community, per-member mute) —
 * intentionally NOT duplicated as a second, separate global toggle
 * system here. This page instead does the one thing that's genuinely
 * useful at the account level: a real list of every community you've
 * muted (queried from the same communityMembers.muted field that
 * control writes), with a one-tap Unmute — you'd otherwise have no way
 * to find and undo a mute without remembering which specific community
 * you muted it from.
 */
export default function CommunitiesSettingsPage() {
  const navigate = useNavigate()
  const uid = auth.currentUser?.uid

  const [muted, setMuted] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const load = () => {
    if (!uid) {
      setLoading(false)
      return
    }
    setLoading(true)
    getMutedCommunityMemberships(uid)
      .then((memberships) => Promise.all(memberships.map((m) => getCommunityById(m.communityId).catch(() => null))))
      .then((communities) => setMuted(communities.filter(Boolean)))
      .catch(() => setMuted([]))
      .finally(() => setLoading(false))
  }

  useEffect(load, [uid])

  const handleUnmute = async (communityId) => {
    if (!uid || busyId) return
    setBusyId(communityId)
    try {
      await setCommunityMuted(communityId, uid, false)
      setMuted((prev) => prev.filter((c) => c.id !== communityId))
    } catch {
      // best-effort — row simply stays put on failure
    } finally {
      setBusyId(null)
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
            <span className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-50">Communities</span>
          </div>
        </header>

        <main className="py-2 pb-10">
          <SettingsItem
            icon={Compass}
            label="Browse communities"
            description="Discover and join campus communities"
            onClick={() => navigate('/communities')}
          />

          <p className="px-4 pt-5 pb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Muted communities</p>
          <p className="px-4 pb-2 text-xs text-gray-400 dark:text-gray-500">
            Mute or unmute a community any time from its own ••• menu — muted ones you can undo from here too.
          </p>

          {loading ? (
            <div className="py-10 flex justify-center">
              <Loader size="md" tone="dark" />
            </div>
          ) : muted.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">No muted communities.</p>
          ) : (
            <div className="mx-4 rounded-2xl border border-gray-100 divide-y divide-gray-100 dark:border-white/10 dark:divide-white/10 overflow-hidden">
              {muted.map((community) => (
                <div key={community.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-400 flex items-center justify-center flex-shrink-0">
                    <BellOff className="w-[18px] h-[18px]" strokeWidth={1.8} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">{community.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">@{community.handle}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnmute(community.id)}
                    disabled={busyId === community.id}
                    className="flex-shrink-0 rounded-full border border-gray-200 dark:border-white/15 text-gray-600 dark:text-gray-300 text-xs font-semibold px-3.5 py-1.5 hover:border-gray-300 dark:hover:border-white/25 disabled:opacity-50 transition-all duration-200"
                  >
                    {busyId === community.id ? '…' : 'Unmute'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
