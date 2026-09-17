import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Lock,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  Tag,
  Users
} from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import PostCard from '../components/PostCard.jsx'
import CommunityCoverEditor from '../components/CommunityCoverEditor.jsx'
import CommunityMemberRow from '../components/community/CommunityMemberRow.jsx'
import CommunitySectionNav from '../components/community/CommunitySectionNav.jsx'
import CommunityRightRail from '../components/community/CommunityRightRail.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { getUserProfiles } from '../firebase/profileService.js'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import {
  acceptRequest,
  banMember,
  deleteCommunity,
  demoteModerator,
  getCommunityChannels,
  getCommunityFeedPosts,
  getCommunityMediaPosts,
  getMembers,
  getMembership,
  getPendingRequests,
  isMemberBanned,
  joinCommunity,
  leaveCommunity,
  promoteToAdmin,
  promoteToModerator,
  rejectRequest,
  removeAdmin,
  removeMember,
  requestToJoin,
  setCommunityMuted,
  subscribeToCommunity,
  transferOwnership
} from '../firebase/communityService.js'
import {
  createCommunityAnnouncementNotifications,
  createCommunityRoleChangedNotification,
  createJoinRequestApprovedNotification
} from '../firebase/notificationService.js'
import { usePostingStatus } from '../context/PostingStatusContext.jsx'
import { getMutedUsers } from '../firebase/muteService.js'

const typeLabels = {
  official_club: 'Official Club',
  study_group: 'Study Group',
  hostel: 'Hostel',
  branch: 'Branch',
  batch: 'Batch',
  society: 'Society',
  event: 'Event',
  custom: 'Custom'
}

const roleFilters = ['All', 'Admins', 'Moderators', 'Members']

/**
 * Community 2.0 — rendered inside AppShell's <Outlet/> (App.jsx moved
 * /community/:communityId into the shared layout-route group), so the
 * persistent DesktopSidebar + global header now come for free instead
 * of this page centering a phone-width card in the middle of an empty
 * desktop viewport. `h-screen lg:h-full flex flex-col overflow-hidden`
 * is the same pattern MessagesPage.jsx already established for a page
 * that needs a fixed, non-scrolling shell with its own internal scroll
 * regions (here: the center feed, the left nav, and the right rail each
 * scroll independently — never the page itself, never more than one
 * region at a time).
 */
