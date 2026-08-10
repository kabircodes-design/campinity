import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, X } from 'lucide-react'
import Loader from '../auth/components/Loader.jsx'
import Avatar from '../components/Avatar.jsx'
import VerifiedBadge from '../components/VerifiedBadge.jsx'
import { auth } from '../firebase/firebase.js'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { getUserProfile } from '../firebase/profileService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { acceptRequest, getCommunityById, getMembership, getPendingRequests, rejectRequest } from '../firebase/communityService.js'

/**
 * Owner/admin only, matching CommunitySettingsPage.jsx's own access
 * pattern exactly — checked via a real getMembership() lookup, not
 * assumed from route params. acceptRequest/rejectRequest are pre-
 * existing, complete backend functions (confirmed by reading them
 * directly) — this page is the missing UI in front of them, not a
 * reimplementation.
 */
export default function CommunityJoinRequestsPage() {
  const { communityId } = useParams()
  const navigate = useNavigate()

  const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'forbidden' | 'error'
  const [requests, setRequests] = useState([])
  const [communityName, setCommunityName] = useState('')
  const [actioningUid, setActioningUid] = useState(null)
  const [actionError, setActionError] = useState('')

  const load = async () => {
    setStatus('loading')
    const uid = auth.currentUser?.uid
    if (!uid) {
      setStatus('forbidden')
      return
    }
    try {
      const [community, membership] = await Promise.all([
        getCommunityById(communityId),
        getMembership(communityId, uid)
      ])
      const isOwnerOrAdmin =
        community?.ownerId === uid || membership?.role === 'admin' || membership?.role === 'owner'
      if (!community || !isOwnerOrAdmin) {
        setStatus('forbidden')
        return
      }
      setCommunityName(community.name)

      const pending = await getPendingRequests(communityId)
      const enriched = await Promise.all(
        pending.map(async (req) => {
          const profile = await getUserProfile(req.uid).catch(() => null)
          return {
            ...req,
            displayName: profile?.displayName || 'Student',
            username: profile?.username || '',
            avatar: profile ? getProfileIdentityImage(profile) : '',
            verifiedCampus: profile?.verifiedCampus || false
          }
        })
      )
      setRequests(enriched)
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId])

  const handleAccept = async (uid) => {
    if (actioningUid) return
    setActioningUid(uid)
    setActionError('')
    try {
      await acceptRequest(communityId, uid)
      setRequests((prev) => prev.filter((r) => r.uid !== uid))
    } catch (err) {
      setActionError(err?.message || 'Could not accept this request.')
    } finally {
      setActioningUid(null)
    }
  }

  const handleReject = async (uid) => {
    if (actioningUid) return
    setActioningUid(uid)
    setActionError('')
    try {
      await rejectRequest(communityId, uid)
      setRequests((prev) => prev.filter((r) => r.uid !== uid))
    } catch (err) {
      setActionError(err?.message || 'Could not reject this request.')
    } finally {
      setActioningUid(null)
    }
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <span className="block text-base font-bold tracking-tight text-gray-900">Join Requests</span>
              {communityName && <span className="block text-xs text-gray-400">{communityName}</span>}
            </div>
          </div>
        </header>

        {status === 'loading' && (
          <div className="py-16 flex justify-center">
            <Loader size="md" tone="dark" />
          </div>
        )}

        {status === 'forbidden' && (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-semibold text-gray-900">You don't have access to this page.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-semibold text-gray-900">Couldn't load requests.</p>
            <button type="button" onClick={load} className="mt-4 rounded-full border border-gray-200 text-sm font-semibold px-5 py-2.5">
              Try Again
            </button>
          </div>
        )}

        {status === 'success' && (
          <div className="px-4 py-4">
            {actionError && (
              <p className="mb-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
                {actionError}
              </p>
            )}
            {requests.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm font-semibold text-gray-900">No pending requests</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {requests.map((req) => (
                  <div key={req.uid} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
                    <Avatar initials={getInitials(req.displayName)} colorClass={getAvatarColor(req.uid)} size="md" src={req.avatar || undefined} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{req.displayName}</p>
                        <VerifiedBadge verified={req.verifiedCampus} size="sm" />
                      </div>
                      {req.username && <p className="text-xs text-gray-400 truncate">@{req.username}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAccept(req.uid)}
                      disabled={actioningUid === req.uid}
                      aria-label="Approve"
                      className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(req.uid)}
                      disabled={actioningUid === req.uid}
                      aria-label="Reject"
                      className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 flex items-center justify-center disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
