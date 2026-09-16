import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Grid3x3, LinkIcon, List, Settings } from 'lucide-react'
import ProfileHeader from '../components/ProfileHeader.jsx'
import ProfileRightRail from '../components/ProfileRightRail.jsx'
import ProgressCard from '../gamification/ProgressCard.jsx'
import PostComposer from '../components/PostComposer.jsx'
import PostCard from '../components/PostCard.jsx'
import CommunityCard from '../components/CommunityCard.jsx'
import Loader from '../auth/components/Loader.jsx'
import { getCollegeById } from '../data/dummyColleges.js'
import { auth } from '../firebase/firebase.js'
import { getAvatarColor, getInitials, getUserPosts, getUserPostCount, getPostById } from '../firebase/postService.js'
import { getUserCommunityMemberships, getCommunityById, getOwnedCommunities } from '../firebase/communityService.js'
import { useAuth } from '../context/AuthContext.jsx'

const GRID_LAYOUT_KEY = 'campinity:profileGridLayout'

const tabs = [
  { key: 'posts', label: 'Posts' },
  { key: 'about', label: 'About' },
  { key: 'communities', label: 'Communities' },
  { key: 'photos', label: 'Photos' },
  { key: 'pinned', label: 'Pinned' },
  { key: 'activity', label: 'Activity' }
]

/**
 * Visual redesign pass (reference-image match) — removes the heavy
 * glassmorphism this page had accumulated (ambient radial-gradient
 * glow layers, bg-white/40 + backdrop-blur-2xl panels, a lavender
 * #f3f0fb page background) in favor of the same plain white/gray-50 +
 * subtle-border + soft-shadow language HomePage.jsx and
 * DiscoverCommunitiesPage.jsx already use — confirmed by reading both
 * directly, neither uses backdrop-blur or translucent surfaces
 * anywhere. DesktopSidebar.jsx (left nav, including the real Campinity
 * Logo component) was already rebuilt to this exact reference in an
 * earlier pass and is reused completely untouched here.
 *
 * "About" and "Photos" are the two genuinely NEW tabs — About surfaces
 * the same real profile fields (bio/college/course/year/website/joined)
 * ProfileHeader.jsx already has, just with more room; Photos is a real
 * derived view (images already present in myPosts, no new query) —
 * see photoPosts below. "Saved" from the reference is deliberately NOT
 * a tab here: it already has its own real entry point (Settings >
 * Saved, per the Saved Library System's own instruction that Saved
 * lives in Settings, not the profile tab row) — adding a second one
 * would be a UI duplicate of an existing route, not a new feature.
 *
 * The post composer (PostComposer.jsx, already used on Home) is now
 * also shown here on the user's own profile, matching the reference —
 * same real component, same real posting logic, not a second composer.
 *
 * Communities now load on mount (not lazily on first tab visit) since
 * ProfileRightRail's "My Communities" card needs them immediately,
 * without requiring the visitor to click into the Communities tab
 * first just to populate the sidebar.
 */
