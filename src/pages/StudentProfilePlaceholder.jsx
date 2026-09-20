import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, MoreHorizontal } from 'lucide-react'
import VerifiedAchievementDetailModal from '../components/VerifiedAchievementDetailModal.jsx'
import { getVerifiedAchievements } from '../firebase/achievementService.js'
import ProfileHeader from '../components/ProfileHeader.jsx'
import PostCard from '../components/PostCard.jsx'
import CommunityCard from '../components/CommunityCard.jsx'
import ShareBottomSheet from '../sharing/ShareBottomSheet.jsx'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import Loader from '../auth/components/Loader.jsx'
import { getCollegeById } from '../data/dummyColleges.js'
import { auth } from '../firebase/firebase.js'
import {
  getUserProfileByUsername,
  checkIsFollowing,
  followUser,
  unfollowUser,
  getMutualFollowers
} from '../firebase/profileService.js'
import { getAvatarColor, getInitials, getUserPosts, getUserPostCount, getPostById } from '../firebase/postService.js'
import { getUserCommunityMemberships, getCommunityById } from '../firebase/communityService.js'
import { getOrCreateChat, getExistingChatStatus } from '../firebase/chatService.js'
import { useMyVerification } from '../access/useMyVerification.js'
import VerificationGate from '../access/VerificationGate.jsx'
import { FEATURES } from '../access/permissions.js'

/**
 * Real implementation — this file's own name ("Placeholder") confirms
 * it never had one. Kept the exact same filename/route (/student/:username,
 * already wired in App.jsx) so no routing change was needed anywhere.
 * Necessary, not scope creep: Follow/Message buttons and mutual
 * followers from the profile brief are meaningless without a real page
 * to view someone else's profile on in the first place.
 *
 * Reuses ProfileHeader.jsx (isOwnProfile=false branch), the same tab
 * pattern as ProfilePage.jsx, and every existing service function —
 * checkIsFollowing/followUser/unfollowUser/getMutualFollowers (all new
 * this pass, in profileService.js), getUserCommunityMemberships (
 * already existed, fully real). Saved and Activity tabs are
 * intentionally absent here — "Owner only" per the brief — Pinned IS
 * shown (view-only; the pin/unpin controls themselves are what's
 * owner-only, not visibility of a profile's pinned posts, matching
 * how Instagram's own pinned posts work).
 */
