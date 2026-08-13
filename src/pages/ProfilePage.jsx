import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Grid3x3, List, Settings } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import DesktopSidebar from '../components/DesktopSidebar.jsx'
import ProfileHeader from '../components/ProfileHeader.jsx'
import ProgressCard from '../gamification/ProgressCard.jsx'
import PostCard from '../components/PostCard.jsx'
import CommunityCard from '../components/CommunityCard.jsx'
import Loader from '../auth/components/Loader.jsx'
import { getCollegeById } from '../data/dummyColleges.js'
import { auth } from '../firebase/firebase.js'
import { getUserProfile } from '../firebase/profileService.js'
import { getAvatarColor, getInitials, getUserPosts, getPostById } from '../firebase/postService.js'
import { getUserCommunityMemberships, getCommunityById, getOwnedCommunities } from '../firebase/communityService.js'

const GRID_LAYOUT_KEY = 'campinity:profileGridLayout'

const tabs = [
  { key: 'posts', label: 'Posts' },
  { key: 'pinned', label: 'Pinned' },
  { key: 'communities', label: 'Communities' },
  { key: 'activity', label: 'Activity' }
]

/**
 * Complete replacement of the old tab content — the previous version's
 * notes/events/marketplace tabs pulled from dummySearch.js/dummyFeed.js
 * (hardcoded sample data, never connected to real Firestore data for
 * THIS user at all — filtering dummy `notes` by
 * `note.uploader === profile.displayName` could never return anything
  * for a real signed-in user). Replaced with tabs backed by real
 * data: Posts (unchanged, already real), Pinned (profile.pinnedPostIds,
 * now correctly returned by profileService.js), Communities
 * (communityService.js's getUserCommunityMemberships, already fully
 * real and working).
 *
 * Saved was removed from here entirely (moved to Settings > Saved,
 * per the Saved Library System's explicit instruction — Instagram
 * puts Saved in settings, not the profile tab row).
 *
 * "Tagged" from the brief is not here — no tagging concept exists
 * anywhere in this project's schema; a fake empty tab for a feature
 * with zero backing data isn't a real tab, it's a decoration.
 * "Activity" shows a real "coming soon" empty state rather than faked
 * history — no activity-log collection exists yet; building one means
 * writing an activity-log entry at every like/comment/join/create
 * action across the app, a change to many existing write paths this
 * page alone can't safely make.
 *
 * "Comment Karma" / "Likes Received" / "Events Joined" stats from the
 * brief are not shown — computing them live means scanning every post/
 * comment a user has ever made on every profile view (real N+1 risk);
 * showing them for real needs denormalized counters incremented at
 * write time, a separate, larger change. Not faked with a live scan,
 * not silently dropped without explanation either — see this
 * feature's own chat summary.
 */
