import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MoreHorizontal } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import ProfileHeader from '../components/ProfileHeader.jsx'
import PostCard from '../components/PostCard.jsx'
import CommunityCard from '../components/CommunityCard.jsx'
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
import { getAvatarColor, getInitials, getUserPosts, getPostById } from '../firebase/postService.js'
import { getUserCommunityMemberships, getCommunityById } from '../firebase/communityService.js'
import { getOrCreateChat } from '../firebase/chatService.js'

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
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [isFollowing, setIsFollowing] = useState(false)
  const [mutualFollowers, setMutualFollowers] = useState([])

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

        const [postsData, followingState, mutuals] = await Promise.all([
          getUserPosts(data.uid, currentUid).catch(() => []),
          currentUid ? checkIsFollowing(currentUid, data.uid) : false,
          currentUid ? getMutualFollowers(currentUid, data.uid) : []
        ])
        if (cancelled) return
        setPosts(postsData)
        setIsFollowing(followingState)
        setMutualFollowers(mutuals)
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
    try {
      const { chatId } = await getOrCreateChat(currentUid, profile.uid)
      navigate(`/messages/${chatId}`)
    } catch (err) {
      console.error('Could not open or start this conversation:', err)
    }
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: profile?.displayName, url: window.location.href }).catch(() => {})
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).catch(() => {})
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50 flex items-center justify-center">
        <Loader size="lg" tone="dark" />
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
        <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm flex items-center justify-center px-6 text-center">
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
        <BottomNav />
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
    college: college?.name || '',
    initials: getInitials(profile.displayName),
    colorClass: getAvatarColor(profile.uid),
    postsCount: posts.length,
    followers: profile.followersCount || 0,
    following: profile.followingCount || 0,
    communitiesCount: communitiesLoadedOnce ? communities.length : undefined
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
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
          onShare={handleShare}
          onOpenFollowers={() => navigate(`/followers/${profile.username}`)}
          onOpenFollowing={() => navigate(`/following/${profile.username}`)}
          mutualFollowers={mutualFollowers}
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

      <BottomNav />
    </div>
  )
}
