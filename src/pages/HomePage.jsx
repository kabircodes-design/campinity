import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, MessageCircle, Radar, Search, Sparkles, UserPlus } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import StoryBubble from '../components/StoryBubble.jsx'
import PostCard from '../components/PostCard.jsx'
import PostComposer from '../components/PostComposer.jsx'
import BottomNav from '../components/BottomNav.jsx'
import DesktopSidebar from '../components/DesktopSidebar.jsx'
import DesktopRightRail from '../components/DesktopRightRail.jsx'
import NotesView from '../components/NotesView.jsx'
import Loader from '../auth/components/Loader.jsx'
import Logo from '../components/Logo.jsx'
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
import CampinityIntro from '../components/CampinityIntro.jsx'
import { consumeJustOnboardedFlag } from '../onboarding/campusIntroFlag.js'

const feedTabs = [
  { label: 'For You', key: 'forYou' },
  { label: 'Following', key: 'following' },
  { label: 'Campus', key: 'campus' },
  { label: 'Notes', key: 'notes' }
]

export default function HomePage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(feedTabs[0].key)

  // Captured ONCE via the lazy initializer — this is what makes the
  // welcome intro + entrance stagger play exactly once, right after
  // onboarding, and never again: consumeJustOnboardedFlag() both reads
  // AND clears the flag on this first check, so a refresh, back-nav, or
  // any later mount of HomePage sees nothing and renders exactly as it
  // always has (entranceStage stays 'none' — every entranceClass() call
  // below then returns '', identical to this page's pre-existing
  // className strings).
  const [justOnboarded] = useState(() => consumeJustOnboardedFlag())
  const [entranceStage, setEntranceStage] = useState(justOnboarded ? 'waiting' : 'none')

  const handleIntroComplete = () => {
    setEntranceStage('playing')
    window.setTimeout(() => setEntranceStage('none'), 700)
  }

  const entranceClass = (delayMs) => {
    if (entranceStage === 'waiting') return 'opacity-0'
    if (entranceStage === 'playing') return `[animation:campinity-fade-up_0.5s_ease-out_both] [animation-delay:${delayMs}ms]`
    return ''
  }

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

  // The intro is a sibling of the loading/loaded branch below, not
  // nested inside it — if it lived inside the `loading` branch, the
  // instant Home's data finished loading it would switch to a
  // completely different JSX subtree and React would unmount/remount
  // CampinityIntro, restarting its animation mid-play. As a stable
  // sibling here, it keeps its own timers running smoothly straight
  // through that transition, regardless of when `loading` resolves.
  if (loading) {
    return (
      <>
        {entranceStage === 'waiting' && (
          <CampinityIntro campusName={profile?.college} onComplete={handleIntroComplete} />
        )}
        <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50 flex items-center justify-center">
          <Loader size="lg" tone="dark" />
        </div>
      </>
    )
  }

  return (
    <>
    {entranceStage === 'waiting' && (
      <CampinityIntro campusName={profile?.college} onComplete={handleIntroComplete} />
    )}
    <div
      className="relative overflow-x-hidden lg:grid lg:h-screen lg:overflow-hidden lg:gap-3 lg:[grid-template-columns:minmax(240px,280px)_minmax(0,1fr)_minmax(260px,320px)]"
      style={{ backgroundColor: '#f8fafc' }}
    ><DesktopSidebar unreadNotifications={unreadCount} profile={profile} />
    <SwipeablePage>
    <div className="min-h-screen w-full max-w-[100vw] lg:max-w-none lg:h-screen lg:overflow-y-auto lg:min-w-0 overflow-x-hidden">
      <div className="mx-auto max-w-[480px] lg:max-w-[760px] min-h-screen lg:min-h-0 bg-white lg:bg-transparent border-x border-gray-100">
        <header className={`sticky top-0 z-40 bg-white border-b border-gray-100 ${entranceClass(0)}`}>
          <div className="h-14 flex items-center gap-3 px-4 lg:px-6">
            <button
              type="button"
              onClick={() => navigate('/home')}
              aria-label="Campinity — go to Home"
              className="lg:hidden flex items-center flex-shrink-0"
            >
              <Logo className="w-7 h-7" withWordmark />
            </button>

            <button
              type="button"
              onClick={() => navigate('/search')}
              className="group relative hidden lg:flex flex-1 max-w-md mx-auto items-center text-left"
              aria-label="Search Campinity"
            >
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors duration-200 group-hover:text-gray-500" />
              <span className="flex items-center justify-between w-full rounded-full border border-gray-200 bg-gray-50 pl-10 pr-2.5 py-2 text-sm text-gray-400 transition-all duration-200 group-hover:bg-white group-hover:border-gray-300 group-hover:shadow-[0_2px_10px_rgba(15,23,42,0.06)]">
                Search for people, communities, posts...
                <kbd className="flex-shrink-0 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">
                  Ctrl K
                </kbd>
              </span>
            </button>

            <div className="flex items-center gap-1 ml-auto">
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
                aria-label="Messages"
                onClick={() => navigate('/messages')}
                className="relative hidden lg:flex w-9 h-9 rounded-full items-center justify-center text-gray-500 hover:bg-gray-100 active:scale-95 transition-all duration-200"
              >
                <MessageCircle className="w-5 h-5" />
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

              {profile && (
                <button
                  type="button"
                  onClick={() => navigate('/profile')}
                  aria-label="Your profile"
                  className="hidden lg:flex items-center ml-1 rounded-full hover:bg-gray-100 p-0.5 transition-all duration-200"
                >
                  <Avatar initials={initials} colorClass={myColorClass} size="sm" src={getProfileIdentityImage(profile) || undefined} />
                </button>
              )}
            </div>
          </div>
        </header>

        {showBanner && <CampusVerificationBanner onDismiss={dismissBanner} />}

        <section className={`mx-4 lg:mx-6 mt-5 mb-5 ${entranceClass(80)}`}>
          <div
            className="relative overflow-hidden rounded-2xl lg:rounded-3xl px-5 py-5 lg:px-7 lg:py-6"
            style={{ background: 'linear-gradient(120deg, #eaf3ff 0%, #dcecff 45%, #e7f7f7 100%)' }}
          >
            <div
              className="absolute -top-10 -right-6 w-40 h-40 rounded-full opacity-60 pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(59,155,255,0.35), transparent 70%)' }}
              aria-hidden="true"
            />
            <div
              className="absolute -bottom-12 right-8 w-32 h-32 rounded-full opacity-50 pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.30), transparent 70%)' }}
              aria-hidden="true"
            />
            <p className="relative text-[11px] font-bold tracking-wide text-blue-700/70 uppercase">
              {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}
            </p>
            <h1 className="relative mt-1 text-2xl lg:text-[28px] font-bold text-gray-900 tracking-tight leading-tight">
              {firstName} 👋
            </h1>
            <p className="relative mt-1.5 text-[13px] lg:text-sm text-gray-500 max-w-xs leading-relaxed">
              Great things happen across campus. Stay connected, stay updated.
            </p>
          </div>

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

          <div className="mt-4">
            <PostComposer profile={profile} initials={initials} colorClass={myColorClass} firstName={firstName} />
          </div>
        </section>

        <section className={`mx-4 lg:mx-6 mb-5 py-0 ${entranceClass(140)}`}>
          <div className="flex items-start gap-3.5 overflow-x-auto scroll-hidden">
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

        <nav className={`sticky top-14 z-30 bg-white flex items-center gap-6 px-4 lg:px-6 border-b border-gray-100 mb-3 ${entranceClass(200)}`}>
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

        <main className={`pb-24 ${entranceClass(200)}`} style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}>
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