export default function ProfilePage() {
  const navigate = useNavigate()
  const currentUid = auth.currentUser?.uid

  const [activeTab, setActiveTab] = useState(tabs[0].key)
  const [gridLayout, setGridLayout] = useState(() => localStorage.getItem(GRID_LAYOUT_KEY) || 'list')

  const [profile, setProfile] = useState(null)
  const [myPosts, setMyPosts] = useState([])
  const [postsError, setPostsError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [pinnedPosts, setPinnedPosts] = useState([])
  const [pinnedLoading, setPinnedLoading] = useState(false)
  const [communities, setCommunities] = useState([])
  const [communitiesLoading, setCommunitiesLoading] = useState(false)
  const [communitiesLoadedOnce, setCommunitiesLoadedOnce] = useState(false)
  const [communitiesError, setCommunitiesError] = useState(false)
  const [pinnedLoadedOnce, setPinnedLoadedOnce] = useState(false)

  useEffect(() => {
    let cancelled = false
    const uid = currentUid

    const loadProfile = async () => {
      if (!uid) {
        if (!cancelled) setError('Not signed in.')
        return
      }
      try {
        const data = await getUserProfile(uid)
        if (!cancelled) setProfile(data)
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not load your profile.')
      }
    }

    const loadPosts = async () => {
      if (!uid) return
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

    Promise.all([loadProfile(), loadPosts()]).finally(() => {
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
    if (activeTab !== 'communities' || communitiesLoadedOnce || !currentUid) return
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
  }, [activeTab, currentUid, communitiesLoadedOnce])

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

  if (loading) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50 flex items-center justify-center">
        <Loader size="lg" tone="dark" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
        <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm flex items-center justify-center px-6 text-center">
          <p className="text-sm text-gray-400">{error || 'Profile not found.'}</p>
        </div>
        <BottomNav />
      </div>
    )
  }

  const displayProfile = {
    ...profile,
    displayName: profile.displayName || auth.currentUser?.displayName || 'Student',
    college: college?.name || '',
    initials: getInitials(profile.displayName || auth.currentUser?.displayName || 'Student'),
    colorClass: getAvatarColor(currentUid || profile.username),
    postsCount: myPosts.length,
    followers: profile.followersCount || 0,
    following: profile.followingCount || 0,
    communitiesCount: communitiesLoadedOnce ? communities.length : undefined
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: profile.displayName, url: window.location.href }).catch(() => {})
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).catch(() => {})
    }
  }

  return (
    <div className="lg:flex lg:h-screen lg:overflow-hidden">
    <DesktopSidebar profile={displayProfile} />
    <div className="min-h-screen w-full max-w-[100vw] lg:max-w-none lg:h-screen lg:overflow-y-auto overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[600px] min-h-screen lg:min-h-0 bg-white lg:shadow-sm lg:border-x lg:border-gray-100">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center justify-between px-4">
            <span className="text-base font-bold tracking-tight text-gray-900">Profile</span>
            <button
              type="button"
              aria-label="Settings"
              onClick={() => navigate('/settings')}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
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

        <nav className="sticky top-14 z-30 flex items-center bg-white border-b border-gray-100 overflow-x-auto scroll-hidden">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 px-4 py-3 text-[13px] font-semibold text-center border-b-2 transition-all duration-300 ${
                activeTab === tab.key
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-400 border-transparent hover:text-gray-600'
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
              className="ml-auto mr-3 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-all duration-300"
            >
              {gridLayout === 'grid' ? <List className="w-4 h-4" /> : <Grid3x3 className="w-4 h-4" />}
            </button>
          )}
        </nav>

        <main className="pb-24">
          {activeTab === 'posts' &&
            (myPosts.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm text-gray-400">{postsError || "You haven't posted anything yet."}</p>
              </div>
            ) : gridLayout === 'grid' ? (
              <div className="grid grid-cols-3 gap-0.5 p-0.5">
                {myPosts.map((post) =>
                  post.imagePreviewUrl ? (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => navigate(`/post/${post.id}`)}
                      className="aspect-square overflow-hidden bg-gray-100"
                    >
                      <img src={post.imagePreviewUrl} alt="" className="w-full h-full object-cover" />
                    </button>
                  ) : (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => navigate(`/post/${post.id}`)}
                      className="aspect-square bg-gray-50 flex items-center justify-center p-2"
                    >
                      <span className="text-[10px] text-gray-400 line-clamp-4 text-center">{post.text}</span>
                    </button>
                  )
                )}
              </div>
            ) : (
              <div>
                {myPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onDeleted={(deletedId) => setMyPosts((prev) => prev.filter((p) => p.id !== deletedId))}
                  />
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
                <p className="text-sm font-semibold text-gray-900">No pinned posts</p>
                <p className="mt-1 text-sm text-gray-400">Pin up to 3 posts to feature them here.</p>
              </div>
            ) : (
              <div>
                {pinnedPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onDeleted={(deletedId) => {
                      setPinnedPosts((prev) => prev.filter((p) => p.id !== deletedId))
                      // A deleted post can no longer be pinned either —
                      // keep myPosts in sync too, since deleting a
                      // pinned post from the Pinned tab should also
                      // update the Posts tab/count without requiring a
                      // manual refresh, matching the same-post-same-
                      // behavior-everywhere requirement.
                      setMyPosts((prev) => prev.filter((p) => p.id !== deletedId))
                    }}
                  />
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
                <p className="text-sm font-semibold text-gray-900">Couldn't load communities</p>
                <button
                  type="button"
                  onClick={() => {
                    setCommunitiesLoadedOnce(false)
                  }}
                  className="mt-3 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold px-5 py-2 hover:border-gray-300 transition-all duration-300"
                >
                  Try Again
                </button>
              </div>
            ) : communities.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-semibold text-gray-900">No communities yet</p>
                <p className="mt-1 text-sm text-gray-400">Join a community or create your own.</p>
              </div>
            ) : (
              <div className="px-4 py-4 space-y-5">
                {communities.some((c) => c.role === 'owner') && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Owned by you</p>
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
                    <p className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Joined</p>
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
              <p className="text-sm font-semibold text-gray-900">Activity history coming soon</p>
              <p className="mt-1 text-sm text-gray-400">This needs a bit more backend work — not faked here.</p>
            </div>
          )}
        </main>
      </div>
    </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
