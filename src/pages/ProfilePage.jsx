import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bookmark, Calendar, ChevronRight, GraduationCap, Grid3x3, Image as ImageIcon, Link as LinkIcon, List, MapPin, Trophy } from 'lucide-react'
import ProfileHeader from '../components/ProfileHeader.jsx'
import ProfileRightRail from '../components/ProfileRightRail.jsx'
import ShareBottomSheet from '../sharing/ShareBottomSheet.jsx'
import ProgressCard from '../gamification/ProgressCard.jsx'
import CampusImpactCard from '../gamification/CampusImpactCard.jsx'
import CampusJourneyCard from '../gamification/CampusJourneyCard.jsx'
import PostComposer from '../components/PostComposer.jsx'
import PostCard from '../components/PostCard.jsx'
import CommunityCard from '../components/CommunityCard.jsx'
import Loader from '../auth/components/Loader.jsx'
import { getCollegeById } from '../data/dummyColleges.js'
import { auth } from '../firebase/firebase.js'
import { getAvatarColor, getInitials, getUserPosts, getUserPostCount } from '../firebase/postService.js'
import { getUserCommunityMemberships, getCommunityById, getOwnedCommunities } from '../firebase/communityService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useProgress } from '../gamification/useProgress.js'
import { getRecentlySavedItems } from '../saved/savedService.js'
import SavedItemCard from '../saved/SavedItemCard.jsx'

const GRID_LAYOUT_KEY = 'campinity:profileGridLayout'

const tabs = [
  { key: 'posts', label: 'Posts' },
  { key: 'communities', label: 'Communities' },
  { key: 'saved', label: 'Saved' },
  { key: 'about', label: 'About' }
]

