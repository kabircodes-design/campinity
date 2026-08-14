import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Lock, MoreHorizontal, Share2, Tag, Users } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import BottomNav from '../components/BottomNav.jsx'
import CommunityCoverEditor from '../components/CommunityCoverEditor.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import {
  acceptRequest,
  deleteCommunity,
  demoteModerator,
  getCommunityFeedPosts,
  getCommunityMediaPosts,
  getMembers,
  getMembership,
  getPendingRequests,
  joinCommunity,
  leaveCommunity,
  promoteToModerator,
  rejectRequest,
  removeMember,
  requestToJoin,
  subscribeToCommunity,
  transferOwnership
} from '../firebase/communityService.js'
import { createCommunityAnnouncementNotifications } from '../firebase/notificationService.js'

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

const tabs = ['Posts', 'Members', 'About', 'Media', 'Settings']

/**
 * Layout follows PostDetailPage.jsx's header/back-button pattern.
 * community doc is a LIVE subscription (subscribeToCommunity) so
 * membersCount updates in real time as people join/leave while the
 * page is open — everything else here (membership status, members
 * list, pending requests, community posts) is a one-shot fetch,
 * matching Phase 2's "realtime listeners only where necessary."
 *
 * Settings tab only renders its content for the owner/an admin — but
 * this page can't actually DO anything there yet (edit/delete
 * community, manage admins) since that UI wasn't asked for in this
 * pass; it shows the pending-requests approve/reject list (which IS
 * asked for) and leaves the rest as a clearly-labeled "coming soon"
 * rather than fabricating controls with no backing action.
 * Known gap, not hidden: the Members and Settings-requests lists below
 * render a member's raw uid as their name (via getInitials(member.uid)),
 * because Phase 1's member/request docs only store uid/role/joinedAt —
 * no display name or avatar. Fetching each member's profile individually
 * would mean N+1 Firestore reads per page visit, which conflicts with
 * this phase's own "avoid unnecessary reads" requirement. The correct
 * fix is denormalizing displayName/avatar onto the member doc at
 * join-time (a communityService.js change), not a per-row fetch here.
 */
