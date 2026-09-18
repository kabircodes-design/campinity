import { useEffect, useState } from 'react'
import { Ban, ShieldOff, UserX, Users, X } from 'lucide-react'
import { useAdminSession } from '../hooks/useAdminSession.jsx'
import { callAdmin } from '../services/adminCallable.js'
import AdminToast from '../components/AdminToast.jsx'

/**
 * New admin surface — communities had no admin-panel presence at all
 * before this. Reuses the exact communities/communityMembers/
 * communityBans schema and remove/ban semantics communityService.js's
 * client-side owner/admin actions already established (see that file's
 * removeMember/banMember) — adminModerateCommunityMember (Cloud
 * Function) mirrors that same transaction via the Admin SDK, since a
 * platform admin using only the password session has no real community
 * role for firestore.rules to recognize.
 */
export default function AdminCommunitiesPage() {
  const { sessionToken } = useAdminSession()
  const [communities, setCommunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [toast, setToast] = useState(null)

  const load = () => {
    setLoading(true)
    setError('')
    callAdmin('adminListCommunities', { sessionToken, pageSize: 40 })
      .then((data) => setCommunities(data?.communities || []))
      .catch((err) => setError(err?.message || 'Could not load communities.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [sessionToken])

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">Communities</h1>
      <p className="mt-1 text-sm text-gray-400">Browse communities and manage their membership.</p>

      <div className="mt-5">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-gray-100 bg-white p-4 h-[72px] animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-400">{error}</p>
            <button type="button" onClick={load} className="mt-3 text-sm font-semibold text-blue-600">
              Retry
            </button>
          </div>
        ) : communities.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-gray-900">No communities yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {communities.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c)}
                className="text-left flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3.5 hover:border-gray-200 hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)] transition-all duration-200"
              >
                <div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                  {c.icon || c.coverImage ? (
                    <img src={c.icon || c.coverImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-4.5 h-4.5 text-gray-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                  <p className="text-xs text-gray-400 truncate capitalize">
                    {c.type} · {c.membersCount || 0} member{c.membersCount === 1 ? '' : 's'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <CommunityMembersDrawer
          sessionToken={sessionToken}
          community={selected}
          onClose={() => setSelected(null)}
          onToast={setToast}
        />
      )}

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

function CommunityMembersDrawer({ sessionToken, community, onClose, onToast }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioningUid, setActioningUid] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)

  const load = () => {
    setLoading(true)
    setError('')
    callAdmin('adminListCommunityMembers', { sessionToken, communityId: community.id, pageSize: 100 })
      .then((data) => setMembers(data?.members || []))
      .catch((err) => setError(err?.message || 'Could not load members.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [community.id])

  const handleAction = async (member, action) => {
    if (actioningUid) return
    setActioningUid(member.uid)
    setConfirmTarget(null)
    try {
      await callAdmin('adminModerateCommunityMember', { sessionToken, communityId: community.id, targetUid: member.uid, action })
      if (action === 'remove' || action === 'ban') {
        setMembers((prev) => prev.filter((m) => m.uid !== member.uid))
      }
      onToast({
        tone: 'success',
        message: action === 'remove' ? `${member.displayName} removed.` : action === 'ban' ? `${member.displayName} banned.` : `${member.displayName} unbanned.`
      })
    } catch (err) {
      onToast({ tone: 'error', message: err?.message || 'Could not complete this action.' })
    } finally {
      setActioningUid(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[999] bg-black/40 flex items-end sm:items-center justify-center">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0" />
      <div className="relative w-full sm:max-w-[440px] bg-white rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="min-w-0">
            <p className="text-base font-bold text-gray-900 truncate">{community.name}</p>
            <p className="text-xs text-gray-400">{members.length} member{members.length === 1 ? '' : 's'} loaded</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex-shrink-0 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto -mx-1 px-1">
          {loading ? (
            <div className="py-10 flex justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin" />
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">{error}</p>
              <button type="button" onClick={load} className="mt-2 text-xs font-semibold text-blue-600">
                Retry
              </button>
            </div>
          ) : members.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">No members found.</div>
          ) : (
            <div className="space-y-1.5">
              {members.map((m) => (
                <div key={m.uid} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-gray-900 truncate">{m.displayName}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {m.username && `@${m.username} · `}
                      <span className="capitalize">{m.role}</span>
                    </p>
                  </div>
                  {m.role !== 'owner' && (
                    <div className="flex-shrink-0 flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Remove member"
                        title="Remove"
                        onClick={() => setConfirmTarget({ member: m, action: 'remove' })}
                        disabled={actioningUid === m.uid}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40 transition-colors duration-150"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Ban member"
                        title="Ban"
                        onClick={() => setConfirmTarget({ member: m, action: 'ban' })}
                        disabled={actioningUid === m.uid}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 transition-colors duration-150"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {confirmTarget && (
          <div className="mt-3 flex-shrink-0 rounded-xl bg-red-50 border border-red-200 p-3.5">
            <p className="text-sm text-red-700 flex items-center gap-1.5">
              <ShieldOff className="w-3.5 h-3.5 flex-shrink-0" />
              {confirmTarget.action === 'remove'
                ? `Remove ${confirmTarget.member.displayName} from this community?`
                : `Ban ${confirmTarget.member.displayName} from this community?`}
            </p>
            <div className="mt-2.5 flex gap-2">
              <button type="button" onClick={() => setConfirmTarget(null)} className="flex-1 rounded-full border border-gray-200 bg-white text-sm font-semibold py-2">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAction(confirmTarget.member, confirmTarget.action)}
                className="flex-1 rounded-full bg-red-600 text-white text-sm font-semibold py-2"
              >
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
