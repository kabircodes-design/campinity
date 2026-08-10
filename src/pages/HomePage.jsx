import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Plus, Radar, Search, Sparkles, UserPlus } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import StoryBubble from '../components/StoryBubble.jsx'
import PostCard from '../components/PostCard.jsx'
import BottomNav from '../components/BottomNav.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { getUserProfile } from '../firebase/profileService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { getFeedPosts, getAvatarColor, getInitials } from '../firebase/postService.js'
import { getFeedStories, getViewedStoryIds } from '../firebase/storyService.js'
import { subscribeToUnreadCount } from '../firebase/notificationService.js'
import { getTrendingCommunities } from '../firebase/communityService.js'
import CommunityCard from '../components/CommunityCard.jsx'
import ProgressWidget from '../gamification/ProgressWidget.jsx'
import SwipeablePage from '../components/SwipeablePage.jsx'
import { useFollowingFeed } from '../hooks/useFollowingFeed.js'
import { useForYouFeed } from '../hooks/useForYouFeed.js'
import { useCampusVerificationReminder } from '../hooks/useCampusVerificationReminder.js'
import CampusVerificationModal from '../components/CampusVerificationModal.jsx'
import CampusVerificationBanner from '../components/CampusVerificationBanner.jsx'

// Tab labels only — no student/user data, so this stays local instead of
// importing from dummyFeed.js.
const feedTabs = [
  { label: 'For You', key: 'forYou' },
  { label: 'Following', key: 'following' },
  { label: 'Campus', key: 'campus' },
  { label: 'Clubs', key: 'clubs' }
]

/**
 * Presentation-only pass (OS-inspired depth: solid surfaces + soft
 * shadows, not glass, per the brief). Every hook, every Firebase call,
 * every prop passed to PostCard/StoryBubble/BottomNav/Avatar is
 * byte-identical to before — only spacing, elevation, borders, and
 * transitions on markup that lives directly in THIS file changed.
 *
 * Not touched, because they're separate files I don't have:
 * PostCard.jsx (the actual feed cards), StoryBubble.jsx, BottomNav.jsx,
 * Avatar.jsx. Their "premium card/nav" treatment from the brief still
 * needs those files pasted in before it can be done for real.
 *
 * bg-white/bg-gray-50/border-gray-100/text-gray-900 etc. here already
 * run through the app's global theme-tokens.css remap (that file is
 * imported once in main.jsx, not scoped to the landing page), so this
 * screen was already theme-reactive before this pass — the classes
 * below are unchanged in that respect, only depth/spacing/motion
 * layered on top.
 */
