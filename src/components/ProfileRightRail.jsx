import { useNavigate } from 'react-router-dom'
import { ChevronRight, Users } from 'lucide-react'

/**
 * Desktop-only right column for ProfilePage.jsx, matching the
 * reference image's About / Quick Stats / My Communities / Photos
 * panels. Purely presentational — every value comes from props ProfilePage
 * already fetched for its own header/tabs (profile, postsCount,
 * followers, following, communities, myPosts' images), so this adds
 * zero new Firestore reads of its own. Sections that have no real data
 * (no bio, no communities yet, no photos yet) render nothing rather
 * than an empty placeholder card — never fabricated to "fill space."
 */
export default function ProfileRightRail({ profile, postsCount, followers, following, communities, communitiesLoading, photos, isOwnProfile, onEditAbout }) {
  const navigate = useNavigate()

  const hasAbout = Boolean(profile?.bio || profile?.college || profile?.course || profile?.year)

  return (
    <aside className="hidden lg:flex lg:flex-col w-[300px] flex-shrink-0 gap-4 py-4">
      {hasAbout && (
        <section className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#11131a] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-50">About</p>
            {isOwnProfile && onEditAbout && (
              <button type="button" onClick={onEditAbout} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                Edit
              </button>
            )}
          </div>
          {profile.bio && <p className="mt-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">{profile.bio}</p>}
          <div className="mt-3 space-y-1.5">
            {profile.college && <p className="text-xs text-gray-400 dark:text-gray-500">{profile.college}</p>}
            {(profile.course || profile.year) && (
              <p className="text-xs text-gray-400 dark:text-gray-500">{[profile.course, profile.year].filter(Boolean).join(' · ')}</p>
            )}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#11131a] p-4">
        <p className="text-sm font-bold text-gray-900 dark:text-gray-50 mb-3">Quick Stats</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-base font-bold text-gray-900 dark:text-gray-50">{postsCount}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">Posts</p>
          </div>
          <div>
            <p className="text-base font-bold text-gray-900 dark:text-gray-50">{followers}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">Followers</p>
          </div>
          <div>
            <p className="text-base font-bold text-gray-900 dark:text-gray-50">{following}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">Following</p>
          </div>
        </div>
      </section>

      {!communitiesLoading && communities.length > 0 && (
        <section className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#11131a] p-4">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-50">My Communities</p>
            <button type="button" onClick={() => navigate('/communities')} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
              View all
            </button>
          </div>
          <div className="space-y-1">
            {communities.slice(0, 4).map((community) => (
              <button
                key={community.id}
                type="button"
                onClick={() => navigate(`/community/${community.id}`)}
                className="w-full flex items-center gap-2.5 rounded-xl px-2 py-2 -mx-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-all duration-200 text-left"
              >
                <div className="relative w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden bg-blue-600 flex items-center justify-center">
                  {community.coverImage && (
                    <img src={community.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  {community.icon ? (
                    <img
                      src={community.icon}
                      alt=""
                      className={community.coverImage ? 'relative w-5 h-5 rounded object-cover ring-2 ring-white/80' : 'w-full h-full object-cover'}
                    />
                  ) : (
                    !community.coverImage && <Users className="w-4 h-4 text-white" strokeWidth={1.7} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-50 truncate">{community.name}</p>
                  {typeof community.membersCount === 'number' && (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">{community.membersCount.toLocaleString()} members</p>
                  )}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}

      {photos.length > 0 && (
        <section className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#11131a] p-4">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-50">Photos</p>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{photos.length}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {photos.slice(0, 6).map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => navigate(`/post/${photo.id}`)}
                className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-white/10 hover:opacity-90 transition-opacity duration-200"
              >
                <img src={photo.imagePreviewUrl} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </section>
      )}

      {communities.length === 0 && !communitiesLoading && (
        <section className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#11131a] p-4 text-center">
          <Users className="w-5 h-5 text-gray-300 dark:text-gray-600 mx-auto" />
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">Not in any communities yet.</p>
          <button type="button" onClick={() => navigate('/communities')} className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700">
            Discover communities
          </button>
        </section>
      )}
    </aside>
  )
}