export default function CommunityDetailPage() {
  const { communityId } = useParams()
  const navigate = useNavigate()

  const [community, setCommunity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState('Posts')

  const [membership, setMembership] = useState(null)
  const [membershipLoading, setMembershipLoading] = useState(true)
  const [joinError, setJoinError] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [requestSent, setRequestSent] = useState(false)

  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [memberActionId, setMemberActionId] = useState(null)
  const [memberActionError, setMemberActionError] = useState('')

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [announcementText, setAnnouncementText] = useState('')
  const [isSendingAnnouncement, setIsSendingAnnouncement] = useState(false)
  const [announcementError, setAnnouncementError] = useState('')
  const [announcementSent, setAnnouncementSent] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [posts, setPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(false)

  const [mediaPosts, setMediaPosts] = useState([])
  const [mediaLoading, setMediaLoading] = useState(false)

  const [pendingRequests, setPendingRequests] = useState([])
  const [requestActionId, setRequestActionId] = useState(null)

  const uid = auth.currentUser?.uid
  const isOwner = community?.ownerId === uid
  const isAdmin = isOwner || (community?.admins || []).includes(uid)
  const [assetEditor, setAssetEditor] = useState(null) // 'cover' | 'icon' | null

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
    getMembership(communityId, uid)
      .then((data) => {
        if (!cancelled) setMembership(data)
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

  const loadMembers = () => {
    setMembersLoading(true)
    return getMembers(communityId)
      .then(({ members: data }) => setMembers(data))
      .finally(() => setMembersLoading(false))
  }

  useEffect(() => {
    if (activeTab !== 'Members') return
    let cancelled = false
    setMembersLoading(true)
    getMembers(communityId)
      .then(({ members: data }) => {
        if (!cancelled) setMembers(data)
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, communityId])

  useEffect(() => {
    if (activeTab !== 'Posts') return
    let cancelled = false
    setPostsLoading(true)
    getCommunityFeedPosts(communityId)
      .then(({ posts: data }) => {
        if (!cancelled) setPosts(data)
      })
      .finally(() => {
        if (!cancelled) setPostsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, communityId])

  useEffect(() => {
    if (activeTab !== 'Media') return
    let cancelled = false
    setMediaLoading(true)
    getCommunityMediaPosts(communityId)
      .then((data) => {
        if (!cancelled) setMediaPosts(data)
      })
      .finally(() => {
        if (!cancelled) setMediaLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, communityId])

  useEffect(() => {
    if (activeTab !== 'Settings' || !isAdmin) return
    let cancelled = false
    getPendingRequests(communityId).then((data) => {
      if (!cancelled) setPendingRequests(data)
    })
    return () => {
      cancelled = true
    }
  }, [activeTab, isAdmin, communityId])

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
    } catch (err) {
      setJoinError(err?.message || 'Could not leave this community.')
    } finally {
      setIsJoining(false)
    }
  }

  const handleApprove = async (targetUid) => {
    setRequestActionId(targetUid)
    try {
      await acceptRequest(communityId, targetUid)
      setPendingRequests((prev) => prev.filter((req) => req.uid !== targetUid))
    } catch {
      // Row just stays put on failure — admin can retry.
    } finally {
      setRequestActionId(null)
    }
  }

  const handleReject = async (targetUid) => {
    setRequestActionId(targetUid)
    try {
      await rejectRequest(communityId, targetUid)
      setPendingRequests((prev) => prev.filter((req) => req.uid !== targetUid))
    } catch {
      // Row just stays put on failure — admin can retry.
    } finally {
      setRequestActionId(null)
    }
  }

  const handlePromote = async (targetUid) => {
    setMemberActionId(targetUid)
    setMemberActionError('')
    try {
      await promoteToModerator(communityId, targetUid)
      await loadMembers()
    } catch (err) {
      setMemberActionError(err?.message || 'Could not promote this member.')
    } finally {
      setMemberActionId(null)
    }
  }

  const handleDemote = async (targetUid) => {
    setMemberActionId(targetUid)
    setMemberActionError('')
    try {
      await demoteModerator(communityId, targetUid)
      await loadMembers()
    } catch (err) {
      setMemberActionError(err?.message || 'Could not demote this member.')
    } finally {
      setMemberActionId(null)
    }
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

  const handleTransferOwnership = async (targetUid) => {
    if (!window.confirm('Transfer ownership to this member? You will become an admin instead.')) return
    setMemberActionId(targetUid)
    setMemberActionError('')
    try {
      await transferOwnership(communityId, uid, targetUid)
      await loadMembers()
    } catch (err) {
      setMemberActionError(err?.message || 'Could not transfer ownership.')
    } finally {
      setMemberActionId(null)
    }
  }

  const handleDeleteCommunity = async () => {
    setIsDeleting(true)
    setDeleteError('')
    try {
      await deleteCommunity(communityId, uid)
      navigate('/home')
    } catch (err) {
      setDeleteError(err?.message || 'Could not delete this community.')
      setIsDeleting(false)
    }
  }

  /**
   * Actor identity uses auth.currentUser?.displayName directly — this
   * page never loads the current user's own Firestore profile (only
   * the community's data), and adding that fetch just for this one
   * label felt like more than this feature needed. Firebase Auth's own
   * displayName field may or may not be populated depending on how
   * signup sets it elsewhere in this project (unverified — I don't
   * have that flow); falls back to "A community admin" if empty rather
   * than showing a blank name.
   */
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

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: community?.name, url: window.location.href }).catch(() => {})
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

  if (notFound || !community) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
        <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm flex items-center justify-center px-6 text-center">
          <div>
            <p className="text-sm font-semibold text-gray-900">Community not found</p>
            <p className="mt-1 text-sm text-gray-400">It may have been removed.</p>
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

  const createdDate = community.createdAt?.toDate
    ? community.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : null

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm pb-24">
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
              {community.name}
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

        <div className="h-32 bg-gradient-to-br from-blue-600 to-indigo-700 relative">
          {community.coverImage && (
            <img src={community.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
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

        <div className="px-4">
          <div className="-mt-8 flex items-end gap-3">
            <div className="relative w-16 h-16 rounded-2xl bg-white border-4 border-white shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0">
              {community.icon ? (
                <img src={community.icon} alt="" className="w-full h-full object-cover" />
              ) : (
                <Users className="w-7 h-7 text-blue-600" strokeWidth={1.7} />
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
            <button
              type="button"
              onClick={handleShare}
              aria-label="Share community"
              className="mb-1 ml-auto w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-all duration-300"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>

          <h1 className="mt-3 text-xl font-bold text-gray-900 tracking-tight">{community.name}</h1>
          <p className="text-sm text-gray-400">@{community.handle}</p>

          <p className="mt-2.5 text-sm text-gray-600 leading-relaxed">{community.description}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-600 text-[11px] font-semibold px-2.5 py-1">
              {typeLabels[community.type] || 'Community'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-500 text-[11px] font-medium px-2.5 py-1">
              {community.privacy === 'private' ? <Lock className="w-3 h-3" /> : null}
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

          {community.tags?.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {community.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                  <Tag className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4">
            {membershipLoading ? (
              <div className="h-11 rounded-full bg-gray-100 animate-pulse" />
            ) : isOwner ? (
              <div className="rounded-full border border-gray-200 text-center text-sm font-semibold text-gray-500 py-3">
                You own this community
              </div>
            ) : membership ? (
              <button
                type="button"
                onClick={handleLeave}
                disabled={isJoining}
                className="w-full rounded-full border border-gray-200 text-gray-700 text-sm font-semibold py-3 hover:border-red-300 hover:text-red-500 disabled:opacity-50 transition-all duration-300"
              >
                {isJoining ? 'Leaving…' : 'Leave Community'}
              </button>
            ) : requestSent ? (
              <button
                type="button"
                onClick={handleCancelRequest}
                disabled={isJoining}
                className="w-full rounded-full bg-gray-100 text-gray-600 text-sm font-semibold py-3 hover:bg-gray-200 disabled:opacity-50 transition-all duration-300"
              >
                {isJoining ? 'Cancelling…' : 'Cancel Request'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleJoin}
                disabled={isJoining}
                className="w-full rounded-full bg-blue-600 text-white text-sm font-semibold py-3 hover:bg-blue-700 disabled:opacity-50 transition-all duration-300"
              >
                {isJoining ? 'Please wait…' : community.privacy === 'private' ? 'Request to Join' : 'Join Community'}
              </button>
            )}
            {joinError && <p className="mt-2 text-xs text-red-500 text-center">{joinError}</p>}
          </div>
        </div>

        <nav className="mt-5 sticky top-14 z-30 flex items-center bg-white border-b border-gray-100 overflow-x-auto scroll-hidden">
          {tabs
            .filter((tab) => tab !== 'Settings' || isAdmin)
            .map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-shrink-0 px-4 py-3 text-[13px] font-semibold text-center border-b-2 transition-all duration-300 ${
                  activeTab === tab ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-600'
                }`}
              >
                {tab}
              </button>
            ))}
        </nav>

        <main className="px-4 py-4">
          {activeTab === 'Posts' &&
            (postsLoading ? (
              <div className="py-16 flex justify-center">
                <Loader size="md" tone="dark" />
              </div>
            ) : posts.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm font-semibold text-gray-900">No posts yet</p>
                <p className="mt-1 text-sm text-gray-400">
                  {membership ? 'Be the first to post here.' : 'Join to start the conversation.'}
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {posts.map((post) => (
                  <li key={post.id} className="rounded-xl border border-gray-100 p-3.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        initials={getInitials(post.author?.displayName)}
                        colorClass={getAvatarColor(post.userId)}
                        size="sm"
                      />
                      <p className="text-sm font-semibold text-gray-900">{post.author?.displayName || 'Student'}</p>
                    </div>
                    {post.text && <p className="mt-2 text-sm text-gray-700 leading-relaxed">{post.text}</p>}
                    {post.imageUrl && (
                      <img src={post.imageUrl} alt="" className="mt-2 rounded-lg w-full max-h-64 object-cover" />
                    )}
                  </li>
                ))}
              </ul>
            ))}

          {activeTab === 'Members' &&
            (membersLoading ? (
              <div className="py-16 flex justify-center">
                <Loader size="md" tone="dark" />
              </div>
            ) : (
              <>
                {memberActionError && (
                  <p role="alert" className="mb-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
                    {memberActionError}
                  </p>
                )}
                <ul className="space-y-1">
                  {members.map((member) => {
                    const joinedLabel = member.joinedAt?.toDate
                      ? member.joinedAt.toDate().toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
                      : null
                    const isThisMemberOwner = member.role === 'owner'
                    const isThisMemberBusy = memberActionId === member.uid
                    const canManage = isAdmin && !isThisMemberOwner && member.uid !== uid

                    return (
                      <li key={member.uid} className="py-2">
                        <div className="flex items-center gap-3">
                          <Avatar initials={getInitials(member.uid)} colorClass={getAvatarColor(member.uid)} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700 truncate">{member.uid}</p>
                            {joinedLabel && <p className="text-[11px] text-gray-400">Joined {joinedLabel}</p>}
                          </div>
                          {member.role !== 'member' && (
                            <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">
                              {member.role}
                            </span>
                          )}
                        </div>

                        {canManage && (
                          <div className="mt-2 ml-11 flex flex-wrap gap-1.5">
                            {member.role === 'moderator' ? (
                              <button
                                type="button"
                                onClick={() => handleDemote(member.uid)}
                                disabled={isThisMemberBusy}
                                className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 disabled:opacity-50 rounded-full border border-gray-200 px-2.5 py-1 transition-all duration-300"
                              >
                                Demote to Member
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handlePromote(member.uid)}
                                disabled={isThisMemberBusy}
                                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50 rounded-full border border-blue-200 px-2.5 py-1 transition-all duration-300"
                              >
                                Promote to Moderator
                              </button>
                            )}
                            {isOwner && (
                              <button
                                type="button"
                                onClick={() => handleTransferOwnership(member.uid)}
                                disabled={isThisMemberBusy}
                                className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 disabled:opacity-50 rounded-full border border-gray-200 px-2.5 py-1 transition-all duration-300"
                              >
                                Make Owner
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member.uid)}
                              disabled={isThisMemberBusy}
                              className="text-[11px] font-semibold text-red-500 hover:text-red-600 disabled:opacity-50 rounded-full border border-red-200 px-2.5 py-1 transition-all duration-300"
                            >
                              {isThisMemberBusy ? 'Working…' : 'Remove'}
                            </button>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </>
            ))}

          {activeTab === 'About' && (
            <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
              <p>{community.description}</p>
              {community.rules && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Rules</p>
                  <p className="whitespace-pre-wrap">{community.rules}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Type</p>
                  <p className="text-sm">{typeLabels[community.type] || 'Community'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Privacy</p>
                  <p className="text-sm">{community.privacy === 'private' ? 'Private' : 'Public'}</p>
                </div>
                {createdDate && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Created</p>
                    <p className="text-sm">{createdDate}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Media' &&
            (mediaLoading ? (
              <div className="py-16 flex justify-center">
                <Loader size="md" tone="dark" />
              </div>
            ) : mediaPosts.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-gray-400">No photos posted here yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {mediaPosts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => navigate(`/post/${post.id}`)}
                    className="aspect-square overflow-hidden rounded-md bg-gray-100"
                  >
                    <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            ))}

          {activeTab === 'Settings' && isAdmin && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Send Announcement</p>
              <form onSubmit={handleSendAnnouncement} className="mb-6">
                <textarea
                  rows={3}
                  value={announcementText}
                  onChange={(event) => setAnnouncementText(event.target.value)}
                  disabled={isSendingAnnouncement}
                  maxLength={280}
                  placeholder="Share an update with every member..."
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
                />
                {announcementError && <p className="mt-1.5 text-xs text-red-500">{announcementError}</p>}
                {announcementSent && <p className="mt-1.5 text-xs text-emerald-600">Sent to every member.</p>}
                <button
                  type="submit"
                  disabled={!announcementText.trim() || isSendingAnnouncement}
                  className="mt-2 w-full rounded-full bg-blue-600 text-white text-sm font-semibold py-2.5 hover:bg-blue-700 disabled:opacity-50 transition-all duration-300"
                >
                  {isSendingAnnouncement ? 'Sending…' : 'Send to All Members'}
                </button>
              </form>

              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Pending Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
              </p>
              {pendingRequests.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">No pending requests.</p>
              ) : (
                <ul className="space-y-2">
                  {pendingRequests.map((req) => (
                    <li key={req.uid} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
                      <Avatar initials={getInitials(req.uid)} colorClass={getAvatarColor(req.uid)} size="sm" />
                      <span className="text-sm text-gray-700 flex-1 truncate">{req.uid}</span>
                      <button
                        type="button"
                        onClick={() => handleApprove(req.uid)}
                        disabled={requestActionId === req.uid}
                        className="rounded-full bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50 transition-all duration-300"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(req.uid)}
                        disabled={requestActionId === req.uid}
                        className="rounded-full border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-1.5 hover:border-gray-300 disabled:opacity-50 transition-all duration-300"
                      >
                        Reject
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-8 pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => navigate(`/community/${communityId}/settings`)}
                  className="w-full rounded-full border border-gray-200 text-gray-700 text-sm font-semibold py-3 hover:border-gray-300 transition-all duration-300"
                >
                  Edit Community Details
                </button>
              </div>

              {isOwner && (
                <div className="mt-4 pt-6 border-t border-gray-100">
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">Danger zone</p>
                  {!showDeleteConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full rounded-full border border-red-200 text-red-500 text-sm font-semibold py-3 hover:bg-red-50 transition-all duration-300"
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
                          className="flex-1 rounded-full border border-gray-200 text-gray-600 text-xs font-semibold py-2.5 disabled:opacity-50 transition-all duration-300"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteCommunity}
                          disabled={isDeleting}
                          className="flex-1 rounded-full bg-red-500 text-white text-xs font-semibold py-2.5 hover:bg-red-600 disabled:opacity-50 transition-all duration-300"
                        >
                          {isDeleting ? 'Deleting…' : 'Yes, delete it'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
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

      <BottomNav />
    </div>
  )
}
