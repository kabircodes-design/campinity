import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Plus, Radar, Search, Sparkles, UserPlus } from 'lucide-react'
import StoryBubble from '../components/StoryBubble.jsx'
import PostCard from '../components/PostCard.jsx'
import BottomNav from '../components/BottomNav.jsx'
import DesktopSidebar from '../components/DesktopSidebar.jsx'
import DesktopRightRail from '../components/DesktopRightRail.jsx'
import NotesView from '../components/NotesView.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { getUserProfile } from '../firebase/profileService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { getFeedPosts, getAvatarColor, getInitials, getNotesPosts } from '../firebase/postService.js'
import { getFeedStories, getViewedStoryIds } from '../firebase/storyService.js'
import { subscribeToUnreadCount } from '../firebase/notificationService.js'
import { getTrendingCommunities } from '../firebase/communityService.js'

import SwipeablePage from '../components/SwipeablePage.jsx'
import { useFollowingFeed } from '../hooks/useFollowingFeed.js'
import { useForYouFeed } from '../hooks/useForYouFeed.js'
import { useCampusVerificationReminder } from '../hooks/useCampusVerificationReminder.js'
import CampusVerificationModal from '../components/CampusVerificationModal.jsx'
import CampusVerificationBanner from '../components/CampusVerificationBanner.jsx'
import PostingStatusPill from '../components/PostingStatusPill.jsx'
import { usePostingStatus } from '../context/PostingStatusContext.jsx'