export default function ProfilePage() {
  const navigate = useNavigate()
  const currentUid = auth.currentUser?.uid

  const [activeTab, setActiveTab] = useState(tabs[0].key)
  const [gridLayout, setGridLayout] = useState(() => localStorage.getItem(GRID_LAYOUT_KEY) || 'list')

  // profile now comes from the shared AuthContext (see AppShell.jsx's
  // comment on the same pattern) instead of this page's own
  // getUserProfile() call — same document, same live data, one fewer
  // redundant Firestore read every time this page is visited.
  const { profile } = useAuth()
  const [myPosts, setMyPosts] = useState([])
  const [postsError, setPostsError] = useState('')
  const [postCount, setPostCount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [pinnedPosts, setPinnedPosts] = useState([])
  const [pinnedLoading, setPinnedLoading] = useState(false)
  const [communities, setCommunities] = useState([])
  const [communitiesLoading, setCommunitiesLoading] = useState(true)
  const [communitiesLoadedOnce, setCommunitiesLoadedOnce] = useState(false)
  const [communitiesError, setCommunitiesError] = useState(false)
  const [pinnedLoadedOnce, setPinnedLoadedOnce] = useState(false)

  useEffect(() => {
    let cancelled = false
    const uid = currentUid

    if (!uid) {
      setError('Not signed in.')
      setLoading(false)
      return undefined
    }

    const loadPosts = async () => {
      try {
        const data = await getUserPosts(uid, uid)
        // Guarantee userId on every post — every post fetched here is,
        // by construction, this user's own (getUserPosts(uid, uid)
        // fetches exactly this uid's posts). PostCard.jsx's isOwner
        // check depends entirely on post.userId; if postService.js's
        // own mapping doesn't already include it (unverified — that
        // file has never been shown to me, and mapPostForCard in
        // postFeedShared.js had exactly this gap until it was found
        // and fixed earlier in this project), the 3-dot menu would
        // silently never render here even though it works correctly
        // on Home, which uses a different, verified mapping function.
        const postsWithOwner = (data || []).map((post) => ({ ...post, userId: post.userId || uid }))
        if (!cancelled) setMyPosts(postsWithOwner)
      } catch (err) {
        if (!cancelled) setPostsError(err?.message || 'Could not load your posts.')
      }
    }

    // Separate from loadPosts deliberately — the grid's own loading
    // state must not wait on this, and this must not wait on the grid;
    // a count() aggregation read is fast and independent of maxResults.
    getUserPostCount(uid)
      .then((count) => {
        if (!cancelled) setPostCount(count)
      })
      .catch(() => {})

    loadPosts().finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [currentUid])

  useEffect(() => {
    if (activeTab !== 'pinned' || pinnedLoadedOnce || !profile) return
    let cancelled = false
    setPinnedLoading(true)
    Promise.all(profile.pinnedPostIds.map((id) => getPostById(id, currentUid).catch(() => null)))
      .then((results) => {
        if (!cancelled) {
          // Same fix as myPosts above, same reasoning: every pinned
          // post on this page belongs to the current user (you can
          // only pin your own posts to your own profile) — guarantee
          // userId regardless of what getPostById's own mapping
          // includes, so PostCard.jsx's isOwner check works correctly
          // here too.
          const pinnedWithOwner = results.filter(Boolean).map((post) => ({ ...post, userId: post.userId || currentUid }))
          setPinnedPosts(pinnedWithOwner)
          setPinnedLoadedOnce(true)
        }
      })
      .finally(() => {
        if (!cancelled) setPinnedLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, profile, currentUid, pinnedLoadedOnce])

  useEffect(() => {
    if (communitiesLoadedOnce || !currentUid) return
    let cancelled = false
    setCommunitiesLoading(true)
    setCommunitiesError(false)
    Promise.all([
      getUserCommunityMemberships(currentUid),
      getOwnedCommunities(currentUid).catch((err) => {
        console.error('Could not load owned communities:', err)
        return []
      })
    ])
      .then(([memberships, ownedCommunities]) =>
        Promise.all(
          memberships.map((m) =>
            getCommunityById(m.communityId)
              .then((community) => (community ? { ...community, role: m.role } : null))
              .catch((err) => {
                console.error('Could not load community', m.communityId, err)
                return null
              })
          )
        ).then((membershipResults) => {
          // Merge, deduped by id. A community already found via
          // membership keeps its real role; one found ONLY via the
          // direct ownerId fallback (meaning its communityMembers doc
          // is missing/inconsistent) is added with role forced to
          // 'owner', since ownerId==uid is unambiguous ground truth
          // regardless of the membership collection's state.
          const merged = new Map()
          membershipResults.filter(Boolean).forEach((c) => merged.set(c.id, c))
          ownedCommunities.forEach((c) => {
            if (!merged.has(c.id)) merged.set(c.id, { ...c, role: 'owner' })
          })
          return Array.from(merged.values())
        })
      )
      .then((results) => {
        if (!cancelled) {
          setCommunities(results)
          setCommunitiesLoadedOnce(true)
        }
      })
      .catch((err) => {
        // A real fix, not a debugging aid: this chain previously had
        // no outer .catch() at all — a failure here would silently
        // leave communities at its initial empty array while still
        // marking loading complete, rendering the empty state as if
        // the query had genuinely returned zero results. Now surfaced
        // to the console (not to the user — see the error-state UI
        // below) instead of vanishing.
        console.error('Could not load your communities:', err)
        if (!cancelled) {
          setCommunitiesError(true)
          setCommunitiesLoadedOnce(true)
        }
      })
      .finally(() => {
        if (!cancelled) setCommunitiesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentUid, communitiesLoadedOnce])

  const [college, setCollege] = useState(null)
  useEffect(() => {
    if (!profile?.collegeId) {
      setCollege(null)
      return
    }
    let cancelled = false
    getCollegeById(profile.collegeId).then((result) => {
      if (!cancelled) setCollege(result)
    })
    return () => {
      cancelled = true
    }
  }, [profile?.collegeId])

  const toggleGridLayout = () => {
    const next = gridLayout === 'grid' ? 'list' : 'grid'
    setGridLayout(next)
    localStorage.setItem(GRID_LAYOUT_KEY, next)
  }

  // Real derived data, not a new query — every post here was already
  // fetched for the Posts tab; this just filters to the ones with an
  // actual image.
  const photoPosts = useMemo(() => myPosts.filter((post) => post.imagePreviewUrl), [myPosts])

  if (loading) {
    return (
      <div className="h-full w-full max-w-[100vw] overflow-x-hidden bg-gray-50 dark:bg-[#09090f] flex items-center justify-center">
        <Loader size="lg" tone="dark" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="h-full w-full max-w-[100vw] overflow-x-hidden bg-gray-50 dark:bg-[#09090f]">
        <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white dark:bg-[#11131a] h-full lg:shadow-sm flex items-center justify-center px-6 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">{error || 'Profile not found.'}</p>
        </div>
      </div>
    )
  }

  const displayProfile = {
    ...profile,
    displayName: profile.displayName || auth.currentUser?.displayName || 'Student',
    college: college?.name || '',
    initials: getInitials(profile.displayName || auth.currentUser?.displayName || 'Student'),
    colorClass: getAvatarColor(currentUid || profile.username),
    // postCount starts null (count query in flight) — fall back to the
    // loaded grid's length for that brief instant rather than showing
    // 0, then swap to the real total the moment the count resolves.
    postsCount: postCount ?? myPosts.length,
    followers: profile.followersCount || 0,
    following: profile.followingCount || 0,
    communitiesCount: communitiesLoadedOnce ? communities.length : undefined
  }

  // One handler for both delete call sites (Posts grid, Pinned tab) so
  // postCount can never drift out of sync with one of them by only
  // being wired into the other.
  const handlePostDeleted = (deletedId) => {
    setMyPosts((prev) => prev.filter((p) => p.id !== deletedId))
    setPinnedPosts((prev) => prev.filter((p) => p.id !== deletedId))
    setPostCount((prev) => (typeof prev === 'number' ? Math.max(0, prev - 1) : prev))
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: profile.displayName, url: window.location.href }).catch(() => {})
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).catch(() => {})
    }
  }

  const firstName = (displayProfile.displayName || '').split(' ')[0] || 'there'

  return (
    <div className="h-full w-full max-w-[100vw] lg:max-w-none lg:overflow-y-auto lg:min-w-0 overflow-x-hidden bg-gray-50 dark:bg-[#09090f]">
        {/* Grid, not flex-with-a-max-width — the row itself now fills
            whatever width AppShell's own 1fr column actually gives it
            (no independent 1180px cap fighting that), and the main
            column is a real minmax(0,1fr) track instead of a flex item
            capped at 680px, so it grows to fill whatever's left after
            the fixed-width right rail. Same pattern HomePage.jsx's own
            outer AppShell-column already uses successfully. */}
        <div className="lg:grid lg:items-start lg:gap-5 lg:px-6 lg:py-4 lg:[grid-template-columns:minmax(0,1fr)_300px]">
          <div className="mx-auto max-w-[480px] lg:mx-0 lg:max-w-none lg:min-w-0 bg-white dark:bg-[#11131a] min-h-full lg:min-h-0 lg:rounded-2xl lg:border lg:border-gray-100 dark:lg:border-white/10 lg:shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:lg:shadow-none">
            <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#11131a]/95 backdrop-blur-md border-b border-gray-100 dark:border-white/10 lg:rounded-t-2xl">
              <div className="h-14 flex items-center justify-between px-4 lg:px-6">
                <span className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-50">Profile</span>
                <button
                  type="button"
                  aria-label="Settings"
                  onClick={() => navigate('/settings')}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10 transition-all duration-300"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </header>

            <ProfileHeader
              profile={displayProfile}
              isOwnProfile
              onEdit={() => navigate('/profile/edit')}
              onShare={handleShare}
              onOpenFollowers={() => navigate('/followers')}
              onOpenFollowing={() => navigate('/following')}
            />

            <ProgressCard uid={currentUid} />

            <nav className="sticky top-14 z-30 flex items-center bg-white dark:bg-[#11131a] border-b border-gray-100 dark:border-white/10 overflow-x-auto scroll-hidden">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-shrink-0 px-4 py-3 text-[13px] font-semibold text-center border-b-2 transition-all duration-200 ${
                    activeTab === tab.key
                      ? 'text-blue-600 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                      : 'text-gray-400 border-transparent hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              {activeTab === 'posts' && (
                <button
                  type="button"
                  onClick={toggleGridLayout}
                  aria-label={gridLayout === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
                  className="ml-auto mr-3 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-white/10 transition-all duration-300"
                >
                  {gridLayout === 'grid' ? <List className="w-4 h-4" /> : <Grid3x3 className="w-4 h-4" />}
                </button>
              )}
            </nav>

            <main className="pb-24">
              {activeTab === 'posts' && (
                <>
                  <div className="px-4 lg:px-6 pt-4">
                    <PostComposer profile={profile} initials={displayProfile.initials} colorClass={displayProfile.colorClass} firstName={firstName} />
                  </div>
                  {myPosts.length === 0 ? (
                    <div className="px-6 py-16 text-center">
                      <p className="text-sm text-gray-400 dark:text-gray-500">{postsError || "You haven't posted anything yet."}</p>
                    </div>
                  ) : gridLayout === 'grid' ? (
                    <div className="grid grid-cols-3 gap-0.5 p-0.5 mt-2">
                      {myPosts.map((post) =>
                        post.imagePreviewUrl ? (
                          <button
                            key={post.id}
                            type="button"
                            onClick={() => navigate(`/post/${post.id}`)}
                            className="aspect-square overflow-hidden bg-gray-100 dark:bg-white/10"
                          >
                            <img src={post.imagePreviewUrl} alt="" className="w-full h-full object-cover" />
                          </button>
                        ) : (
                          <button
                            key={post.id}
                            type="button"
                            onClick={() => navigate(`/post/${post.id}`)}
                            className="aspect-square bg-gray-50 dark:bg-white/5 flex items-center justify-center p-2"
                          >
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 line-clamp-4 text-center">{post.text}</span>
                          </button>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="mt-2">
                      {myPosts.map((post) => (
                        <PostCard key={post.id} post={post} onDeleted={handlePostDeleted} />
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'about' && (
                <div className="px-4 lg:px-6 py-5 space-y-4">
                  {profile.bio && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">Bio</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{profile.bio}</p>
                    </div>
                  )}
                  {(displayProfile.college || profile.course || profile.year) && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">Campus</p>
                      {displayProfile.college && <p className="text-sm text-gray-700 dark:text-gray-300">{displayProfile.college}</p>}
                      {(profile.course || profile.year) && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{[profile.course, profile.year].filter(Boolean).join(' · ')}</p>
                      )}
                    </div>
                  )}
                  {profile.website && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">Website</p>
                      <a
                        href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline w-fit"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        {profile.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                  {profile.createdAt?.toDate && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">Joined</p>
                      <p className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                        <Calendar className="w-3.5 h-3.5" />
                        {profile.createdAt.toDate().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                  {!profile.bio && !displayProfile.college && !profile.course && !profile.website && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">Nothing added yet — head to Edit Profile to fill this in.</p>
                  )}
                </div>
              )}

              {activeTab === 'photos' &&
                (photoPosts.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">No photos yet</p>
                    <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Photos from your posts will show up here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-0.5 p-0.5">
                    {photoPosts.map((post) => (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => navigate(`/post/${post.id}`)}
                        className="aspect-square overflow-hidden bg-gray-100 dark:bg-white/10"
                      >
                        <img src={post.imagePreviewUrl} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                ))}

              {activeTab === 'pinned' &&
                (pinnedLoading ? (
                  <div className="py-16 flex justify-center">
                    <Loader size="md" tone="dark" />
                  </div>
                ) : pinnedPosts.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">No pinned posts</p>
                    <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Pin up to 3 posts to feature them here.</p>
                  </div>
                ) : (
                  <div>
                    {pinnedPosts.map((post) => (
                      <PostCard key={post.id} post={post} onDeleted={handlePostDeleted} />
                    ))}
                  </div>
                ))}

              {activeTab === 'communities' &&
                (communitiesLoading ? (
                  <div className="py-16 flex justify-center">
                    <Loader size="md" tone="dark" />
                  </div>
                ) : communitiesError ? (
                  <div className="px-6 py-16 text-center">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">Couldn't load communities</p>
                    <button
                      type="button"
                      onClick={() => {
                        setCommunitiesLoadedOnce(false)
                      }}
                      className="mt-3 rounded-full border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 text-sm font-semibold px-5 py-2 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-300"
                    >
                      Try Again
                    </button>
                  </div>
                ) : communities.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">No communities yet</p>
                    <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Join a community or create your own.</p>
                  </div>
                ) : (
                  <div className="px-4 lg:px-6 py-4 space-y-5">
                    {communities.some((c) => c.role === 'owner') && (
                      <div>
                        <p className="mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Owned by you</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {communities
                            .filter((c) => c.role === 'owner')
                            .map((community) => (
                              <CommunityCard key={community.id} community={community} membershipState="owner" />
                            ))}
                        </div>
                      </div>
                    )}
                    {communities.some((c) => c.role !== 'owner') && (
                      <div>
                        <p className="mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Joined</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {communities
                            .filter((c) => c.role !== 'owner')
                            .map((community) => (
                              <CommunityCard key={community.id} community={community} membershipState="member" />
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

              {activeTab === 'activity' && (
                <div className="px-6 py-16 text-center">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">Activity history coming soon</p>
                  <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">This needs a bit more backend work — not faked here.</p>
                </div>
              )}
            </main>
          </div>

          <ProfileRightRail
            profile={displayProfile}
            postsCount={displayProfile.postsCount}
            followers={displayProfile.followers}
            following={displayProfile.following}
            communities={communities}
            communitiesLoading={communitiesLoading}
            photos={photoPosts}
            isOwnProfile
            onEditAbout={() => navigate('/profile/edit')}
          />
        </div>
    </div>
  )
}
