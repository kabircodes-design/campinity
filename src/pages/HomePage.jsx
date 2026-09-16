import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Sparkles, UserPlus } from 'lucide-react'
import StoryBubble from '../components/StoryBubble.jsx'
import StoryViewer from '../components/StoryViewer.jsx'
import PostCard from '../components/PostCard.jsx'
import PostComposer from '../components/PostComposer.jsx'
import DesktopRightRail from '../components/DesktopRightRail.jsx'
import NotesView from '../components/NotesView.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { getFeedPosts, getAvatarColor, getInitials, getNotesPosts } from '../firebase/postService.js'
import { getFeedStories, getViewedStoryIds } from '../firebase/storyService.js'
import { getTrendingCommunities } from '../firebase/communityService.js'
import { useAuth } from '../context/AuthContext.jsx'

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

  // profile now comes from the shared AuthContext (see AppShell.jsx) —
  // this page previously fetched it independently just to feed a
  // header/sidebar it no longer renders itself, plus its own greeting/
  // PostComposer/story-avatar usage below (unchanged, still reads
  // `profile`, just from context now).
  const { profile } = useAuth()
  const [posts, setPosts] = useState([])
  const [stories, setStories] = useState([])
  const [storiesLoading, setStoriesLoading] = useState(true)
  const [viewedStoryIds, setViewedStoryIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [contentPreferences, setContentPreferences] = useState([])

  useEffect(() => {
    const types = profile?.preferences?.contentTypes
    if (Array.isArray(types) && types.length > 0) setContentPreferences(types)
  }, [profile])

  useEffect(() => {
    let cancelled = false
    const uid = auth.currentUser?.uid

    // Split from stories deliberately (Stories 2.0, Part 13) — Home's
    // own loading gate previously awaited getFeedStories() and
    // getViewedStoryIds() in the SAME Promise.all as the post feed,
    // meaning the entire page stayed on a full-screen spinner until
    // both stories queries resolved too. Posts now drive `loading`
    // alone; stories load independently below and populate the tray
    // progressively whenever they're ready, never blocking the feed.
    const loadPosts = async () => {
      try {
        const postsData = await getFeedPosts(uid)
        if (!cancelled) {
          const now = Date.now()
          const activePosts = postsData.filter((p) => !p.expiresAtMs || p.expiresAtMs > now)
          setPosts(activePosts)
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not load the feed.')
      }
    }

    loadPosts().finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const uid = auth.currentUser?.uid

    const loadStories = async () => {
      try {
        const [storiesData, viewedIds] = await Promise.all([getFeedStories(), getViewedStoryIds(uid)])
        if (!cancelled) {
          setStories(storiesData)
          setViewedStoryIds(viewedIds)
        }
      } catch {
        // Stories failing to load is never fatal to Home — the tray
        // just stays at "Your Story" only; no error banner for a
        // secondary feature failing independently of the main feed.
      } finally {
        if (!cancelled) setStoriesLoading(false)
      }
    }

    loadStories()

    return () => {
      cancelled = true
    }
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

  // The subset of storyBubbles that actually have something to view —
  // excludes "More" (never viewable) and "Your Story" when the user
  // has no active stories yet (opens the composer instead, handled in
  // StoryBubble.jsx). This is what the shared viewer's cross-group
  // navigation (Part 11) steps through — index i's Next at its last
  // story goes to index i+1 here, skipping bubbles with nothing to show.
  const viewableGroups = useMemo(() => storyBubbles.filter((s) => !s.isMore && s.stories?.length > 0), [storyBubbles])
  const [openGroupIndex, setOpenGroupIndex] = useState(null)

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
        <div className="h-full flex items-center justify-center">
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
    <div className="h-full lg:grid lg:gap-3 lg:[grid-template-columns:minmax(0,1fr)_minmax(260px,320px)] lg:overflow-hidden">
    <SwipeablePage>
    <div className="h-full w-full max-w-[100vw] lg:max-w-none lg:overflow-y-auto lg:min-w-0 overflow-x-hidden">
      <div className="mx-auto max-w-[480px] lg:max-w-[760px] min-h-full lg:min-h-0 bg-white dark:bg-[#11131a] border-x border-gray-100 dark:border-white/10 lg:my-4 lg:rounded-2xl lg:border lg:shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:lg:shadow-none">
        {showBanner && <CampusVerificationBanner onDismiss={dismissBanner} />}

        <section className={`mx-4 lg:mx-6 mt-5 mb-5 ${entranceClass(0)}`}>
          <div
            className="relative overflow-hidden rounded-2xl lg:rounded-3xl px-5 py-5 lg:px-7 lg:py-6 bg-gradient-to-br from-[#eaf3ff] via-[#dcecff] to-[#e7f7f7] dark:from-[#141a2e] dark:via-[#121629] dark:to-[#101f21]"
          >
            <div
              className="absolute -top-10 -right-6 w-40 h-40 rounded-full opacity-60 dark:opacity-25 pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(59,155,255,0.35), transparent 70%)' }}
              aria-hidden="true"
            />
            <div
              className="absolute -bottom-12 right-8 w-32 h-32 rounded-full opacity-50 dark:opacity-20 pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.30), transparent 70%)' }}
              aria-hidden="true"
            />
            <p className="relative text-[11px] font-bold tracking-wide text-blue-700/70 dark:text-blue-300/80 uppercase">
              {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}
            </p>
            <h1 className="relative mt-1 text-2xl lg:text-[28px] font-bold text-gray-900 dark:text-gray-50 tracking-tight leading-tight">
              {firstName} 👋
            </h1>
            <p className="relative mt-1.5 text-[13px] lg:text-sm text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">
              Great things happen across campus. Stay connected, stay updated.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/search')}
            className="group relative mt-4 w-full text-left lg:hidden"
            aria-label="Search Campinity"
          >
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 transition-colors duration-200 group-hover:text-gray-500 dark:group-hover:text-gray-400" />
            <span className="block w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 pl-10 pr-4 py-2.5 text-sm text-gray-400 dark:text-gray-500 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:shadow-none transition-all duration-200 group-hover:bg-white dark:group-hover:bg-white/10 group-hover:border-gray-300 dark:group-hover:border-white/20 group-hover:shadow-[0_2px_10px_rgba(15,23,42,0.06)] dark:group-hover:shadow-none">
              Search Campinity
            </span>
          </button>

          <div className="mt-4">
            <PostComposer profile={profile} initials={initials} colorClass={myColorClass} firstName={firstName} />
          </div>
        </section>

        <section className={`mx-4 lg:mx-6 mb-5 py-0 ${entranceClass(80)}`}>
          <div className="flex items-start gap-3.5 overflow-x-auto scroll-hidden">
            {/* "Your Story" never waits on the stories fetch — it only
                needs `profile`, already loaded by the time Home renders. */}
            <StoryBubble story={storyBubbles[0]} seen={false} onOpen={() => setOpenGroupIndex(viewableGroups.findIndex((g) => g.id === storyBubbles[0].id))} />

            {storiesLoading ? (
              // Lightweight skeleton (Part 13) — everyone else's
              // stories populate progressively without ever blocking
              // Home's own render.
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 w-16 flex-shrink-0">
                  <div className="w-[60px] h-[60px] rounded-full bg-gray-100 dark:bg-white/10 animate-pulse" />
                  <div className="h-2 w-10 rounded bg-gray-100 dark:bg-white/10 animate-pulse" />
                </div>
              ))
            ) : (
              storyBubbles.slice(1).map((story) => {
                const seen = story.stories?.length > 0 ? story.stories.every((s) => viewedStoryIds.has(s.id)) : false
                return (
                  <StoryBubble
                    key={story.id}
                    story={story}
                    seen={seen}
                    onOpen={() => setOpenGroupIndex(viewableGroups.findIndex((g) => g.id === story.id))}
                  />
                )
              })
            )}
          </div>
        </section>

        {openGroupIndex !== null && viewableGroups[openGroupIndex] && (
          <StoryViewer
            groups={viewableGroups}
            groupIndex={openGroupIndex}
            onClose={() => setOpenGroupIndex(null)}
            onChangeGroup={setOpenGroupIndex}
            onViewed={(storyId) => setViewedStoryIds((prev) => new Set(prev).add(storyId))}
            onDeleted={(storyId) => {
              setStories((prev) =>
                prev
                  .map((group) => ({ ...group, stories: group.stories.filter((s) => s.id !== storyId) }))
                  .filter((group) => group.stories.length > 0)
              )
            }}
          />
        )}

        {/* top-14 (not top-0) is intentional and mobile-only: on mobile
            this nav shares ONE document-level scroll with AppShell's own
            sticky h-14 header (that div has no `lg:overflow-y-auto` of
            its own below `lg:`), so top-14 is what clears that header.
            On desktop, AppShell's header lives in a separate flex row
            outside this page's own `lg:overflow-y-auto` container — that
            container's top edge already starts below the header, so a
            sticky child inside it only needs top-0. Leaving this at
            top-14 unconditionally was the actual cause of "content peeks
            through a gap while scrolling on desktop" — the nav was
            sticking 56px lower than the container's real top. */}
        {/* Equal-width grid, not content-sized flex children — the nav
            itself was already full-width (a direct child of Home's own
            correctly-sized feed column, no extra wrapper capping it);
            the actual bug was that 4 plain flex buttons only ever took
            up as much width as their own text needed, leaving the rest
            of that already-full-width row blank on the right. Active
            state now matches DesktopSidebar.jsx's own real treatment
            (bg-blue-50/text-blue-600 — confirmed by reading it, not a
            new "pink" language) instead of the old underline indicator. */}
        <nav className={`sticky top-14 lg:top-0 z-30 bg-white dark:bg-[#11131a] grid grid-cols-4 gap-1 px-4 lg:px-6 py-1.5 border-b border-gray-100 dark:border-white/10 mb-3 ${entranceClass(140)}`}>
          {feedTabs.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-xl py-2 text-[14px] font-semibold text-center transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400'
                    : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>

        <main className={`pb-24 ${entranceClass(140)}`} style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}>
          {activeTab === 'notes' ? (
            <NotesView />
          ) : activeTab === 'following' ? (
            followingError ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm text-gray-400 dark:text-gray-500">{followingError}</p>
              </div>
            ) : followingLoading ? (
              <div className="py-16 flex justify-center">
                <Loader size="md" tone="dark" />
              </div>
            ) : !isFollowingAnyone ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">Nothing here yet</p>
                <p className="mt-1 text-sm text-gray-400 dark:text-gray-500 max-w-[260px] mx-auto leading-relaxed">
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
                <div className="mx-auto w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center">
                  <UserPlus className="w-4.5 h-4.5 text-blue-500 dark:text-blue-400" />
                </div>
                <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-50">Your feed is waiting.</p>
                <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Follow people to see what they're sharing.</p>
              </div>
            ) : (
              followingPosts.map((post) => <PostCard key={post.id} post={post} />)
            )
          ) : activeTab === 'forYou' ? (
            forYouError ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm text-gray-400 dark:text-gray-500">{forYouError}</p>
              </div>
            ) : forYouLoading ? (
              <div className="py-16 flex justify-center">
                <Loader size="md" tone="dark" />
              </div>
            ) : forYouPosts.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto w-11 h-11 rounded-full bg-amber-50 dark:bg-amber-500/15 flex items-center justify-center">
                  <Sparkles className="w-4.5 h-4.5 text-amber-500 dark:text-amber-400" />
                </div>
                <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-50">Your campus is quiet... for now.</p>
                <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Be the first to share something.</p>
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
                  <p className="py-8 text-center text-xs text-gray-400 dark:text-gray-500">You're all caught up.</p>
                )}
              </>
            )
          ) : error ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">{error}</p>
            </div>
          ) : visiblePosts.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto w-11 h-11 rounded-full bg-amber-50 flex items-center justify-center">
                <Sparkles className="w-4.5 h-4.5 text-amber-500" />
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-50">Your campus is quiet... for now.</p>
              <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Be the first to share something.</p>
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

      <PostingStatusPill />

      <CampusVerificationModal open={showModal} onRemindLater={closeModal} />
    </>
  )
}