export default function HomePage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(feedTabs[0].key)

  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [stories, setStories] = useState([])
  const [viewedStoryIds, setViewedStoryIds] = useState(new Set())
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const uid = auth.currentUser?.uid

    const loadProfile = async () => {
      if (!uid) return
      try {
        const data = await getUserProfile(uid)
        if (!cancelled) setProfile(data)
      } catch {
        // Greeting falls back to initials-only if this fails; the feed
        // below still loads on its own regardless.
      }
    }

    const loadFeed = async () => {
      try {
        const [postsData, storiesData, viewedIds] = await Promise.all([
          getFeedPosts(uid),
          getFeedStories(),
          getViewedStoryIds(uid)
        ])
        if (!cancelled) {
          setPosts(postsData)
          setStories(storiesData)
          setViewedStoryIds(viewedIds)
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not load the feed.')
      }
    }

    Promise.all([loadProfile(), loadFeed()]).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  // Real-time notification badge — separate from the one-time
  // profile/feed load above, and intentionally not blocking that
  // load's `setLoading(false)` (the badge count arriving a moment
  // later than the feed shouldn't hold up the whole page rendering).
  // Lives for the component's full lifetime, updating live as
  // notifications are created/read elsewhere, not just once on mount.
  useEffect(() => {
    const uid = auth.currentUser?.uid
    const unsubscribe = subscribeToUnreadCount(uid, setUnreadCount)
    return () => unsubscribe()
  }, [])

  const visiblePosts = useMemo(
    () => posts.filter((post) => post.feedCategories.includes(activeTab)),
    [posts, activeTab]
  )

  const {
    posts: followingPosts,
    loading: followingLoading,
    error: followingError,
    isFollowingAnyone
  } = useFollowingFeed(auth.currentUser?.uid)

  const {
    posts: forYouPosts,
    loading: forYouLoading,
    error: forYouError,
    loadMore: loadMoreForYou,
    loadingMore: forYouLoadingMore,
    hasMore: forYouHasMore
  } = useForYouFeed(auth.currentUser?.uid)

  // Callback ref, not useRef+useEffect — the prior version's effect
  // dependency array never included forYouLoading, so on the very
  // first load the effect ran once while the sentinel div didn't
  // exist yet (it's only rendered in the "loaded" branch of the
  // loading/error/empty/loaded ternary), found sentinelRef.current
  // null, and exited. Nothing in the dependency list changed again
  // when loading finished and the real sentinel mounted, so the
  // effect never re-ran and the observer was never attached to
  // anything — confirmed as the actual cause, not assumed. A callback
  // ref fires exactly when React attaches/detaches the DOM node,
  // independent of any other state, which is the correct fix for a
  // conditionally-rendered observation target.
  const forYouObserverRef = useRef(null)

  const forYouSentinelCallbackRef = useCallback(
    (node) => {
      if (forYouObserverRef.current) {
        forYouObserverRef.current.disconnect()
        forYouObserverRef.current = null
      }
      if (!node) return // node is null on unmount — nothing to observe

      forYouObserverRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            console.log('[ForYou] sentinel intersecting — observer fired') // TEMPORARY — remove once confirmed
            loadMoreForYouRef.current()
          }
        },
        { rootMargin: '600px' } // triggers well before the sentinel is visible, so the next page is ready before the user hits the true bottom
      )
      forYouObserverRef.current.observe(node)
      console.log('[ForYou] observer attached to real sentinel node; scroll root: window (verified — no overflow/height constraint found in App.jsx, SwipeablePage.jsx, or this page\'s own outer wrapper)') // TEMPORARY — remove once confirmed
    },
    [] // stable identity — the callback itself never needs to change; loadMoreForYouRef (below) always calls the latest loadMore/hasMore/loadingMore via a ref, so this doesn't need them as dependencies either
  )

  // loadMoreForYouRef always points at a fresh closure over the
  // current loadMore/hasMore/loadingMore — this is what lets the
  // IntersectionObserver's callback (created once, via the stable
  // forYouSentinelCallbackRef above) always see current state instead
  // of a stale closure from whenever the observer was first created.
  const loadMoreForYouRef = useRef(() => {})
  useEffect(() => {
    loadMoreForYouRef.current = () => {
      if (forYouHasMore && !forYouLoadingMore) loadMoreForYou()
    }
  }, [forYouHasMore, forYouLoadingMore, loadMoreForYou])

  const [communities, setCommunities] = useState([])
  const [communitiesLoading, setCommunitiesLoading] = useState(false)
  const [communitiesLoaded, setCommunitiesLoaded] = useState(false)

  useEffect(() => {
    if (activeTab !== 'clubs' || communitiesLoaded) return
    let cancelled = false
    setCommunitiesLoading(true)
    getTrendingCommunities({ pageSize: 30 })
      .then((data) => {
        if (!cancelled) {
          setCommunities(data)
          setCommunitiesLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) setCommunitiesLoaded(true)
      })
      .finally(() => {
        if (!cancelled) setCommunitiesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, communitiesLoaded])

  const displayName = profile?.displayName || ''
  const firstName = displayName.split(' ')[0] || 'there'
  const initials = getInitials(displayName)
  const myColorClass = getAvatarColor(auth.currentUser?.uid || displayName)

  const storyBubbles = useMemo(() => {
    const uid = auth.currentUser?.uid
    const myGroup = uid ? stories.find((s) => s.userId === uid) : null
    const otherGroups = uid ? stories.filter((s) => s.userId !== uid) : stories

    const addStory = {
      id: 'write',
      label: 'Your Story',
      initials,
      colorClass: myColorClass,
      avatar: myGroup?.avatar || '',
      isAdd: true,
      // Carries the real story data when present — StoryBubble.jsx
      // uses this to open the viewer on tap (real avatar, real ring)
      // instead of only ever being able to open the composer, while
      // still exposing the add affordance separately. Deliberately
      // never duplicated into otherGroups below.
      stories: myGroup?.stories || []
    }
    const moreStory = { id: 'more', label: 'More', isMore: true }
    return [addStory, ...otherGroups, moreStory]
  }, [stories, initials, myColorClass])

  const { showModal, showBanner, closeModal, dismissBanner } = useCampusVerificationReminder(profile)

  if (loading) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50 flex items-center justify-center">
        <Loader size="lg" tone="dark" />
      </div>
    )
  }

  return (
    <>
    <SwipeablePage>
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      {/* Centered mobile-first column — desktop simply centers this same layout */}
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
        {/* -------------------------------------------------------- */}
        {/* Top header — logo + notifications, stays pinned          */}
        {/* -------------------------------------------------------- */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
          <div className="h-14 flex items-center justify-between px-4">
            <button
              type="button"
              onClick={() => navigate('/home')}
              aria-label="Campinity — go to Home"
              className="flex items-center gap-1.5"
            >
              {/* Minimal abstract mark — three connected nodes, not a
                  letter. Deliberately echoes the "network/community"
                  motif this app is actually about (same idea behind
                  swapping the bottom-nav Communities icon to Orbit),
                  rather than a generic lettermark. Royal Indigo
                  gradient fill, matching the wordmark beside it. */}
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <defs>
                  <linearGradient id="campinityMarkGradient" x1="0" y1="0" x2="20" y2="20">
                    <stop offset="0%" stopColor="var(--theme-accentSecondary, #7b61ff)" />
                    <stop offset="100%" stopColor="var(--theme-accent, #5b4dff)" />
                  </linearGradient>
                </defs>
                <line x1="6" y1="6" x2="14" y2="6" stroke="url(#campinityMarkGradient)" strokeWidth="1.4" />
                <line x1="6" y1="6" x2="10" y2="15" stroke="url(#campinityMarkGradient)" strokeWidth="1.4" />
                <line x1="14" y1="6" x2="10" y2="15" stroke="url(#campinityMarkGradient)" strokeWidth="1.4" />
                <circle cx="6" cy="6" r="2.75" fill="url(#campinityMarkGradient)" />
                <circle cx="14" cy="6" r="2.75" fill="url(#campinityMarkGradient)" />
                <circle cx="10" cy="15" r="2.75" fill="url(#campinityMarkGradient)" />
              </svg>
              <span
                className="text-[17px] leading-none tracking-tight"
                style={{
                  fontWeight: 650,
                  backgroundImage:
                    'linear-gradient(90deg, var(--theme-accent, #5b4dff), var(--theme-accentSecondary, #7b61ff))',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent'
                }}
              >
                Campinity
              </span>
            </button>

            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Create post"
                onClick={() => navigate('/create')}
                className="relative w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 active:scale-95 transition-all duration-200"
              >
                <Plus className="w-5 h-5" />
              </button>

              <button
                type="button"
                aria-label="Radar"
                onClick={() => navigate('/radar')}
                className="relative w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 active:scale-95 transition-all duration-200"
              >
                <Radar className="w-5 h-5" />
              </button>

              <button
                type="button"
                aria-label="Notifications"
                onClick={() => navigate('/notifications')}
                className="relative w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 active:scale-95 transition-all duration-200"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
                )}
              </button>
            </div>
          </div>
        </header>

        {showBanner && <CampusVerificationBanner onDismiss={dismissBanner} />}

        {/* -------------------------------------------------------- */}
        {/* Greeting + search — real Firebase profile                */}
        {/* -------------------------------------------------------- */}
        <section className="px-4 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <Avatar
              initials={initials}
              colorClass={myColorClass}
              size="md"
              src={getProfileIdentityImage(profile) || undefined}
            />
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-tight">
                Good morning, {firstName}
              </h1>
              <p className="mt-0.5 text-[13px] text-gray-400">Catch up on what's happening across campus.</p>
            </div>
          </div>

          <ProgressWidget uid={auth.currentUser?.uid} />

          <button
            type="button"
            onClick={() => navigate('/search')}
            className="group relative mt-4 w-full text-left"
            aria-label="Search Campinity"
          >
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors duration-200 group-hover:text-gray-500" />
            <span className="block w-full rounded-2xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-sm text-gray-400 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-200 group-hover:bg-white group-hover:border-gray-300 group-hover:shadow-[0_2px_10px_rgba(15,23,42,0.06)]">
              Search Campinity
            </span>
          </button>
        </section>

        {/* -------------------------------------------------------- */}
        {/* Stories row — real Firestore stories                     */}
        {/* -------------------------------------------------------- */}
        <section className="pb-3.5 border-b border-gray-100">
          <div className="flex items-start gap-3.5 px-4 overflow-x-auto scroll-hidden">
            {storyBubbles.map((story) => {
              const seen =
                !story.isAdd && !story.isMore && story.stories?.length > 0
                  ? story.stories.every((s) => viewedStoryIds.has(s.id))
                  : false
              return (
                <StoryBubble
                  key={story.id}
                  story={story}
                  seen={seen}
                  onViewed={(storyId) => setViewedStoryIds((prev) => new Set(prev).add(storyId))}
                  onDeleted={(storyId) => {
                    setStories((prev) =>
                      prev
                        .map((group) => ({ ...group, stories: group.stories.filter((s) => s.id !== storyId) }))
                        .filter((group) => group.stories.length > 0)
                    )
                  }}
                />
              )
            })}
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/* Feed tabs                                                 */}
        {/* -------------------------------------------------------- */}
        <nav className="sticky top-14 z-30 flex items-center bg-white/95 backdrop-blur-md border-b border-gray-100">
          {feedTabs.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex-1 py-3 text-[13px] font-semibold text-center transition-colors duration-200 ${
                  isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab.label}
                <span
                  className={`absolute left-3 right-3 -bottom-px h-[2px] rounded-full bg-blue-600 transition-all duration-300 ease-out ${
                    isActive ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-50'
                  }`}
                  aria-hidden="true"
                />
              </button>
            )
          })}
        </nav>

        {/* -------------------------------------------------------- */}
        {/* Feed — Firestore posts                                    */}
        {/* -------------------------------------------------------- */}
        <main className="pb-24">
          {activeTab === 'clubs' ? (
            communitiesLoading ? (
              <div className="py-16 flex justify-center">
                <Loader size="md" tone="dark" />
              </div>
            ) : communities.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-semibold text-gray-900">No communities yet.</p>
                <p className="mt-1 text-sm text-gray-400">Be the first to create one.</p>
              </div>
            ) : (
              <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {communities.map((community) => (
                  <CommunityCard key={community.id} community={community} />
                ))}
              </div>
            )
          ) : activeTab === 'following' ? (
            followingError ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm text-gray-400">{followingError}</p>
              </div>
            ) : followingLoading ? (
              <div className="py-16 flex justify-center">
                <Loader size="md" tone="dark" />
              </div>
            ) : !isFollowingAnyone ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-semibold text-gray-900">Nothing here yet</p>
                <p className="mt-1 text-sm text-gray-400 max-w-[260px] mx-auto leading-relaxed">
                  Follow students from your campus to see their latest posts.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/search')}
                  className="mt-5 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-300"
                >
                  Discover People
                </button>
              </div>
            ) : followingPosts.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center">
                  <UserPlus className="w-4.5 h-4.5 text-blue-500" />
                </div>
                <p className="mt-3 text-sm font-semibold text-gray-900">Your feed is waiting.</p>
                <p className="mt-1 text-sm text-gray-400">Follow people to see what they're sharing.</p>
              </div>
            ) : (
              followingPosts.map((post) => <PostCard key={post.id} post={post} />)
            )
          ) : activeTab === 'forYou' ? (
            forYouError ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm text-gray-400">{forYouError}</p>
              </div>
            ) : forYouLoading ? (
              <div className="py-16 flex justify-center">
                <Loader size="md" tone="dark" />
              </div>
            ) : forYouPosts.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto w-11 h-11 rounded-full bg-amber-50 flex items-center justify-center">
                  <Sparkles className="w-4.5 h-4.5 text-amber-500" />
                </div>
                <p className="mt-3 text-sm font-semibold text-gray-900">Your campus is quiet... for now.</p>
                <p className="mt-1 text-sm text-gray-400">Be the first to share something.</p>
              </div>
            ) : (
              <>
                {forYouPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
                <div ref={forYouSentinelCallbackRef} />
                {forYouLoadingMore && (
                  <div className="py-6 flex justify-center">
                    <Loader size="sm" tone="dark" />
                  </div>
                )}
                {!forYouHasMore && forYouPosts.length > 0 && (
                  <p className="py-8 text-center text-xs text-gray-400">You're all caught up.</p>
                )}
              </>
            )
          ) : error ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-gray-400">{error}</p>
            </div>
          ) : visiblePosts.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto w-11 h-11 rounded-full bg-amber-50 flex items-center justify-center">
                <Sparkles className="w-4.5 h-4.5 text-amber-500" />
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-900">Your campus is quiet... for now.</p>
              <p className="mt-1 text-sm text-gray-400">Be the first to share something.</p>
            </div>
          ) : (
            visiblePosts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </main>
      </div>
    </div>
    </SwipeablePage>

      {/* -------------------------------------------------------- */}
      {/* Bottom mobile navigation — sticky, centered to match column.
          Deliberately OUTSIDE SwipeablePage: that wrapper applies a
          CSS transform during drag, and a transformed ancestor becomes
          the containing block for any position:fixed descendant — left
          inside, BottomNav would drag along with the page instead of
          staying pinned to the viewport. Same reasoning for the
          verification modal below it. */}
      {/* -------------------------------------------------------- */}
      <BottomNav />

      <CampusVerificationModal open={showModal} onRemindLater={closeModal} />
    </>
  )
}
