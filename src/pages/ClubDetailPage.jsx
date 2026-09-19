import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Clock, Lock, MoreHorizontal, Send, Users } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { getAvatarColor, getInitials, createPost, formatTimeAgo } from '../firebase/postService.js'
import {
  getCommunityById,
  subscribeToCommunity,
  subscribeToCommunityFeedPosts,
  getMembership,
  joinCommunity,
  leaveCommunity,
  requestToJoin
} from '../firebase/communityService.js'
import { useMyVerification } from '../access/useMyVerification.js'
import VerificationGate from '../access/VerificationGate.jsx'
import { FEATURES } from '../access/permissions.js'

/**
 * A CLUB is a genuinely different EXPERIENCE from a Community, even
 * though it's the exact same backend entity (communities/{id} with
 * type='official_club') and the exact same posts/{postId} schema
 * (communityId-scoped, same createPost() call CreatePostPage.jsx
 * already uses) — per this task's explicit "reuse existing post
 * architecture with a context identifier, not a second incompatible
 * post system" instruction. What's different here is purely how it's
 * PRESENTED: a continuous, live, oldest-to-newest discussion thread
 * with an inline bottom composer, instead of Community's card-based,
 * newest-first feed — Campinity's own take on "a club is a focused,
 * ongoing conversation," not a copy of any specific existing app's chat
 * UI (no bubbles-on-alternating-sides, no read receipts — this is a
 * shared group discussion, not a 1:1 DM).
 *
 * Admin/moderation is NOT reimplemented here — the "..." menu links to
 * the exact same /community/:id/settings route and CommunitySettingsPage
 * every Community already uses (a club is a community row underneath),
 * so promote/demote/remove/ban all go through that one already-existing,
 * already-secured implementation.
 */