export default function CommunityDetailPage() {
  const { communityId } = useParams()
  const navigate = useNavigate()
  const uid = auth.currentUser?.uid

  const [community, setCommunity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeSection, setActiveSection] = useState('Posts')

  const [membership, setMembership] = useState(null)
  const [membershipLoading, setMembershipLoading] = useState(true)
  const [joinError, setJoinError] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [isBanned, setIsBanned] = useState(false)

  const [members, setMembers] = useState([])
  const [membersCursor, setMembersCursor] = useState(null)
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersLoadingMore, setMembersLoadingMore] = useState(false)
  const [memberProfiles, setMemberProfiles] = useState(new Map())
  const [memberActionId, setMemberActionId] = useState(null)
  const [memberActionError, setMemberActionError] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [announcementText, setAnnouncementText] = useState('')
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState(false)
  const [announcementError, setAnnouncementError] = useState('')
  const [announcementSent, setAnnouncementSent] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [posts, setPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [mutedUids, setMutedUids] = useState(new Set())
  const [channels, setChannels] = useState([])
  const [selectedChannelId, setSelectedChannelId] = useState(null) // null = whole community, every channel

  const [mediaPosts, setMediaPosts] = useState([])
  const [mediaLoading, setMediaLoading] = useState(false)

  const [pendingRequests, setPendingRequests] = useState([])
  const [requestActionId, setRequestActionId] = useState(null)
  const [requestActionError, setRequestActionError] = useState('')

  const [aboutProfiles, setAboutProfiles] = useState(new Map())

  const [assetEditor, setAssetEditor] = useState(null) // 'cover' | 'icon' | null
  const [adminMenuOpen, setAdminMenuOpen] = useState(false)

  const isOwner = community?.ownerId === uid
  const isAdmin = isOwner || (community?.admins || []).includes(uid)
  const isModerator = (community?.moderators || []).includes(uid)
  // Post moderation (pin/remove) is owner/admin/moderator — a strictly
  // broader group than isAdmin (which gates community MANAGEMENT: the
  // Settings section, requests, promote/demote). Mirrors firestore.rules'
  // own isCommunityStaff() exactly.
  const canModeratePosts = isAdmin || isModerator

  const sections = ['Posts', 'Members', 'Media', 'About', ...(isAdmin ? ['Settings'] : [])]

  useEffect(() => {
    setLoading(true)
    setNotFound(false)
    const unsubscribe = subscribeToCommunity(communityId, (data) => {
      setCommunity(data)
      setNotFound(!data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [communityId])

  useEffect(() => {
    let cancelled = false
    setMembershipLoading(true)
    Promise.all([getMembership(communityId, uid), isMemberBanned(communityId, uid)])
      .then(([membershipData, banned]) => {
        if (cancelled) return
        setMembership(membershipData)
        setIsBanned(banned)
      })
      .catch(() => {
        if (!cancelled) setMembership(null)
      })
      .finally(() => {
        if (!cancelled) setMembershipLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [communityId, uid])

  const enrichMembers = (memberDocs) => {
    getUserProfiles(memberDocs.map((m) => m.uid)).then((profileMap) => {
      setMemberProfiles((prev) => new Map([...prev, ...profileMap]))
    })
  }

  const loadMembers = () => {
    setMembersLoading(true)
    return getMembers(communityId)
      .then(({ members: data, nextCursor }) => {
        setMembers(data)
        setMembersCursor(nextCursor)
        enrichMembers(data)
      })
      .finally(() => setMembersLoading(false))
  }

  const loadMoreMembers = () => {
    if (!membersCursor || membersLoadingMore) return
    setMembersLoadingMore(true)
    getMembers(communityId, { cursor: membersCursor })
      .then(({ members: data, nextCursor }) => {
        setMembers((prev) => [...prev, ...data])
        setMembersCursor(nextCursor)
        enrichMembers(data)
      })
      .finally(() => setMembersLoadingMore(false))
  }

  useEffect(() => {
    if (activeSection !== 'Members') return
    loadMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, communityId])

  // Loaded once, independent of which section is active — the Posts tab
  // needs it the moment it renders, and it's a single small read (one's
  // own mutedUsers subcollection), not worth re-fetching per tab switch.
  useEffect(() => {
    if (!uid) return
    getMutedUsers(uid)
      .then((docs) => setMutedUids(new Set(docs.map((d) => d.mutedUid))))
      .catch(() => {})
  }, [uid])

  useEffect(() => {
    if (activeSection !== 'Posts') return
    let cancelled = false
    getCommunityChannels(communityId)
      .then((data) => {
        if (!cancelled) setChannels(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [activeSection, communityId])

  useEffect(() => {
    if (activeSection !== 'Posts') return
    let cancelled = false
    setPostsLoading(true)
    getCommunityFeedPosts(communityId, uid, { channelId: selectedChannelId })
      .then(({ posts: data }) => {
        if (!cancelled) setPosts(data)
      })
      .finally(() => {
        if (!cancelled) setPostsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeSection, communityId, uid, selectedChannelId])

  // Mirrors HomePage.jsx's optimistic insertion of a just-created post,
  // scoped the opposite way: Home now excludes community posts, this
  // page includes ONLY the one matching its own communityId. Without
  // this, posting from the community composer (CreatePostPage.jsx,
  // deep-linked via /create with communityId in nav state) and landing
  // back here immediately could race the real createPost() write, which
  // runs in the background after navigation — the post would only
  // appear after a manual refresh.
  const { status: postingStatus, newPost: postingNewPost } = usePostingStatus()
  useEffect(() => {
    if (postingStatus !== 'success' || !postingNewPost) return
    if (postingNewPost.communityId !== communityId) return
    setPosts((prev) => {
      if (prev.some((p) => String(p.id) === String(postingNewPost.id))) return prev
      return [postingNewPost, ...prev]
    })
  }, [postingStatus, postingNewPost, communityId])

  useEffect(() => {
    if (activeSection !== 'Media') return
    let cancelled = false
    setMediaLoading(true)
    getCommunityMediaPosts(communityId, uid)
      .then((data) => {
        if (!cancelled) setMediaPosts(data)
      })
      .finally(() => {
        if (!cancelled) setMediaLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeSection, communityId, uid])

  useEffect(() => {
    if (activeSection !== 'About' || !community) return
    const uids = [community.ownerId, ...(community.admins || [])].filter(Boolean)
    getUserProfiles(uids).then(setAboutProfiles)
  }, [activeSection, community])

  useEffect(() => {
    if (activeSection !== 'Settings' || !isAdmin) return
    let cancelled = false
    getPendingRequests(communityId).then((data) => {
      if (cancelled) return
      setPendingRequests(data)
      getUserProfiles(data.map((r) => r.uid)).then((profileMap) => {
        if (!cancelled) setMemberProfiles((prev) => new Map([...prev, ...profileMap]))
      })
    })
    return () => {
      cancelled = true
    }
  }, [activeSection, isAdmin, communityId])

  const handleJoin = async () => {
    if (!uid) {
      setJoinError('You need to be signed in to join.')
      return
    }
    setIsJoining(true)
    setJoinError('')
    try {
      if (community.privacy === 'private') {
        await requestToJoin(communityId, uid)
        setRequestSent(true)
      } else {
        await joinCommunity(communityId, uid)
        setMembership({ uid, role: 'member' })
      }
    } catch (err) {
      setJoinError(err?.message || 'Could not complete this action.')
    } finally {
      setIsJoining(false)
    }
  }

  const handleCancelRequest = async () => {
    if (!uid || isJoining) return
    setIsJoining(true)
    setJoinError('')
    try {
      await rejectRequest(communityId, uid)
      setRequestSent(false)
    } catch (err) {
      setJoinError(err?.message || 'Could not cancel the request.')
    } finally {
      setIsJoining(false)
    }
  }

  const handleLeave = async () => {
    if (!uid || isJoining) return
    setIsJoining(true)
    setJoinError('')
    try {
      await leaveCommunity(communityId, uid)
      setMembership(null)
      setShowLeaveConfirm(false)
      navigate('/communities')
    } catch (err) {
      setJoinError(err?.message || 'Could not leave this community.')
    } finally {
      setIsJoining(false)
    }
  }

  const handleApprove = async (targetUid) => {
    setRequestActionId(targetUid)
    setRequestActionError('')
    try {
      await acceptRequest(communityId, targetUid)
      setPendingRequests((prev) => prev.filter((req) => req.uid !== targetUid))
      createJoinRequestApprovedNotification({
        targetUid,
        actorUid: uid,
        actorName: auth.currentUser?.displayName || 'A community admin',
        actorAvatar: auth.currentUser?.photoURL || '',
        communityId,
        communityName: community?.name
      }).catch(() => {})
    } catch (err) {
      if (err?.message === 'This request is no longer pending.') {
        setPendingRequests((prev) => prev.filter((req) => req.uid !== targetUid))
      } else {
        setRequestActionError("Couldn't approve this request. Please try again.")
      }
    } finally {
      setRequestActionId(null)
    }
  }

  const handleReject = async (targetUid) => {
    setRequestActionId(targetUid)
    setRequestActionError('')
    try {
      await rejectRequest(communityId, targetUid)
      setPendingRequests((prev) => prev.filter((req) => req.uid !== targetUid))
    } catch {
      setRequestActionError("Couldn't reject this request. Please try again.")
    } finally {
      setRequestActionId(null)
    }
  }

  const withMemberAction = (fn) => async (targetUid) => {
    setMemberActionId(targetUid)
    setMemberActionError('')
    try {
      await fn(targetUid)
      await loadMembers()
    } catch (err) {
      setMemberActionError(err?.message || 'Could not complete this action.')
    } finally {
      setMemberActionId(null)
    }
  }

  const notifyRoleChanged = (targetUid, newRole) => {
    createCommunityRoleChangedNotification({
      targetUid,
      actorUid: uid,
      actorName: auth.currentUser?.displayName || 'A community admin',
      actorAvatar: auth.currentUser?.photoURL || '',
      communityId,
      communityName: community?.name,
      newRole
    }).catch(() => {})
  }

  const handlePromoteModerator = withMemberAction(async (targetUid) => {
    await promoteToModerator(communityId, targetUid)
    notifyRoleChanged(targetUid, 'moderator')
  })
  const handleDemoteModerator = withMemberAction((targetUid) => demoteModerator(communityId, targetUid))
  const handlePromoteAdmin = withMemberAction(async (targetUid) => {
    await promoteToAdmin(communityId, uid, targetUid)
    notifyRoleChanged(targetUid, 'admin')
  })
  const handleRemoveAdmin = withMemberAction((targetUid) => removeAdmin(communityId, uid, targetUid))
  const transferOwnershipAction = withMemberAction((targetUid) => transferOwnership(communityId, uid, targetUid))
  const handleTransferOwnership = (targetUid) => {
    if (!window.confirm('Transfer ownership to this member? You will become an admin instead.')) return
    transferOwnershipAction(targetUid)
  }
  const handleRemoveMember = async (targetUid) => {
    setMemberActionId(targetUid)
    setMemberActionError('')
    try {
      await removeMember(communityId, targetUid)
      setMembers((prev) => prev.filter((m) => m.uid !== targetUid))
    } catch (err) {
      setMemberActionError(err?.message || 'Could not remove this member.')
    } finally {
      setMemberActionId(null)
    }
  }

  const [muteBusy, setMuteBusy] = useState(false)
  const handleToggleMute = async () => {
    if (!uid || !membership || muteBusy) return
    const nextMuted = !membership.muted
    setMuteBusy(true)
    setMembership((prev) => ({ ...prev, muted: nextMuted })) // optimistic
    try {
      await setCommunityMuted(communityId, uid, nextMuted)
    } catch {
      setMembership((prev) => ({ ...prev, muted: !nextMuted })) // roll back
    } finally {
      setMuteBusy(false)
    }
  }

  const handleBanMember = async (targetUid) => {
    setMemberActionId(targetUid)
    setMemberActionError('')
    try {
      await banMember(communityId, uid, targetUid)
      setMembers((prev) => prev.filter((m) => m.uid !== targetUid))
    } catch (err) {
      setMemberActionError(err?.message || 'Could not ban this member.')
    } finally {
      setMemberActionId(null)
    }
  }

  const handleSendAnnouncement = async (event) => {
    event.preventDefault()
    if (!announcementText.trim() || isSendingAnnouncement) return
    setIsSendingAnnouncement(true)
    setAnnouncementError('')
    setAnnouncementSent(false)
    try {
      await createCommunityAnnouncementNotifications({
        communityId,
        communityName: community.name,
        actorUid: uid,
        actorName: auth.currentUser?.displayName || 'A community admin',
        actorAvatar: auth.currentUser?.photoURL || '',
        message: announcementText.trim()
      })
      setAnnouncementText('')
      setAnnouncementSent(true)
      window.setTimeout(() => setAnnouncementSent(false), 2500)
    } catch (err) {
      setAnnouncementError(err?.message || 'Could not send this announcement.')
    } finally {
      setIsSendingAnnouncement(false)
    }
  }

  const handleDeleteCommunity = async () => {
    setIsDeleting(true)
    setDeleteError('')
    try {
      await deleteCommunity(communityId, uid)
      navigate('/communities')
    } catch (err) {
      setDeleteError(err?.message || 'Could not delete this community.')
      setIsDeleting(false)
    }
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: community?.name, url: window.location.href }).catch(() => {})
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).catch(() => {})
    }
  }

  const filteredMembers = useMemo(() => {
    const term = memberSearch.trim().toLowerCase()
    return members.filter((member) => {
      if (roleFilter === 'Admins' && member.role !== 'admin' && member.role !== 'owner') return false
      if (roleFilter === 'Moderators' && member.role !== 'moderator') return false
      if (roleFilter === 'Members' && member.role !== 'member') return false
      if (!term) return true
      const profile = memberProfiles.get(member.uid)
      const haystack = `${profile?.displayName || ''} ${profile?.username || ''}`.toLowerCase()
      return haystack.includes(term)
    })
  }, [members, memberSearch, roleFilter, memberProfiles])

  const visiblePosts = useMemo(() => posts.filter((post) => !mutedUids.has(post.userId)), [posts, mutedUids])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader size="lg" tone="dark" />
      </div>
    )
  }

  if (notFound || !community) {
    return (
      <div className="h-full flex items-center justify-center px-6 text-center">
        <div>
          <p className="text-sm font-semibold text-gray-900">Community not found</p>
          <p className="mt-1 text-sm text-gray-400">It may have been removed.</p>
          <button
            type="button"
            onClick={() => navigate('/communities')}
            className="mt-4 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-300"
          >
            Back to Communities
          </button>
        </div>
      </div>
    )
  }

  const createdDate = community.createdAt?.toDate
    ? community.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : null

  const joinLeaveButton = membershipLoading ? (
    <div className="h-10 w-full lg:w-40 rounded-full bg-gray-100 animate-pulse" />
  ) : isOwner ? (
    <button
      type="button"
      onClick={() => setAdminMenuOpen(true)}
      className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 text-sm font-semibold px-4 py-2.5 hover:bg-amber-100 transition-all duration-200"
    >
      <ShieldCheck className="w-4 h-4" />
      Owner · Manage
    </button>
  ) : membership ? (
    <button
      type="button"
      onClick={() => setShowLeaveConfirm(true)}
      disabled={isJoining}
      className="rounded-full border border-gray-200 text-gray-700 text-sm font-semibold px-5 py-2.5 hover:border-red-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition-all duration-200"
    >
      Leave
    </button>
  ) : requestSent ? (
    <button
      type="button"
      onClick={handleCancelRequest}
      disabled={isJoining}
      className="rounded-full bg-gray-100 text-gray-500 text-sm font-semibold px-5 py-2.5 hover:bg-gray-200 disabled:opacity-50 transition-all duration-200"
    >
      {isJoining ? 'Cancelling…' : 'Cancel Request'}
    </button>
  ) : isBanned ? (
    <div className="rounded-full border border-red-200 bg-red-50 text-red-500 text-center text-sm font-semibold px-4 py-2.5">
      You can't join this community
    </div>
  ) : (
    <button
      type="button"
      onClick={handleJoin}
      disabled={isJoining}
      className="rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 disabled:opacity-50 shadow-[0_2px_12px_rgba(37,99,235,0.25)] transition-all duration-200"
    >
      {isJoining ? 'Please wait…' : community.privacy === 'private' ? 'Request to Join' : 'Join Community'}
    </button>
  )

  return (
    <div className="h-screen lg:h-full flex flex-col overflow-hidden bg-[#f8fafc]">
      {/* ============ HEADER ============ */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100">
        <div className="h-24 lg:h-32 bg-gradient-to-br from-blue-600 to-indigo-700 relative">
          {community.coverImage && (
            <img src={community.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <button
            type="button"
            aria-label="Back to Communities"
            onClick={() => navigate('/communities')}
            className="lg:hidden absolute top-3 left-3 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/45 transition-all duration-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setAssetEditor('cover')}
              className="absolute bottom-2 right-2 rounded-full bg-black/40 backdrop-blur-sm text-white text-[11px] font-semibold px-3 py-1.5 hover:bg-black/55 transition-all duration-200"
            >
              Change cover
            </button>
          )}
        </div>

        <div className="px-4 lg:px-6 pb-4">
          <div className="-mt-8 lg:-mt-9 flex items-end gap-3">
            <div className="relative w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-white border-4 border-white shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0">
              {community.icon ? (
                <img src={community.icon} alt="" className="w-full h-full object-cover" />
              ) : (
                <Users className="w-7 h-7 lg:w-9 lg:h-9 text-blue-600" strokeWidth={1.7} />
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setAssetEditor('icon')}
                  aria-label="Change community icon"
                  className="absolute inset-0 bg-black/0 hover:bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-all duration-200"
                >
                  <span className="text-white text-[10px] font-semibold">Edit</span>
                </button>
              )}
            </div>

            <div className="flex-1 min-w-0 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 pb-1">
              <div className="min-w-0">
                <h1 className="text-lg lg:text-xl font-bold text-gray-900 tracking-tight truncate">{community.name}</h1>
                <p className="text-sm text-gray-400">@{community.handle}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleShare}
                  aria-label="Share community"
                  className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-all duration-200"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                {membership && (
                  <div className="relative">
                    <button
                      type="button"
                      aria-label="Community options"
                      onClick={() => setAdminMenuOpen((v) => !v)}
                      className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-all duration-200"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {adminMenuOpen && (
                      <>
                        <button
                          type="button"
                          aria-label="Close menu"
                          className="fixed inset-0 z-10 cursor-default"
                          onClick={() => setAdminMenuOpen(false)}
                        />
                        <div className="absolute right-0 top-11 z-20 w-52 rounded-xl border border-gray-100 bg-white shadow-lg py-1">
                          <button
                            type="button"
                            disabled={muteBusy}
                            onClick={() => {
                              setAdminMenuOpen(false)
                              handleToggleMute()
                            }}
                            className="w-full text-left px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors duration-150"
                          >
                            {membership.muted ? 'Unmute Community' : 'Mute Community'}
                          </button>
                          {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setAdminMenuOpen(false)
                              navigate(`/community/${communityId}/settings`)
                            }}
                            className="w-full text-left px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                          >
                            Edit community details
                          </button>
                          )}
                          {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setAdminMenuOpen(false)
                              navigate(`/community/${communityId}/requests`)
                            }}
                            className="w-full text-left px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 flex items-center justify-between"
                          >
                            Join requests
                          </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div className="hidden lg:block">{joinLeaveButton}</div>
              </div>
            </div>
          </div>

          {community.description && (
            <p className="mt-3 text-sm text-gray-600 leading-relaxed max-w-2xl">{community.description}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-600 text-[11px] font-semibold px-2.5 py-1">
              {typeLabels[community.type] || 'Community'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-500 text-[11px] font-medium px-2.5 py-1">
              {community.privacy === 'private' && <Lock className="w-3 h-3" />}
              {community.privacy === 'private' ? 'Private' : 'Public'}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
              <Users className="w-3.5 h-3.5" />
              {community.membersCount} members
            </span>
            {createdDate && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                <Calendar className="w-3.5 h-3.5" />
                Since {createdDate}
              </span>
            )}
          </div>

          <div className="mt-3 lg:hidden">
            {joinLeaveButton}
            {joinError && <p className="mt-2 text-xs text-red-500 text-center">{joinError}</p>}
          </div>
          {joinError && <p className="hidden lg:block mt-2 text-xs text-red-500">{joinError}</p>}
        </div>

        <div className="lg:hidden">
          <CommunitySectionNav
            orientation="horizontal"
            sections={sections}
            activeSection={activeSection}
            onSelect={setActiveSection}
            badges={{ Settings: pendingRequests.length }}
          />
        </div>
      </div>

      {/* ============ BODY ============ */}
      <div className="flex-1 min-h-0 lg:flex lg:overflow-hidden">
        <aside className="hidden lg:flex lg:w-56 lg:flex-shrink-0 lg:h-full lg:overflow-y-auto border-r border-gray-100 bg-white">
          <CommunitySectionNav
            orientation="vertical"
            sections={sections}
            activeSection={activeSection}
            onSelect={setActiveSection}
            badges={{ Settings: pendingRequests.length }}
          />
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto lg:h-full">
          <div className="max-w-2xl mx-auto px-4 py-4 lg:px-6 lg:py-5">
            {activeSection === 'Posts' && (
              <>
                {channels.length > 0 && (
                  <div className="flex items-center gap-1.5 mb-4 overflow-x-auto scroll-hidden">
                    <button
                      type="button"
                      onClick={() => setSelectedChannelId(null)}
                      className={`flex-shrink-0 rounded-full text-xs font-semibold px-3 py-1.5 transition-all duration-200 ${
                        selectedChannelId === null ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      All
                    </button>
                    {channels.map((channel) => (
                      <button
                        key={channel.id}
                        type="button"
                        onClick={() => setSelectedChannelId(channel.id)}
                        className={`flex-shrink-0 rounded-full text-xs font-semibold px-3 py-1.5 transition-all duration-200 ${
                          selectedChannelId === channel.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        #{channel.name}
                      </button>
                    ))}
                  </div>
                )}

                {membership && (
                  <button
                    type="button"
                    onClick={() => navigate('/create', { state: { communityId, channelId: selectedChannelId || 'general' } })}
                    className="w-full flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 mb-4 text-left hover:border-gray-200 hover:shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition-all duration-200"
                  >
                    <Avatar
                      initials="+"
                      colorClass="from-blue-500 to-blue-600"
                      size="sm"
                      src={auth.currentUser?.photoURL || undefined}
                    />
                    <span className="flex-1 text-sm text-gray-400">
                      Share something in #{channels.find((c) => c.id === selectedChannelId)?.name?.toLowerCase() || 'general'}…
                    </span>
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Plus className="w-4 h-4" strokeWidth={2.2} />
                    </span>
                  </button>
                )}

                {postsLoading ? (
                  <div className="py-16 flex justify-center">
                    <Loader size="md" tone="dark" />
                  </div>
                ) : posts.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-3xl">👋</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">Nothing here yet</p>
                    <p className="mt-1 text-sm text-gray-400">
                      {membership ? 'Start the first conversation in this community.' : 'Join to start the conversation.'}
                    </p>
                    {membership && (
                      <button
                        type="button"
                        onClick={() => navigate('/create', { state: { communityId } })}
                        className="mt-4 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-200"
                      >
                        Create Post
                      </button>
                    )}
                  </div>
                ) : visiblePosts.length === 0 ? (
                  // Every post here happens to be from someone this viewer
                  // muted — distinct from "the community has no posts,"
                  // so it gets its own honest message rather than the
                  // "Nothing here yet" empty state above.
                  <div className="py-16 text-center">
                    <p className="text-sm text-gray-400">All posts here are from muted members.</p>
                  </div>
                ) : (
                  <div className="-mx-4 lg:-mx-6">
                    {[...visiblePosts].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        canModerate={canModeratePosts}
                        onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
                        onPinChanged={(postId, nextPinned) =>
                          setPosts((prev) =>
                            prev.map((p) => ({ ...p, pinned: p.id === postId ? nextPinned : nextPinned ? false : p.pinned }))
                          )
                        }
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {activeSection === 'Members' && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(event) => setMemberSearch(event.target.value)}
                      placeholder="Search members…"
                      className="w-full rounded-full border border-gray-200 bg-gray-50 pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-200"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mb-3 overflow-x-auto scroll-hidden">
                  {roleFilters.map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setRoleFilter(filter)}
                      className={`flex-shrink-0 rounded-full text-xs font-semibold px-3 py-1.5 transition-all duration-200 ${
                        roleFilter === filter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>

                {memberActionError && (
                  <p role="alert" className="mb-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
                    {memberActionError}
                  </p>
                )}

                {membersLoading ? (
                  <div className="py-16 flex justify-center">
                    <Loader size="md" tone="dark" />
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-sm text-gray-400">No members match this search.</p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {filteredMembers.map((member) => (
                      <CommunityMemberRow
                        key={member.uid}
                        member={member}
                        profile={memberProfiles.get(member.uid) || null}
                        isOwner={isOwner}
                        canManage={isAdmin && member.role !== 'owner' && member.uid !== uid}
                        canManageAdmins={isAdmin && member.role !== 'owner' && member.uid !== uid}
                        busy={memberActionId === member.uid}
                        onPromoteModerator={handlePromoteModerator}
                        onDemoteModerator={handleDemoteModerator}
                        onPromoteAdmin={handlePromoteAdmin}
                        onRemoveAdmin={handleRemoveAdmin}
                        onTransferOwnership={handleTransferOwnership}
                        onRemove={handleRemoveMember}
                        onBan={isAdmin && member.role !== 'owner' && member.uid !== uid ? handleBanMember : undefined}
                        onMuteChanged={(targetUid, muted) =>
                          setMutedUids((prev) => {
                            const next = new Set(prev)
                            if (muted) next.add(targetUid)
                            else next.delete(targetUid)
                            return next
                          })
                        }
                      />
                    ))}
                  </div>
                )}

                {membersCursor && !memberSearch && roleFilter === 'All' && (
                  <button
                    type="button"
                    onClick={loadMoreMembers}
                    disabled={membersLoadingMore}
                    className="mt-3 w-full rounded-full border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 hover:border-gray-300 disabled:opacity-50 transition-all duration-200"
                  >
                    {membersLoadingMore ? 'Loading…' : 'Load more members'}
                  </button>
                )}
              </div>
            )}

            {activeSection === 'About' && (
              <div className="space-y-5 text-sm text-gray-600 leading-relaxed">
                <p>{community.description}</p>
                {community.rules && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Rules</p>
                    <p className="whitespace-pre-wrap">{community.rules}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Type</p>
                    <p className="text-sm">{typeLabels[community.type] || 'Community'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Privacy</p>
                    <p className="text-sm">{community.privacy === 'private' ? 'Private' : 'Public'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Members</p>
                    <p className="text-sm">{community.membersCount}</p>
                  </div>
                  {createdDate && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Created</p>
                      <p className="text-sm">{createdDate}</p>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Owner</p>
                  <PersonChip uid={community.ownerId} profile={aboutProfiles.get(community.ownerId)} />
                </div>
                {community.admins?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Admins</p>
                    <div className="flex flex-wrap gap-2">
                      {community.admins.map((adminUid) => (
                        <PersonChip key={adminUid} uid={adminUid} profile={aboutProfiles.get(adminUid)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeSection === 'Media' &&
              (mediaLoading ? (
                <div className="py-16 flex justify-center">
                  <Loader size="md" tone="dark" />
                </div>
              ) : mediaPosts.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-3xl">📷</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">No photos or videos yet</p>
                  <p className="mt-1 text-sm text-gray-400">Media shared in this community will show up here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1">
                  {mediaPosts.map((post) => (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => navigate(`/post/${post.id}`)}
                      className="aspect-square overflow-hidden rounded-md bg-gray-100 hover:opacity-90 transition-opacity duration-200"
                    >
                      <img src={post.imagePreviewUrl} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              ))}

            {activeSection === 'Settings' && isAdmin && (
              <div className="space-y-8">
                <section>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Community profile</p>
                  <button
                    type="button"
                    onClick={() => navigate(`/community/${communityId}/settings`)}
                    className="w-full rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold py-3 hover:border-gray-300 transition-all duration-200"
                  >
                    Edit name, description, avatar & cover
                  </button>
                </section>

                <section>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Moderation — Announcement</p>
                  <form onSubmit={handleSendAnnouncement}>
                    <textarea
                      rows={3}
                      value={announcementText}
                      onChange={(event) => setAnnouncementText(event.target.value)}
                      disabled={isSendingAnnouncement}
                      maxLength={280}
                      placeholder="Share an update with every member..."
                      className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-200"
                    />
                    {announcementError && <p className="mt-1.5 text-xs text-red-500">{announcementError}</p>}
                    {announcementSent && <p className="mt-1.5 text-xs text-emerald-600">Sent to every member.</p>}
                    <button
                      type="submit"
                      disabled={!announcementText.trim() || isSendingAnnouncement}
                      className="mt-2 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 disabled:opacity-50 transition-all duration-200"
                    >
                      {isSendingAnnouncement ? 'Sending…' : 'Send to All Members'}
                    </button>
                  </form>
                </section>

                <section>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Moderation — Pending Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
                  </p>
                  {requestActionError && (
                    <p role="alert" className="mb-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
                      {requestActionError}
                    </p>
                  )}
                  {pendingRequests.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">No pending requests.</p>
                  ) : (
                    <ul className="space-y-2">
                      {pendingRequests.map((req) => {
                        const profile = memberProfiles.get(req.uid)
                        return (
                          <li key={req.uid} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
                            <PersonChip uid={req.uid} profile={profile} plain />
                            <button
                              type="button"
                              onClick={() => handleApprove(req.uid)}
                              disabled={requestActionId === req.uid}
                              className="rounded-full bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50 transition-all duration-200"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReject(req.uid)}
                              disabled={requestActionId === req.uid}
                              className="rounded-full border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-1.5 hover:border-red-200 hover:bg-red-50 disabled:opacity-50 transition-all duration-200"
                            >
                              Reject
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>

                {isOwner && (
                  <section className="pt-6 border-t border-gray-100">
                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">Danger zone</p>
                    {!showDeleteConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-full rounded-full border border-red-200 text-red-500 text-sm font-semibold py-3 hover:bg-red-50 transition-all duration-200"
                      >
                        Delete Community
                      </button>
                    ) : (
                      <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
                        <p className="text-sm font-semibold text-gray-900">Delete this community?</p>
                        <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                          This permanently deletes the community, its members, and pending requests. Posts made in it
                          stay up but will show as belonging to a deleted community. This can't be undone.
                        </p>
                        {deleteError && <p className="mt-2 text-xs text-red-600">{deleteError}</p>}
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(false)}
                            disabled={isDeleting}
                            className="flex-1 rounded-full border border-gray-200 text-gray-600 text-xs font-semibold py-2.5 disabled:opacity-50 transition-all duration-200"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleDeleteCommunity}
                            disabled={isDeleting}
                            className="flex-1 rounded-full bg-red-500 text-white text-xs font-semibold py-2.5 hover:bg-red-600 disabled:opacity-50 transition-all duration-200"
                          >
                            {isDeleting ? 'Deleting…' : 'Yes, delete it'}
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                )}
              </div>
            )}
          </div>
        </main>

        <aside className="hidden xl:flex xl:w-80 xl:flex-shrink-0 xl:h-full xl:overflow-y-auto border-l border-gray-100 bg-white">
          <div className="w-full">
            <CommunityRightRail
              community={community}
              onViewMembers={() => setActiveSection('Members')}
              onViewAbout={() => setActiveSection('About')}
            />
          </div>
        </aside>
      </div>

      {isAdmin && assetEditor && (
        <CommunityCoverEditor
          open={!!assetEditor}
          onClose={() => setAssetEditor(null)}
          communityId={communityId}
          kind={assetEditor}
          onSaved={(url) => {
            setCommunity((prev) => (prev ? { ...prev, [assetEditor === 'cover' ? 'coverImage' : 'icon']: url } : prev))
          }}
        />
      )}

      {showLeaveConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-6">
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => !isJoining && setShowLeaveConfirm(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-[340px] rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-base font-bold text-gray-900">Leave {community.name}?</p>
            <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
              You'll stop seeing posts from this community and will need to rejoin to come back.
            </p>
            {joinError && <p className="mt-2 text-xs text-red-500">{joinError}</p>}
            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                disabled={isJoining}
                className="flex-1 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold py-2.5 hover:border-gray-300 disabled:opacity-50 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLeave}
                disabled={isJoining}
                className="flex-1 rounded-full bg-red-600 text-white text-sm font-semibold py-2.5 hover:bg-red-700 disabled:opacity-50 transition-all duration-200"
              >
                {isJoining ? 'Leaving…' : 'Leave'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PersonChip({ uid, profile, plain }) {
  const navigate = useNavigate()
  const displayName = profile?.displayName || 'Student'
  const goToProfile = () => {
    if (profile?.username) navigate(`/student/${profile.username}`)
  }
  const content = (
    <>
      <Avatar
        initials={getInitials(displayName)}
        colorClass={getAvatarColor(uid)}
        size="sm"
        src={profile ? getProfileIdentityImage(profile) || undefined : undefined}
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
        {profile?.username && <p className="text-xs text-gray-400 truncate">@{profile.username}</p>}
      </div>
    </>
  )
  if (plain) {
    return <div className="flex-1 min-w-0 flex items-center gap-2.5">{content}</div>
  }
  return (
    <button type="button" onClick={goToProfile} className="flex items-center gap-2 rounded-full border border-gray-100 pl-1 pr-3 py-1 hover:border-gray-200 transition-all duration-200">
      {content}
    </button>
  )
}
