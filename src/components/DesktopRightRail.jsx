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
        <div className="rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4">
          <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900 mb-3">
            <Users className="w-4 h-4 text-blue-500" /> Popular Communities
          </p>
          <div className="space-y-1.5">
            {topCommunities.map((community, i) => (
              <button
                key={community.id}
                type="button"
                onClick={() => navigate(`/community/${community.id}`)}
                className="w-full flex items-center gap-2.5 text-left group rounded-xl px-2 py-1.5 -mx-2 hover:bg-gray-50 transition-all duration-200"
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

      <div className="rounded-2xl p-4 text-white relative overflow-hidden" style={{ backgroundColor: '#1677ff' }}>
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