// Posts tab view modes, chosen from the small selector at the top of the
// Posts tab. 'photos'
// is what used to be the separate Photos tab.
const POST_VIEWS = ['list', 'grid', 'photos']
const POST_VIEW_META = {
  list: { icon: List, label: 'List view' },
  grid: { icon: Grid3x3, label: 'Grid view' },
  photos: { icon: ImageIcon, label: 'Photos only' }
}

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
 * Tabs are Posts / Communities / Saved / About. About shows the same
 * real profile fields ProfileHeader.jsx has, plus the progress cards.
 * Saved shows the most recently saved items from the existing Saved
 * library (savedService.js) with a link to the full /saved page — no
 * second storage. Photos is no longer its own tab: it is a view mode
 * of the Posts tab (list / grid / photos only), derived from myPosts.
 *
 * The post composer (PostComposer.jsx) is shown here on desktop only;
 * on mobile, posts are created from the bottom nav's + button.
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
  const [gridLayout, setGridLayout] = useState(() => {
    const stored = localStorage.getItem(GRID_LAYOUT_KEY)
    return POST_VIEWS.includes(stored) ? stored : 'list'
  })
  const { progress } = useProgress(currentUid)

  // Saved tab — loaded the first time it is opened.
  const [savedItems, setSavedItems] = useState(null)
  const [savedError, setSavedError] = useState(false)
  useEffect(() => {
    if (activeTab !== 'saved' || savedItems !== null || savedError || !currentUid) return undefined
    let cancelled = false
    getRecentlySavedItems(currentUid, { pageSize: 12 })
      .then((items) => {
        if (!cancelled) setSavedItems(items)
      })
      .catch(() => {
        if (!cancelled) setSavedError(true)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, savedItems, savedError, currentUid])

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
  const [shareOpen, setShareOpen] = useState(false)

  const [communities, setCommunities] = useState([])
  const [communitiesLoading, setCommunitiesLoading] = useState(true)
  const [communitiesLoadedOnce, setCommunitiesLoadedOnce] = useState(false)
  const [communitiesError, setCommunitiesError] = useState(false)

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

  const selectPostView = (view) => {
    setGridLayout(view)
    localStorage.setItem(GRID_LAYOUT_KEY, view)
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

  const handlePostDeleted = (deletedId) => {
    setMyPosts((prev) => prev.filter((p) => p.id !== deletedId))
    setPostCount((prev) => (typeof prev === 'number' ? Math.max(0, prev - 1) : prev))
  }

  // Reuses the existing sharing architecture (ShareBottomSheet +
  // shareService.js's already-registered `profile` canonical pattern,
  // /student/:username) instead of a second, ad-hoc share mechanism —
  // gets "share to a Campinity chat," "copy link" (with real visible
  // feedback, not a silent clipboard write), and native share for free,
  // all through the one component every other share entry point uses.
  const handleShare = () => setShareOpen(true)

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
            <ProfileHeader
              profile={displayProfile}
              isOwnProfile
              onEdit={() => navigate('/profile/edit')}
              onShare={handleShare}
              onOpenFollowers={() => navigate('/followers')}
              onOpenFollowing={() => navigate('/following')}
              onOpenSettings={() => navigate('/settings')}
            />

            {/* Campus Rank shortcut — real level/rank from userProgress.
                The full progress card lives in the About tab. */}
            {progress && (
              <div className="px-4 lg:px-6 pb-3">
                <button
                  type="button"
                  onClick={() => navigate('/progress')}
                  className="w-full flex items-center gap-3 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 px-3.5 py-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none hover:border-blue-100 dark:hover:border-white/20 active:scale-[0.99] transition-all duration-200"
                >
                  <span className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-500 flex items-center justify-center flex-shrink-0">
                    <Trophy className="w-5 h-5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-gray-900 dark:text-gray-50 truncate">
                      Level {progress.level} · {progress.levelTitle}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      Campus Rank{progress.rank ? ` #${progress.rank}` : ''}
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                </button>
              </div>
            )}

            <nav className="sticky top-0 z-30 bg-white dark:bg-[#11131a] border-b border-gray-100 dark:border-white/10 px-3 lg:px-6 py-2">
              {/* Each tab is sized to its own label and shares the spare space
                  (flex-auto), instead of four equal columns: "Communities" is
                  83px wide, more than a quarter of a 360px row. */}
              <div className="flex gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-auto rounded-xl px-2.5 py-2 text-[13px] font-semibold text-center whitespace-nowrap transition-all duration-200 ${
                      activeTab === tab.key
                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400'
                        : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/5'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </nav>

            <main className="pb-24 lg:pb-8">
              {activeTab === 'posts' && (
                <>
                  {/* Mobile creates posts from the bottom nav's + button. */}
                  <div className="hidden lg:block px-4 lg:px-6 pt-4">
                    <PostComposer profile={profile} initials={displayProfile.initials} colorClass={displayProfile.colorClass} firstName={firstName} />
                  </div>
                  <div className="px-4 lg:px-6 pt-3 flex justify-end">
                    <div role="radiogroup" aria-label="Posts view" className="inline-flex items-center gap-0.5 rounded-xl bg-gray-100 dark:bg-white/5 p-0.5">
                      {POST_VIEWS.map((view) => {
                        const { icon: ViewIcon, label } = POST_VIEW_META[view]
                        const selected = gridLayout === view
                        return (
                          <button
                            key={view}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={label}
                            title={label}
                            onClick={() => selectPostView(view)}
                            className={`w-8 h-7 rounded-lg flex items-center justify-center transition-all duration-200 ${
                              selected
                                ? 'bg-white text-blue-600 shadow-sm dark:bg-white/10 dark:text-blue-400'
                                : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
                            }`}
                          >
                            <ViewIcon className="w-4 h-4" />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {gridLayout === 'photos' ? (
                    photoPosts.length === 0 ? (
                      <div className="px-6 py-16 text-center">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">No photos yet</p>
                        <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Photos from your posts will show up here.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-0.5 p-0.5 mt-2">
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
                    )
                  ) : myPosts.length === 0 ? (
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

              {activeTab === 'saved' &&
                (savedError ? (
                  <div className="px-6 py-16 text-center">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">Couldn't load saved items</p>
                    <button
                      type="button"
                      onClick={() => setSavedError(false)}
                      className="mt-3 rounded-full border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 text-sm font-semibold px-5 py-2 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-300"
                    >
                      Try Again
                    </button>
                  </div>
                ) : savedItems === null ? (
                  <div className="py-16 flex justify-center">
                    <Loader size="md" tone="dark" />
                  </div>
                ) : savedItems.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Bookmark className="w-5 h-5" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-50">Nothing saved yet</p>
                    <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Posts, notes and listings you save will show up here.</p>
                  </div>
                ) : (
                  <div className="px-4 lg:px-6 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Recently saved</p>
                      <button
                        type="button"
                        onClick={() => navigate('/saved')}
                        className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-blue-600 dark:text-blue-400"
                      >
                        See all
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {savedItems.map((item) => (
                        <SavedItemCard key={item.id} item={item} currentUid={currentUid} />
                      ))}
                    </div>
                  </div>
                ))}

              {activeTab === 'about' && (
                <div className="py-4 space-y-3">
                  <div className="mx-4 lg:mx-6 rounded-2xl border border-gray-100 dark:border-white/10 p-4">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">About</p>
                    {displayProfile.bio ? (
                      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{displayProfile.bio}</p>
                    ) : (
                      <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">No bio yet. Add one from Edit Profile.</p>
                    )}
                    <div className="mt-3 space-y-2">
                      {[displayProfile.course, displayProfile.year].filter(Boolean).length > 0 && (
                        <p className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-400">
                          <GraduationCap className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                          {[displayProfile.course, displayProfile.year].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {displayProfile.college && (
                        <p className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-400">
                          <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                          {displayProfile.college}
                        </p>
                      )}
                      {profile.createdAt?.toDate && (
                        <p className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-400">
                          <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                          Joined {profile.createdAt.toDate().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                        </p>
                      )}
                      {profile.website && (
                        <a
                          href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-[13px] text-blue-600 dark:text-blue-400 hover:underline w-fit"
                        >
                          <LinkIcon className="w-4 h-4 flex-shrink-0" />
                          {profile.website.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                    </div>
                  </div>

                  <ProgressCard uid={currentUid} />

                  {/* Impact/Journey render here only on mobile; on desktop
                      they live once in ProfileRightRail (never both, so no
                      duplicate mount or double Firestore read). */}
                  <div className="lg:hidden">
                    <CampusImpactCard uid={currentUid} className="mx-4 mt-3" />
                    <CampusJourneyCard uid={currentUid} className="mx-4 mt-3" />
                  </div>
                </div>
              )}

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

            </main>
          </div>

          <ProfileRightRail uid={currentUid} />
        </div>

        <ShareBottomSheet
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          referenceType="profile"
          referenceId={profile.username}
          preview={{ title: displayProfile.displayName, subtitle: profile.username ? `@${profile.username}` : '', image: getProfileIdentityImage(profile) || null }}
        />
    </div>
  )
}