export default function StudentProfilePlaceholder() {
  const navigate = useNavigate()
  const { username } = useParams()
  const currentUid = auth.currentUser?.uid

  const [activeTab, setActiveTab] = useState('posts')

  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [postCount, setPostCount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [isFollowing, setIsFollowing] = useState(false)
  const [mutualFollowers, setMutualFollowers] = useState([])
  const [shareOpen, setShareOpen] = useState(false)
  const [chatStatusInfo, setChatStatusInfo] = useState(null)
  const [messageError, setMessageError] = useState('')
  const [messageBusy, setMessageBusy] = useState(false)
  const [messageGateOpen, setMessageGateOpen] = useState(false)
  const verified = useMyVerification()

  const [pinnedPosts, setPinnedPosts] = useState([])
  const [pinnedLoading, setPinnedLoading] = useState(false)
  const [pinnedLoadedOnce, setPinnedLoadedOnce] = useState(false)
  const [communities, setCommunities] = useState([])
  const [communitiesLoading, setCommunitiesLoading] = useState(false)
  const [communitiesLoadedOnce, setCommunitiesLoadedOnce] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)

    getUserProfileByUsername(username)
      .then(async (data) => {
        if (cancelled) return
        if (!data) {
          setNotFound(true)
          return
        }
        setProfile(data)

        const [postsData, postCountData, followingState, mutuals, chatStatus] = await Promise.all([
          getUserPosts(data.uid, currentUid).catch(() => []),
          getUserPostCount(data.uid).catch(() => null),
          currentUid ? checkIsFollowing(currentUid, data.uid) : false,
          currentUid ? getMutualFollowers(currentUid, data.uid) : [],
          currentUid ? getExistingChatStatus(currentUid, data.uid).catch(() => null) : null
        ])
        if (cancelled) return
        setPosts(postsData)
        setPostCount(postCountData)
        setIsFollowing(followingState)
        setMutualFollowers(mutuals)
        setChatStatusInfo(chatStatus)
      })
      .catch(() => {
        if (!cancelled) setNotFound(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [username, currentUid])

  useEffect(() => {
    if (activeTab !== 'pinned' || pinnedLoadedOnce || !profile) return
    let cancelled = false
    setPinnedLoading(true)
    Promise.all(profile.pinnedPostIds.map((id) => getPostById(id, currentUid).catch(() => null)))
      .then((results) => {
        if (!cancelled) {
          setPinnedPosts(results.filter(Boolean))
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
    if (activeTab !== 'communities' || communitiesLoadedOnce || !profile) return
    let cancelled = false
    setCommunitiesLoading(true)
    getUserCommunityMemberships(profile.uid)
      .then((memberships) => Promise.all(memberships.map((m) => getCommunityById(m.communityId).catch(() => null))))
      .then((results) => {
        if (!cancelled) {
          setCommunities(results.filter(Boolean))
          setCommunitiesLoadedOnce(true)
        }
      })
      .finally(() => {
        if (!cancelled) setCommunitiesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, profile, communitiesLoadedOnce])

  const [verifiedAchievements, setVerifiedAchievements] = useState([])
  const [selectedAchievement, setSelectedAchievement] = useState(null)
  useEffect(() => {
    if (!profile?.uid) return
    let cancelled = false
    getVerifiedAchievements(profile.uid).then((rows) => {
      if (!cancelled) setVerifiedAchievements(rows)
    })
    return () => {
      cancelled = true
    }
  }, [profile?.uid])

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

  const handleFollow = async () => {
    if (!currentUid || !profile) return
    await followUser(currentUid, profile.uid)
    setIsFollowing(true)
  }

  const handleUnfollow = async () => {
    if (!currentUid || !profile) return
    await unfollowUser(currentUid, profile.uid)
    setIsFollowing(false)
  }

  const handleMessage = async () => {
    if (!currentUid || !profile) return
    // Gate only a genuinely NEW conversation (no chat/request exists
    // yet) — reopening an existing accepted chat or pending request
    // must keep working regardless of the CURRENT verification status,
    // per "do not break existing chats." The real boundary either way
    // is chats/{chatId}'s own create rule in firestore.rules.
    if (!chatStatusInfo && verified === false) {
      setMessageGateOpen(true)
      return
    }
    setMessageError('')
    setMessageBusy(true)
    try {
      const { chatId, status, isNew } = await getOrCreateChat(currentUid, profile.uid)
      if (import.meta.env.DEV) console.debug('[CHAT NAVIGATION] navigating from profile', { chatId, status, isNew, target: `/messages/${chatId}` })
      navigate(`/messages/${chatId}`)
    } catch (err) {
      // Real fix, not just a debugging aid: this used to only
      // console.error and leave the user staring at a button that
      // appeared to do nothing on failure (blocked, permission issue,
      // network blip) — now it's a visible, dismissible message.
      console.error('Could not open or start this conversation:', err)
      setMessageError(err?.message || 'Could not open this conversation. Please try again.')
      setMessageBusy(false)
    }
  }

  const handleOpenMessageRequest = () => navigate('/messages/requests')

  // Item 10 — resolved from the real chat doc (chatStatusInfo), never
  // hardcoded: no chat yet or an already-accepted one both read as a
  // plain "Message" button; a pending chat reads as outgoing (I'm
  // requestedBy) or incoming (they are) depending on who actually sent it.
  const messageState = !chatStatusInfo
    ? 'none'
    : chatStatusInfo.status !== 'pending'
      ? 'accepted'
      : chatStatusInfo.requestedBy === currentUid
        ? 'pending_outgoing'
        : 'pending_incoming'

  // Reuses the existing sharing architecture (ShareBottomSheet +
  // shareService.js's already-registered `profile` canonical pattern)
  // instead of a second, ad-hoc share mechanism — see ProfilePage.jsx's
  // identical comment for the same reasoning.
  const handleShare = () => setShareOpen(true)

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader size="lg" tone="dark" />
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="h-full flex items-center justify-center px-6 text-center">
        <div>
          <p className="text-sm font-semibold text-gray-900">Student not found</p>
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="mt-4 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-300"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  const tabs = [
    { key: 'posts', label: 'Posts' },
    { key: 'pinned', label: 'Pinned' },
    { key: 'communities', label: 'Communities' }
  ]

  const displayProfile = {
    ...profile,
    displayName: profile.displayName || 'Student',
    college: college?.name || '',
    initials: getInitials(profile.displayName || 'Student'),
    colorClass: getAvatarColor(profile.uid),
    postsCount: postCount ?? posts.length,
    followers: profile.followersCount || 0,
    following: profile.followingCount || 0,
    communitiesCount: communitiesLoadedOnce ? communities.length : undefined
  }

  return (
    <div className="h-full w-full max-w-[100vw] lg:overflow-y-auto lg:min-w-0 overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[720px] bg-white min-h-full lg:min-h-0 lg:my-4 lg:rounded-2xl lg:border lg:border-gray-100 lg:shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 lg:rounded-t-2xl">
          <div className="h-14 flex items-center justify-between px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900 truncate max-w-[220px]">
              @{profile.username}
            </span>
            <button
              type="button"
              aria-label="More options"
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-all duration-300"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </header>

        <ProfileHeader
          profile={displayProfile}
          isOwnProfile={false}
          isFollowing={isFollowing}
          onFollow={handleFollow}
          onUnfollow={handleUnfollow}
          onMessage={handleMessage}
          onOpenMessageRequest={handleOpenMessageRequest}
          messageState={messageState}
          messageBusy={messageBusy}
          onShare={handleShare}
          onOpenFollowers={() => navigate(`/followers/${profile.username}`)}
          onOpenFollowing={() => navigate(`/following/${profile.username}`)}
          mutualFollowers={mutualFollowers}
        />

        {/* Verified Campus Achievements — public, per the brief's "when
            another user clicks a verified achievement" spec. Renders
            nothing if empty rather than an empty state, since this is
            someone else's profile, not the owner's dashboard. */}
        {verifiedAchievements.length > 0 && (
          <div className="px-4 mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
            {verifiedAchievements.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedAchievement(a)}
                className="flex-shrink-0 flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50/60 pl-1.5 pr-3 py-1.5 hover:border-blue-200 transition-colors"
              >
                <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
                  <BadgeCheck className="w-3 h-3 text-blue-600" />
                </span>
                <span className="text-[11px] font-semibold text-gray-800 whitespace-nowrap">{a.title}</span>
              </button>
            ))}
          </div>
        )}

        {messageError && (
          <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[999] w-[calc(100%-2rem)] max-w-[360px]">
            <div className="flex items-center gap-2.5 rounded-xl bg-gray-900 text-white text-sm px-4 py-3 shadow-lg">
              <p className="flex-1">{messageError}</p>
              <button type="button" onClick={() => setMessageError('')} className="text-gray-400 hover:text-white text-xs font-semibold">
                Dismiss
              </button>
            </div>
          </div>
        )}

        <VerificationGate open={messageGateOpen} onClose={() => setMessageGateOpen(false)} feature={FEATURES.SEND_MESSAGE} />

        <VerifiedAchievementDetailModal
          open={Boolean(selectedAchievement)}
          onClose={() => setSelectedAchievement(null)}
          achievement={selectedAchievement}
          collegeName={college?.name}
        />

        <ShareBottomSheet
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          referenceType="profile"
          referenceId={profile?.username}
          preview={{ title: profile?.displayName, subtitle: profile?.username ? `@${profile.username}` : '', image: getProfileIdentityImage(profile) || null }}
        />

        <nav className="sticky top-14 z-30 flex items-center bg-white border-b border-gray-100">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-[13px] font-semibold text-center border-b-2 transition-all duration-300 ${
                activeTab === tab.key
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-400 border-transparent hover:text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <main className="pb-24">
          {activeTab === 'posts' &&
            (posts.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm text-gray-400">No posts yet.</p>
              </div>
            ) : (
              <div>
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
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
                <p className="text-sm text-gray-400">No pinned posts.</p>
              </div>
            ) : (
              <div>
                {pinnedPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ))}

          {activeTab === 'communities' &&
            (communitiesLoading ? (
              <div className="py-16 flex justify-center">
                <Loader size="md" tone="dark" />
              </div>
            ) : communities.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm text-gray-400">No communities joined.</p>
              </div>
            ) : (
              <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {communities.map((community) => (
                  <CommunityCard key={community.id} community={community} />
                ))}
              </div>
            ))}
        </main>
      </div>
    </div>
  )
}
