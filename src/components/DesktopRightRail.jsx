import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Users } from 'lucide-react'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import Avatar from './Avatar.jsx'
import CampusPulse from './CampusPulse.jsx'
import LastMinutePreview from './LastMinutePreview.jsx'
import { useMyVerification } from '../access/useMyVerification.js'
import VerificationGate from '../access/VerificationGate.jsx'
import { FEATURES } from '../access/permissions.js'

/**
 * Desktop-only contextual rail (hidden below lg). Deliberately does
 * NOT include a "trending topics" widget — this app has no real
 * hashtag/trend system to source that from, and fabricating one would
 * violate the explicit "do not create fake data" instruction.
 *
 * Campus Pulse metrics and Last Minute — relocated here from the top
 * of Home per the explicit instruction to remove the dashboard feel
 * from the main feed's first viewport. Reuses the exact same
 * CampusPulse.jsx and LastMinutePreview.jsx components as-is (not
 * duplicated logic) — same real data, same zero-new-query guarantee,
 * just rendered here instead of above Stories. Both are mobile-only
 * on Home now removed entirely from mobile's top flow — this rail is
 * desktop-only, so mobile users lose this particular presentation
 * this pass rather than force it into a first-viewport space the
 * brief explicitly wants kept clean.
 */
export default function DesktopRightRail({ communities = [], posts = [], notesCount = null, notesForPreview = [], onViewNotes }) {
  const navigate = useNavigate()
  const verified = useMyVerification()
  const [gateOpen, setGateOpen] = useState(false)
  const topCommunities = communities.slice(0, 4)

  return (
    <aside className="hidden lg:flex lg:flex-col w-72 flex-shrink-0 h-screen sticky top-0 overflow-y-auto px-4 py-5 gap-4">
      <CampusPulse posts={posts} communities={communities} notesCount={notesCount} />

      <LastMinutePreview notes={notesForPreview} onViewAll={onViewNotes} />

      {topCommunities.length > 0 ? (
        <div className="rounded-2xl border border-white/50 bg-white/60 backdrop-blur-md shadow-[0_4px_16px_rgba(91,77,255,0.05)] p-4">
          <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900 mb-3">
            <Users className="w-4 h-4 text-blue-500" /> Popular Communities
          </p>
          <div className="space-y-1.5">
            {topCommunities.map((community, i) => (
              <button
                key={community.id}
                type="button"
                onClick={() => navigate(`/community/${community.id}`)}
                className="w-full flex items-center gap-2.5 text-left group rounded-xl px-2 py-1.5 -mx-2 bg-white/0 hover:bg-white/50 transition-all duration-200"
              >
                <span className="text-[11px] font-bold text-gray-300 w-3 flex-shrink-0">{i + 1}</span>
                <Avatar
                  initials={getInitials(community.name)}
                  colorClass={getAvatarColor(community.id)}
                  size="sm"
                  src={community.icon || undefined}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors duration-200">
                    {community.name}
                  </p>
                  <p className="text-xs text-gray-400">{community.membersCount} members</p>
                </div>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigate('/communities')}
            className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Explore all →
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 p-4 text-center">
          <p className="text-xs text-gray-400">No communities yet.</p>
          <p className="text-xs text-gray-400">Campus conversations will appear here.</p>
        </div>
      )}

      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-4 text-white relative overflow-hidden">
        <div className="absolute -bottom-8 -right-8 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none" />
        <p className="relative flex items-center gap-1.5 text-sm font-bold">
          <Sparkles className="w-4 h-4" /> Build your community
        </p>
        <p className="relative mt-1.5 text-xs text-blue-100 leading-relaxed">
          Have a club, project or campus idea? Bring people together.
        </p>
        <button
          type="button"
          onClick={() => (verified === false ? setGateOpen(true) : navigate('/community/create'))}
          className="relative mt-3 w-full rounded-full bg-white text-blue-700 text-xs font-semibold py-2.5 hover:bg-blue-50 active:scale-[0.98] transition-all duration-200"
        >
          Create Community
        </button>
      </div>
      <VerificationGate open={gateOpen} onClose={() => setGateOpen(false)} feature={FEATURES.CREATE_COMMUNITY} />
    </aside>
  )
}
