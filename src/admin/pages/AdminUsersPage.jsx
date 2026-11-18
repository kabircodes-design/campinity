import { useCallback, useEffect, useRef, useState } from 'react'
import { BadgeCheck, Ban, ChevronRight, Flag, History, Search, ShieldCheck, ShieldOff, UserCheck, Users as UsersIcon } from 'lucide-react'
import { useAdminSession } from '../hooks/useAdminSession.jsx'
import { useAdminWorkspace } from '../hooks/useAdminWorkspace.jsx'
import { callAdmin } from '../services/adminCallable.js'
import CollegeSearch from '../../components/CollegeSearch.jsx'
import AdminToast from '../components/AdminToast.jsx'
import { Badge, Button, Card, ConfirmDialog, Drawer, EmptyState, ErrorState, KeyValue, PageHeader, Skeleton, fmtDateTime, fmtNumber, fmtRelative } from '../components/ui.jsx'
import { ACTION_LABELS } from '../utils/auditLogFormat.js'

/**
 * Users workspace.
 *  Reads:   adminSearchUsers (search / filtered browse, cursor-paginated),
 *           adminGetUserDetail (profile, stats, reports, moderation history).
 *  Actions: adminSetUserModerationStatus ('suspended' | 'active') and
 *           adminSetUserVerification — both pre-existing, session-gated and
 *           audit-logged on the server. Every action is confirmed first.
 *
 * Deliberately NOT offered:
 *  - "Restrict": the status exists, but nothing in the app enforces it
 *    (only 'suspended' is checked by Firestore rules), so offering it
 *    would imply a protection that doesn't exist. Existing restricted
 *    users are shown and can be restored.
 *  - Ban / account disable: there is no backend for it.
 *  - Email or any private field: the server never returns them.
 */

const VERIFIED_OPTIONS = [
  ['', 'Any verification'],
  ['true', 'Campus verified'],
  ['false', 'Not verified']
]
const STATUS_OPTIONS = [
  ['', 'Any status'],
  ['active', 'Active'],
  ['suspended', 'Suspended'],
  ['restricted', 'Restricted']
]

function Avatar({ user, size = 36 }) {
  const url = user.avatarMode === 'campus' ? user.campusAvatarUrl : user.avatar
  const ok = typeof url === 'string' && /^https?:\/\//.test(url)
  const initial = (user.displayName || user.username || '?').trim().charAt(0).toUpperCase()
  return ok ? (
    <img src={url} alt="" width={size} height={size} className="rounded-full object-cover flex-shrink-0 bg-gray-100" style={{ width: size, height: size }} loading="lazy" />
  ) : (
    <span className="rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-semibold flex-shrink-0" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
      {initial}
    </span>
  )
}

export function StatusBadge({ status }) {
  if (status === 'suspended') return <Badge tone="rose"><Ban className="w-3 h-3" /> Suspended</Badge>
  if (status === 'restricted') return <Badge tone="amber">Restricted</Badge>
  return <Badge tone="emerald">Active</Badge>
}

function Select({ value, onChange, options, label }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-[13px] text-gray-900 outline-none focus:border-blue-500"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  )
}