export default function ClubDetailPage() {
  const { communityId } = useParams()
  const navigate = useNavigate()
  const { profile: myProfile } = useAuth()
  const uid = auth.currentUser?.uid
  const verified = useMyVerification()
  const [verificationGateOpen, setVerificationGateOpen] = useState(false)

  const [club, setClub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [membership, setMembership] = useState(null)
  const [joinBusy, setJoinBusy] = useState(false)
  const [messages, setMessages] = useState([])
  const [messagesLoaded, setMessagesLoaded] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    getCommunityById(communityId)
      .then((data) => {
        if (cancelled) return
        if (!data) {
          setNotFound(true)
        } else {
          setClub(data)
        }
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setNotFound(true)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [communityId])

  useEffect(() => {
    if (!communityId) return undefined
    const unsubscribe = subscribeToCommunity(communityId, (data) => {
      if (data) setClub(data)
    })
    return unsubscribe
  }, [communityId])

  useEffect(() => {
    if (!communityId || !uid) return undefined
    getMembership(communityId, uid).then(setMembership)
  }, [communityId, uid])

  useEffect(() => {
    if (!communityId) return undefined
    const unsubscribe = subscribeToCommunityFeedPosts(communityId, uid, (data) => {
      setMessages(data)
      setMessagesLoaded(true)
    })
    return unsubscribe
  }, [communityId, uid])

  useEffect(() => {
    if (!messagesLoaded) return
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, messagesLoaded])

  const isMember = membership?.role === 'member' || membership?.role === 'admin' || membership?.role === 'owner'
  const isOwnerOrAdmin = membership?.role === 'owner' || membership?.role === 'admin'
  const isPrivate = club?.privacy === 'private'

  const handleJoin = async () => {
    if (!uid || joinBusy) return
    setJoinBusy(true)
    try {
      if (isPrivate) {
        await requestToJoin(communityId, uid)
        setMembership({ role: 'pending' })
      } else {
        await joinCommunity(communityId, uid)
        setMembership({ role: 'member' })
      }
    } catch {
      // best-effort — button just stays in its current state on failure, matches CommunityCard.jsx's own pattern
    } finally {
      setJoinBusy(false)
    }
  }

  const handleLeave = async () => {
    if (!uid || joinBusy) return
    setJoinBusy(true)
    try {
      await leaveCommunity(communityId, uid)
      setMembership(null)
    } catch {
      // best-effort
    } finally {
      setJoinBusy(false)
    }
  }

  const handleSend = async (event) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || sending || !uid) return
    // Same server-side rule every other post-creation surface in this
    // app is already gated by (posts/{postId}'s create rule requires
    // isVerified()) — checked proactively here too, matching
    // CreatePostPage.jsx's own VerificationGate pattern, instead of
    // just letting the Firestore write fail and showing a raw error.
    if (verified === false) {
      setVerificationGateOpen(true)
      return
    }
    setSending(true)
    setSendError('')
    try {
      await createPost({
        uid,
        text,
        imageUrl: null,
        author: {
          displayName: myProfile?.displayName || 'Student',
          username: myProfile?.username || '',
          profilePhoto: getProfileIdentityImage(myProfile) || ''
        },
        extra: {
          category: 'general',
          communityId,
          communityName: club?.name || ''
        }
      })
      setDraft('')
    } catch (err) {
      setSendError(err?.message || "Couldn't send that. Try again.")
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader size="md" tone="dark" />
      </div>
    )
  }

  if (notFound || !club) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm font-semibold text-gray-900">This club couldn't be found.</p>
        <button
          type="button"
          onClick={() => navigate('/communities')}
          className="rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5"
        >
          Back to Clubs
        </button>
      </div>
    )
  }

  return (
    <div className="h-screen lg:h-full flex flex-col overflow-hidden bg-white">
      <header
        className="flex-shrink-0 flex items-center gap-3 px-3 lg:px-6 h-14 lg:h-16 border-b border-gray-100"
        style={{ background: 'linear-gradient(135deg, #f7f9ff 0%, #f6f2ff 100%)' }}
      >
        <button
          type="button"
          aria-label="Back"
          onClick={() => navigate('/communities')}
          className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-gray-500 hover:bg-white/70 transition-all duration-200"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          {club.icon ? <img src={club.icon} alt="" className="w-full h-full object-cover" /> : <Users className="w-4 h-4 text-white" />}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 truncate flex items-center gap-1">
            {club.name}
            {isPrivate && <Lock className="w-3 h-3 text-gray-400 flex-shrink-0" />}
          </p>
          <p className="text-[11px] text-gray-500">{club.membersCount} member{club.membersCount === 1 ? '' : 's'}</p>
        </div>

        {membership?.role === 'pending' ? (
          <span className="flex-shrink-0 flex items-center gap-1 rounded-full bg-gray-100 text-gray-400 text-xs font-semibold px-3 py-1.5">
            <Clock className="w-3 h-3" /> Requested
          </span>
        ) : isMember ? (
          <button
            type="button"
            onClick={handleLeave}
            disabled={joinBusy}
            className="flex-shrink-0 flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold px-3 py-1.5 hover:bg-gray-200 transition-all duration-200 disabled:opacity-60"
          >
            <Check className="w-3 h-3" strokeWidth={2.5} /> Joined
          </button>
        ) : (
          <button
            type="button"
            onClick={handleJoin}
            disabled={joinBusy}
            className="flex-shrink-0 rounded-full bg-indigo-600 text-white text-xs font-semibold px-3.5 py-1.5 hover:bg-indigo-700 transition-all duration-200 disabled:opacity-60"
          >
            {isPrivate ? 'Request to Join' : 'Join'}
          </button>
        )}

        {isOwnerOrAdmin && (
          <button
            type="button"
            aria-label="Club settings"
            onClick={() => navigate(`/community/${communityId}/settings`)}
            className="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-gray-500 hover:bg-white/70 transition-all duration-200"
          >
            <MoreHorizontal className="w-4.5 h-4.5" />
          </button>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 lg:px-6 py-4">
        {!messagesLoaded ? (
          <div className="py-16 flex justify-center">
            <Loader size="sm" tone="dark" />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-500" />
            </div>
            <p className="mt-3 text-sm font-semibold text-gray-900">No discussion yet</p>
            <p className="mt-1 text-sm text-gray-400 max-w-[260px] mx-auto leading-relaxed">
              Be the first to say something in {club.name}.
            </p>
          </div>
        ) : (
          <div className="max-w-[680px] mx-auto space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="flex items-start gap-2.5">
                <Avatar
                  initials={message.initials}
                  colorClass={message.avatarColor}
                  size="sm"
                  src={message.avatarUrl || undefined}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="text-[13px] font-semibold text-gray-900 truncate">{message.name}</p>
                    <p className="text-[10.5px] text-gray-400 flex-shrink-0">{message.time}</p>
                  </div>
                  <div className="mt-0.5 inline-block rounded-2xl rounded-tl-sm bg-gray-50 px-3.5 py-2 text-[13.5px] text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                    {message.text}
                  </div>
                  {message.imagePreviewUrl && (
                    <img
                      src={message.imagePreviewUrl}
                      alt=""
                      className="mt-1.5 max-w-[280px] rounded-xl border border-gray-100 object-cover"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-gray-100 bg-white px-3 lg:px-6 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {!isMember ? (
          <p className="text-center text-xs text-gray-400 py-2">
            {membership?.role === 'pending' ? 'Your request to join is pending approval.' : `Join ${club.name} to take part in the discussion.`}
          </p>
        ) : (
          <form onSubmit={handleSend} className="max-w-[680px] mx-auto flex items-center gap-2">
            <input
              type="text"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value)
                setSendError('')
              }}
              maxLength={500}
              placeholder={`Message ${club.name}...`}
              disabled={sending}
              className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all duration-200"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!draft.trim() || sending}
              className="w-10 h-10 flex-shrink-0 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 transition-all duration-200"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
        {sendError && <p className="mt-1.5 text-center text-xs text-red-500">{sendError}</p>}
      </div>

      <VerificationGate open={verificationGateOpen} onClose={() => setVerificationGateOpen(false)} feature={FEATURES.CREATE_POST} />
    </div>
  )
}