const feedTabs = [
  { label: 'For You', key: 'forYou' },
  { label: 'Following', key: 'following' },
  { label: 'Campus', key: 'campus' },
  { label: 'Notes', key: 'notes' }
]

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
  const [contentPreferences, setContentPreferences] = useState([])

  useEffect(() => {
    let cancelled = false
    const uid = auth.currentUser?.uid

    const loadProfile = async () => {
      if (!uid) return
      try {
        const data = await getUserProfile(uid)
        if (!cancelled) {
          setProfile(data)
          const types = data?.preferences?.contentTypes
          if (Array.isArray(types) && types.length > 0) setContentPreferences(types)
        }
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
          const now = Date.now()
          const activePosts = postsData.filter((p) => !p.expiresAtMs || p.expiresAtMs > now)
          setPosts(activePosts)
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
  } = useForYouFeed(auth.currentUser?.uid, contentPreferences)

  const forYouObserverRef = useRef(null)

  const forYouSentinelCallbackRef = useCallback((node) => {
    if (forYouObserverRef.current) {
      forYouObserverRef.current.disconnect()
      forYouObserverRef.current = null
    }
    if (!node) return

    forYouObserverRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreForYouRef.current()
        }
      },
      { rootMargin: '600px' }
    )
    forYouObserverRef.current.observe(node)
  }, [])

  const loadMoreForYouRef = useRef(() => {})
  useEffect(() => {
    loadMoreForYouRef.current = () => {
      if (forYouHasMore && !forYouLoadingMore) loadMoreForYou()
    }
  }, [forYouHasMore, forYouLoadingMore, loadMoreForYou])

  const [communities, setCommunities] = useState([])
  const [notesCount, setNotesCount] = useState(null)
  const [notesForPreview, setNotesForPreview] = useState([])
  const [communitiesLoading, setCommunitiesLoading] = useState(false)
  const [communitiesLoaded, setCommunitiesLoaded] = useState(false)
  const [communitiesError, setCommunitiesError] = useState(false)

  useEffect(() => {
    if (communitiesLoaded) return
    let cancelled = false
    setCommunitiesLoading(true)
    setCommunitiesError(false)
    getTrendingCommunities({ pageSize: 30 })
      .then((data) => {
        if (!cancelled) {
          setCommunities(data)
          setCommunitiesLoaded(true)
        }
      })
      .catch((err) => {
        console.error('Could not load communities:', err)
        if (!cancelled) {
          setCommunitiesError(true)
          setCommunitiesLoaded(true)
        }
      })
      .finally(() => {
        if (!cancelled) setCommunitiesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [communitiesLoaded])

  useEffect(() => {
    let cancelled = false
    getNotesPosts(auth.currentUser?.uid)
      .then((data) => {
        if (!cancelled) {
          setNotesCount(data.length)
          setNotesForPreview(data.filter((n) => n.file))
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const { status: postingStatus, newPost: postingNewPost } = usePostingStatus()

  // Optimistic feed insertion — only for the local `posts` state this
  // component owns directly (the 'campus' tab's source, via
  // getFeedPosts). Dedup by id is the actual fix for "duplicate
  // appearance when the Firestore listener eventually returns the
  // same post": if a post with this id is already present (e.g. this
  // effect already ran once for it, or a future reload already
  // brought it back from Firestore), it's left untouched rather than
  // inserted a second time.
  //
  // Deliberately NOT applied to followingPosts/forYouPosts — those
  // are owned by useFollowingFeed/useForYouFeed, hooks I don't have
  // and can't safely mutate without risking the exact duplication bug
  // this feature exists to prevent. A real, stated limitation, not a
  // silent one: a post created while viewing "For You" or "Following"
  // won't optimistically appear in those specific tabs, only in
  // "Campus," until those hooks' own next real reload picks it up.
  useEffect(() => {
    if (postingStatus !== 'success' || !postingNewPost) return
    setPosts((prev) => {
      if (prev.some((p) => String(p.id) === String(postingNewPost.id))) return prev
      return [postingNewPost, ...prev]
    })
  }, [postingStatus, postingNewPost])

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
      avatar: myGroup?.avatar || getProfileIdentityImage(profile) || '',
      isAdd: true,
      stories: myGroup?.stories || []
    }
    const moreStory = { id: 'more', label: 'More', isMore: true }
    return [addStory, ...otherGroups, moreStory]
  }, [stories, initials, myColorClass, profile])

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
    <div
      className="relative overflow-x-hidden lg:grid lg:h-screen lg:overflow-hidden lg:gap-3 lg:[grid-template-columns:minmax(240px,280px)_minmax(0,1fr)_minmax(260px,320px)]"
      style={{ backgroundColor: '#f8fafc' }}
    ><DesktopSidebar unreadNotifications={unreadCount} profile={profile} />
    <SwipeablePage>
    <div className="min-h-screen w-full max-w-[100vw] lg:max-w-none lg:h-screen lg:overflow-y-auto lg:min-w-0 overflow-x-hidden">
      <div className="mx-auto max-w-[480px] lg:max-w-[760px] min-h-screen lg:min-h-0 bg-white lg:bg-transparent border-x border-gray-100">
        <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
          <div className="h-14 flex items-center justify-between lg:justify-end px-4">
            <button
              type="button"
              onClick={() => navigate('/home')}
              aria-label="Campinity — go to Home"
              className="lg:hidden flex items-center gap-1.5"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <defs>
                  <linearGradient id="campinityMarkGradient" x1="0" y1="0" x2="20" y2="20">
                    <stop offset="0%" stopColor="#3b9bff" />
                    <stop offset="100%" stopColor="#1677ff" />
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
                    'linear-gradient(90deg, #1677ff, #3b9bff)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent'
                }}
              >
                Campinity
              </span>
            </button>

            <div className="flex items-center gap-1">
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
              </div>

              <button
                type="button"
                aria-label="Notifications"
                onClick={() => navigate('/notifications')}
                className="relative w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 active:scale-95 transition-all duration-200 lg:hidden"
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

        <section className="mx-4 mt-5 mb-5 px-0 py-0">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-tight">
            {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}, {firstName}
          </h1>
          <p className="mt-0.5 text-[13px] text-gray-400">Catch up on what's happening across campus.</p>

          <button
            type="button"
            onClick={() => navigate('/search')}
            className="group relative mt-4 w-full text-left lg:hidden"
            aria-label="Search Campinity"
          >
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors duration-200 group-hover:text-gray-500" />
            <span className="block w-full rounded-2xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-sm text-gray-400 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-200 group-hover:bg-white group-hover:border-gray-300 group-hover:shadow-[0_2px_10px_rgba(15,23,42,0.06)]">
              Search Campinity
            </span>
          </button>
        </section>

        <section className="mx-4 mb-5 py-0">
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

        <nav className="sticky top-14 z-30 bg-white flex items-center gap-6 px-4 border-b border-gray-100 mb-3">
          {feedTabs.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`relative py-3 text-[14px] font-semibold transition-colors duration-200 ${
                  isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab.label}
                <span
                  className={`absolute left-0 right-0 -bottom-px h-[2px] bg-blue-600 transition-opacity duration-200 ${
                    isActive ? 'opacity-100' : 'opacity-0'
                  }`}
                  aria-hidden="true"
                />
              </button>
            )
          })}
        </nav>

        <main className="pb-24" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}>
          {activeTab === 'notes' ? (
            <NotesView />
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
            visiblePosts.map((post) => (
              <div
                key={post.id}
                className={String(post.id) === String(postingNewPost?.id) ? 'cps-new-post' : undefined}
              >
                <PostCard post={post} />
              </div>
            ))
          )}
        </main>
      </div>
    </div>
    </SwipeablePage>
    <DesktopRightRail
      communities={communities}
      posts={posts}
      notesCount={notesCount}
      notesForPreview={notesForPreview}
      onViewNotes={() => setActiveTab('notes')}
    />
    </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>

      <PostingStatusPill />

      <CampusVerificationModal open={showModal} onRemindLater={closeModal} />
    </>
  )
}