function UserDetail({ uid, onChanged, onToast }) {
  const { sessionToken } = useAdminSession()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    callAdmin('adminGetUserDetail', { sessionToken, uid })
      .then(setData)
      .catch((err) => setError(err?.message || 'Could not load this user.'))
      .finally(() => setLoading(false))
  }, [sessionToken, uid])
  useEffect(load, [load])

  const run = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      if (confirm.kind === 'status') await callAdmin('adminSetUserModerationStatus', { sessionToken, uid, status: confirm.value })
      else await callAdmin('adminSetUserVerification', { sessionToken, uid, verified: confirm.value })
      onToast({ tone: 'success', message: confirm.done })
      setConfirm(null)
      load()
      onChanged?.()
    } catch (err) {
      onToast({ tone: 'error', message: err?.message || 'That action failed. Nothing was changed.' })
    } finally {
      setBusy(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    )
  }
  if (error && !data) return <ErrorState message={error} onRetry={load} />
  if (!data) return null

  const { user, stats } = data
  const name = user.displayName || user.username || 'Unnamed user'
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Avatar user={user} size={52} />
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-bold text-gray-900 truncate">{name}</p>
          {user.username && <p className="text-sm text-gray-500">@{user.username}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusBadge status={user.moderationStatus} />
            {user.verifiedCampus ? <Badge tone="blue"><BadgeCheck className="w-3 h-3" /> Campus verified</Badge> : <Badge>Not verified</Badge>}
            {!user.profileCompleted && <Badge tone="amber">Profile incomplete</Badge>}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {user.moderationStatus === 'active' ? (
          <Button
            variant="danger"
            onClick={() =>
              setConfirm({
                kind: 'status',
                value: 'suspended',
                title: `Suspend ${name}?`,
                body: 'They will be blocked from posting, commenting, messaging, creating communities, listings, stories and calls (enforced by Firestore rules). The first suspension of an account also applies the standard reputation penalty (once per account). You can restore them later; restoring does not refund that penalty. This is recorded in the audit log.',
                label: 'Suspend user',
                tone: 'danger',
                done: 'User suspended.'
              })
            }
          >
            <Ban className="w-3.5 h-3.5" /> Suspend
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() =>
              setConfirm({
                kind: 'status',
                value: 'active',
                title: `Restore ${name}?`,
                body: 'Their account returns to good standing and the posting/messaging block is lifted. This is recorded in the audit log.',
                label: 'Restore user',
                done: 'User restored.'
              })
            }
          >
            <UserCheck className="w-3.5 h-3.5" /> Restore
          </Button>
        )}
        {user.verifiedCampus ? (
          <Button
            onClick={() =>
              setConfirm({
                kind: 'verify',
                value: false,
                title: `Remove campus verification from ${name}?`,
                body: 'Their verified badge and verified-only access are removed. This is recorded in the audit log.',
                label: 'Remove verification',
                tone: 'danger',
                done: 'Verification removed.'
              })
            }
          >
            <ShieldOff className="w-3.5 h-3.5" /> Unverify
          </Button>
        ) : (
          <Button
            onClick={() =>
              setConfirm({
                kind: 'verify',
                value: true,
                title: `Verify ${name} as a campus student?`,
                body: 'Only do this when you have confirmed their identity outside the ID-upload flow. Grants the verified badge and the verification reputation bonus. Recorded in the audit log.',
                label: 'Verify user',
                done: 'User verified.'
              })
            }
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Verify
          </Button>
        )}
      </div>
      {user.moderationStatus === 'restricted' && (
        <p className="text-xs text-gray-500 -mt-3">
          Note: "Restricted" is stored on this account but the app does not currently enforce it. Suspend to block activity.
        </p>
      )}

      <Card title="Profile" padded>
        <KeyValue
          items={[
            ['UID', <code key="uid" className="text-xs break-all">{user.uid}</code>],
            ['College', user.collegeName || (user.collegeId ? 'Unknown college' : 'Not set')],
            ['Course / year', [user.course, user.year].filter(Boolean).join(' · ') || null],
            ['Verification method', user.verificationMethod],
            ['Joined', fmtDateTime(user.createdAtMs)],
            ['Last active', user.activityHidden ? 'Hidden by the user' : user.lastActiveAtMs ? fmtRelative(user.lastActiveAtMs) : 'Unknown'],
            ['Followers', fmtNumber(user.followersCount)],
            ['Bio', user.bio || null]
          ]}
        />
      </Card>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {[
          ['Posts', stats.posts],
          ['Listings', stats.listings],
          ['Communities', stats.communitiesOwned],
          ['Reports filed', stats.reportsFiled],
          ['Reported', stats.reportsAgainst]
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-gray-100 p-3">
            <p className={`text-lg font-bold tabular-nums ${v === null ? 'text-gray-400 text-sm' : 'text-gray-900'}`}>{fmtNumber(v) ?? 'n/a'}</p>
            <p className="text-[11px] text-gray-500">{k}</p>
          </div>
        ))}
      </div>

      <section>
        <h3 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-gray-900"><Flag className="w-4 h-4" /> Reports against this user</h3>
        {data.reportsAgainst.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No reports on their content.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-100">
            {data.reportsAgainst.map((r) => (
              <li key={r.id} className="px-3 py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-gray-900">{r.reason || 'No reason given'}</p>
                  <p className="text-xs text-gray-500">{r.targetType} · {fmtRelative(r.createdAtMs)}</p>
                  {r.details && <p className="mt-1 text-xs text-gray-600">{r.details}</p>}
                </div>
                <Badge tone={r.status === 'pending' ? 'amber' : 'gray'}>{r.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-gray-900"><History className="w-4 h-4" /> Moderation history</h3>
        {data.moderationHistory.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No admin actions recorded against this account.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-100">
            {data.moderationHistory.map((a) => (
              <li key={a.id} className="px-3 py-2.5">
                <p className="text-[13px] font-medium text-gray-900">{ACTION_LABELS[a.action] || a.action}</p>
                <p className="text-xs text-gray-500">{[a.targetType, a.reason, fmtDateTime(a.createdAtMs)].filter(Boolean).join(' · ')}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.verificationRequests.length > 0 && (
        <section>
          <h3 className="text-[13.5px] font-semibold text-gray-900">Verification requests</h3>
          <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-100">
            {data.verificationRequests.map((v) => (
              <li key={v.id} className="px-3 py-2.5 flex items-center justify-between gap-3">
                <p className="text-xs text-gray-600">Submitted {fmtDateTime(v.createdAtMs)}{v.reviewedAtMs ? ` · reviewed ${fmtDateTime(v.reviewedAtMs)}` : ''}</p>
                <Badge tone={v.status === 'approved' ? 'emerald' : v.status === 'rejected' ? 'rose' : 'amber'}>{v.status}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="text-[13.5px] font-semibold text-gray-900">Recent public posts</h3>
        {data.recentPosts.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No public posts.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-100">
            {data.recentPosts.map((p) => (
              <li key={p.id} className="px-3 py-2.5">
                <p className="text-[13px] text-gray-900 break-words">{p.text || (p.hasImage ? '[photo]' : '[empty]')}</p>
                <p className="text-xs text-gray-500">{fmtRelative(p.createdAtMs)} · {p.likes} likes · {p.comments} comments</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        body={confirm?.body}
        confirmLabel={confirm?.label}
        tone={confirm?.tone}
        busy={busy}
        onConfirm={run}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}

export default function AdminUsersPage() {
  const { sessionToken } = useAdminSession()
  const { params } = useAdminWorkspace()
  const [query, setQuery] = useState(params.query || '')
  const [submitted, setSubmitted] = useState(params.query || '')
  const [college, setCollege] = useState(null)
  const [verified, setVerified] = useState('')
  const [status, setStatus] = useState(params.moderationStatus || '')
  const [users, setUsers] = useState([])
  const [mode, setMode] = useState('browse')
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [openUid, setOpenUid] = useState(params.openUid || null)
  const [toast, setToast] = useState(null)
  const reqId = useRef(0)

  // Top-bar search / alert links while already on this page.
  useEffect(() => {
    if (params.query !== undefined) {
      setQuery(params.query)
      setSubmitted(params.query)
    }
    if (params.moderationStatus !== undefined) setStatus(params.moderationStatus)
    if (params.openUid) setOpenUid(params.openUid)
  }, [params])

  const filters = { collegeId: college?.id || undefined, verified: verified === '' ? undefined : verified === 'true', moderationStatus: status || undefined }

  const fetchPage = useCallback(
    async (after) => {
      const id = ++reqId.current
      after ? setLoadingMore(true) : setLoading(true)
      setError('')
      try {
        const data = await callAdmin('adminSearchUsers', { sessionToken, query: submitted || undefined, ...filters, pageSize: 25, cursor: after || undefined })
        if (reqId.current !== id) return
        setMode(data?.mode || 'browse')
        setCursor(data?.nextCursor || null)
        setUsers((prev) => (after ? [...prev, ...(data?.users || [])] : data?.users || []))
      } catch (err) {
        if (reqId.current === id) setError(err?.message || 'Could not load users.')
      } finally {
        if (reqId.current === id) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionToken, submitted, college?.id, verified, status]
  )

  useEffect(() => {
    fetchPage(null)
  }, [fetchPage])

  const updateRow = () => fetchPage(null)

  return (
    <div>
      <PageHeader title="Users" description="Find any account, review its history, and take moderation or verification action." />

      <Card padded={false} className="mb-4">
        <div className="p-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] items-start">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault()
              setSubmitted(query.trim())
            }}
            className="relative"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (!e.target.value) setSubmitted('')
              }}
              placeholder="Name, @username or UID — press Enter"
              aria-label="Search users"
              className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-[13px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-500"
            />
          </form>
          <div className="admin-college-filter min-w-0">
            <CollegeSearch id="admin-college-filter" value={college} onChange={setCollege} placeholder="Filter by college…" hideAddLink />
          </div>
          <Select label="Verification" value={verified} onChange={setVerified} options={VERIFIED_OPTIONS} />
          <Select label="Account status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        </div>
        <p className="px-4 pb-3 text-xs text-gray-500">
          {mode === 'search'
            ? 'Search matches exact @username, exact UID, or names starting with your text (up to 50 matches, then filtered).'
            : 'Browsing all accounts in a stable order. Use search for a specific person.'}
        </p>
      </Card>

      <Card padded={false}>
        {loading ? (
          <div className="p-4 space-y-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchPage(null)} />
        ) : users.length === 0 ? (
          <EmptyState icon={UsersIcon} title="No users match" description={submitted ? 'Try a different name, the exact @username, or the full UID.' : 'No accounts match these filters.'} />
        ) : (
          <>
            <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_120px_110px_110px_20px] gap-3 px-4 py-2.5 border-b border-gray-100 text-[11.5px] font-semibold uppercase tracking-wide text-gray-400">
              <span>User</span>
              <span>College</span>
              <span>Status</span>
              <span>Joined</span>
              <span>Last active</span>
              <span />
            </div>
            <ul className="divide-y divide-gray-100">
              {users.map((u) => (
                <li key={u.uid}>
                  <button type="button" onClick={() => setOpenUid(u.uid)} className="w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors duration-150 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_120px_110px_110px_20px] md:gap-3 md:items-center flex items-center gap-3">
                    <span className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar user={u} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="text-[13.5px] font-semibold text-gray-900 truncate">{u.displayName || u.username || 'Unnamed user'}</span>
                          {u.verifiedCampus && <BadgeCheck className="w-4 h-4 text-blue-600 flex-shrink-0" aria-label="Campus verified" />}
                        </span>
                        <span className="block text-xs text-gray-500 truncate">{u.username ? `@${u.username}` : u.uid}</span>
                      </span>
                    </span>
                    <span className="hidden md:block text-[13px] text-gray-600 truncate">{u.collegeName || '—'}</span>
                    <span className="hidden md:block"><StatusBadge status={u.moderationStatus} /></span>
                    <span className="hidden md:block text-[13px] text-gray-600">{u.createdAtMs ? fmtRelative(u.createdAtMs) : '—'}</span>
                    <span className="hidden md:block text-[13px] text-gray-600">{u.activityHidden ? 'Hidden' : u.lastActiveAtMs ? fmtRelative(u.lastActiveAtMs) : '—'}</span>
                    <span className="md:hidden"><StatusBadge status={u.moderationStatus} /></span>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
            {cursor && mode === 'browse' && (
              <div className="p-3 border-t border-gray-100 flex justify-center">
                <Button onClick={() => fetchPage(cursor)} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      <Drawer open={Boolean(openUid)} title="User details" onClose={() => setOpenUid(null)}>
        {openUid && <UserDetail key={openUid} uid={openUid} onChanged={updateRow} onToast={setToast} />}
      </Drawer>
      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
