import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Archive, ImagePlus, Megaphone, Pencil, Pin, PinOff, Plus, RotateCcw, Search, Send, Trash2, X } from 'lucide-react'
import { useAdminSession } from '../hooks/useAdminSession.jsx'
import { callAdmin } from '../services/adminCallable.js'
import AdminToast from '../components/AdminToast.jsx'
import CollegeSearch from '../../components/CollegeSearch.jsx'
import NoticeCard from '../../notices/NoticeCard.jsx'
import { Badge, Button, Card, ConfirmDialog, Drawer, EmptyState, ErrorState, PageHeader, Skeleton, fmtDateTime, fmtRelative } from '../components/ui.jsx'

/**
 * Notice Board management. Every action goes through device-signed,
 * session-gated Cloud Functions (functions/notices.js) and is audit-logged:
 * adminListNotices · adminSaveNotice · adminSetNoticeState ·
 * adminDeleteNotice · adminUploadNoticeImage.
 * The preview renders the same <NoticeCard> students see.
 */
const TABS = [
  ['published', 'Published'],
  ['draft', 'Drafts'],
  ['archived', 'Archived']
]
const LIMITS = { title: 90, body: 2000, actionLabel: 30 }
const EMPTY = { title: '', body: '', priority: 'normal', pinned: false, imageUrl: '', actionUrl: '', actionLabel: '', audienceType: 'all', college: null, users: [], scheduleMode: 'now', publishAt: '', expiryMode: 'none', expiresAt: '' }

const toLocalInput = (ms) => {
  if (!ms) return ''
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fromLocalInput = (v) => (v ? new Date(v).getTime() : null)

function audienceLabel(a) {
  if (!a) return '—'
  if (a.type === 'all') return 'Everyone'
  if (a.type === 'college') return `Campus · ${a.collegeName || a.collegeId}`
  return `${a.uids?.length || 0} specific user${a.uids?.length === 1 ? '' : 's'}`
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

function UserPicker({ value, onChange }) {
  const { sessionToken } = useAdminSession()
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const search = async (e) => {
    e?.preventDefault()
    if (!q.trim()) return
    setBusy(true)
    setErr('')
    try {
      const data = await callAdmin('adminSearchUsers', { sessionToken, query: q.trim(), pageSize: 10 })
      setResults(data?.users || [])
      if (!data?.users?.length) setErr('No users match.')
    } catch (er) {
      setErr(er?.message || 'Search failed.')
    } finally {
      setBusy(false)
    }
  }
  const add = (u) => {
    if (value.some((x) => x.uid === u.uid)) return
    onChange([...value, { uid: u.uid, name: u.displayName || '', username: u.username || '' }])
  }
  return (
    <div className="space-y-2">
      <form onSubmit={search} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, @username or UID" aria-label="Find users" className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-[13px] text-gray-900 outline-none focus:border-blue-500" />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </Button>
      </form>
      {err && <p className="text-xs text-gray-500">{err}</p>}
      {results.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-100">
          {results.map((u) => (
            <li key={u.uid}>
              <button type="button" onClick={() => add(u)} className="w-full text-left px-3 py-2 text-[13px] hover:bg-gray-100 flex items-center justify-between gap-2">
                <span className="truncate text-gray-900">{u.displayName || 'Unnamed'} <span className="text-gray-500">{u.username ? `@${u.username}` : ''}</span></span>
                <Plus className="w-4 h-4 text-blue-600 flex-shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((u) => (
            <span key={u.uid} className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-600 pl-2.5 pr-1 py-0.5 text-[12px] font-semibold">
              {u.name || (u.username ? `@${u.username}` : u.uid.slice(0, 8))}
              <button type="button" aria-label={`Remove ${u.name || u.username}`} onClick={() => onChange(value.filter((x) => x.uid !== u.uid))} className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-blue-100">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="text-[11.5px] text-gray-500">Only these users will see the notice. Up to 100.</p>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-[12.5px] font-semibold text-gray-700 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block mt-1 text-[11.5px] text-gray-500">{hint}</span>}
    </label>
  )
}
const inputCls = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13.5px] text-gray-900 outline-none focus:border-blue-500'

function NoticeEditor({ initial, onSaved, onClose, onToast }) {
  const { sessionToken } = useAdminSession()
  const [f, setF] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [confirmPublish, setConfirmPublish] = useState(false)
  const fileRef = useRef(null)
  const set = (k) => (v) => setF((prev) => ({ ...prev, [k]: v && v.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v }))

  const preview = useMemo(
    () => ({
      groupId: 'preview',
      title: f.title || 'Notice title',
      body: f.body || 'Your message will appear here.',
      priority: f.priority,
      pinned: f.pinned,
      imageUrl: f.imageUrl || null,
      actionUrl: f.actionUrl || null,
      actionLabel: f.actionLabel || null,
      publishAtMs: f.scheduleMode === 'later' ? fromLocalInput(f.publishAt) : Date.now(),
      expiresAtMs: f.expiryMode === 'date' ? fromLocalInput(f.expiresAt) : null
    }),
    [f]
  )

  const payload = () => ({
    title: f.title,
    body: f.body,
    priority: f.priority,
    pinned: f.pinned,
    imageUrl: f.imageUrl || null,
    actionUrl: f.actionUrl.trim() || null,
    actionLabel: f.actionLabel.trim() || null,
    publishAtMs: f.scheduleMode === 'later' ? fromLocalInput(f.publishAt) : null,
    expiresAtMs: f.expiryMode === 'date' ? fromLocalInput(f.expiresAt) : null,
    audience: f.audienceType === 'all' ? { type: 'all' } : f.audienceType === 'college' ? { type: 'college', collegeId: f.college?.id } : { type: 'users', uids: f.users.map((u) => u.uid) }
  })

  const localError = () => {
    if (!f.title.trim()) return 'Add a title.'
    if (!f.body.trim()) return 'Add a message.'
    if (f.audienceType === 'college' && !f.college?.id) return 'Choose a campus.'
    if (f.audienceType === 'users' && !f.users.length) return 'Choose at least one user.'
    if (f.scheduleMode === 'later' && !f.publishAt) return 'Pick a publish time.'
    if (f.expiryMode === 'date' && !f.expiresAt) return 'Pick an expiry time.'
    return ''
  }

  const save = async (publish) => {
    const le = localError()
    if (le) return setError(le)
    setBusy(true)
    setError('')
    try {
      const res = await callAdmin('adminSaveNotice', { sessionToken, id: f.id || undefined, notice: payload(), publish })
      onToast({ tone: 'success', message: publish ? 'Notice published.' : 'Draft saved.' })
      onSaved(res.notice)
    } catch (err) {
      setError(err?.message || 'Could not save the notice.')
    } finally {
      setBusy(false)
      setConfirmPublish(false)
    }
  }

  const upload = async (file) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setError('Use a JPEG, PNG or WebP image.')
    if (file.size > 1.5 * 1024 * 1024) return setError('Image must be 1.5 MB or smaller.')
    setUploading(true)
    setError('')
    try {
      const res = await callAdmin('adminUploadNoticeImage', { sessionToken, contentType: file.type, dataBase64: await fileToBase64(file) })
      set('imageUrl')(res.imageUrl)
    } catch (err) {
      setError(err?.message || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4 min-w-0">
        <Field label={`Title (${f.title.length}/${LIMITS.title})`}>
          <input value={f.title} maxLength={LIMITS.title} onChange={set('title')} className={inputCls} placeholder="Happy Diwali from Campinity!" />
        </Field>
        <Field label={`Message (${f.body.length}/${LIMITS.body})`}>
          <textarea value={f.body} maxLength={LIMITS.body} onChange={set('body')} rows={6} className={`${inputCls} resize-y`} placeholder="Write the notice students will read…" />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Importance">
            <select value={f.priority} onChange={set('priority')} className={inputCls}>
              <option value="normal">Notice</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
            </select>
          </Field>
          <label className="flex items-center gap-2.5 sm:mt-7 text-[13.5px] text-gray-800">
            <input type="checkbox" checked={f.pinned} onChange={set('pinned')} className="w-4 h-4 accent-blue-600" /> Pin to the top of the board
          </label>
        </div>

        <fieldset className="rounded-2xl border border-gray-100 p-4 space-y-3">
          <legend className="px-1 text-[12.5px] font-semibold text-gray-700">Who sees it</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {[
              ['all', 'Everyone'],
              ['college', 'A campus'],
              ['users', 'Specific users']
            ].map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={f.audienceType === v} onClick={() => set('audienceType')(v)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${f.audienceType === v ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {l}
              </button>
            ))}
          </div>
          {f.audienceType === 'all' && <p className="text-[12px] text-gray-500">Every signed-in student sees this on their profile.</p>}
          {f.audienceType === 'college' && (
            <>
              <CollegeSearch id="notice-college" value={f.college} onChange={set('college')} placeholder="Find a campus…" hideAddLink />
              <p className="text-[11.5px] text-gray-500">Based on the campus on each student's profile (self-declared) — fine for campus news, not for confidential messages.</p>
            </>
          )}
          {f.audienceType === 'users' && <UserPicker value={f.users} onChange={set('users')} />}
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Publish">
            <select value={f.scheduleMode} onChange={set('scheduleMode')} className={inputCls}>
              <option value="now">Immediately</option>
              <option value="later">At a scheduled time</option>
            </select>
            {f.scheduleMode === 'later' && <input type="datetime-local" value={f.publishAt} onChange={set('publishAt')} className={`${inputCls} mt-2`} aria-label="Publish at" />}
          </Field>
          <Field label="Expires">
            <select value={f.expiryMode} onChange={set('expiryMode')} className={inputCls}>
              <option value="none">Never</option>
              <option value="date">On a date</option>
            </select>
            {f.expiryMode === 'date' && <input type="datetime-local" value={f.expiresAt} onChange={set('expiresAt')} className={`${inputCls} mt-2`} aria-label="Expires at" />}
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
          <Field label="Action link (optional)" hint="https:// link, or an in-app path like /communities">
            <input value={f.actionUrl} onChange={set('actionUrl')} className={inputCls} placeholder="https://… or /communities" />
          </Field>
          <Field label="Button text">
            <input value={f.actionLabel} maxLength={LIMITS.actionLabel} onChange={set('actionLabel')} className={inputCls} placeholder="Open" />
          </Field>
        </div>

        <Field label="Banner image (optional)" hint="JPEG, PNG or WebP, up to 1.5 MB.">
          <div className="flex items-center gap-2 flex-wrap">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
              <ImagePlus className="w-4 h-4" /> {uploading ? 'Uploading…' : f.imageUrl ? 'Replace image' : 'Upload image'}
            </Button>
            {f.imageUrl && (
              <Button variant="ghost" onClick={() => set('imageUrl')('')}>
                Remove
              </Button>
            )}
          </div>
        </Field>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-[13px] text-red-600">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="primary" disabled={busy || uploading} onClick={() => (localError() ? setError(localError()) : setConfirmPublish(true))}>
            <Send className="w-4 h-4" /> {f.status === 'published' ? 'Update published notice' : 'Publish'}
          </Button>
          {f.status !== 'published' && (
            <Button disabled={busy || uploading} onClick={() => save(false)}>
              Save draft
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>

      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-gray-700 mb-2">Preview — exactly what students see</p>
        <div className="rounded-2xl bg-gray-100 p-3">
          <NoticeCard key={JSON.stringify(preview)} notice={preview} unread defaultExpanded onOpenLink={() => {}} />
        </div>
        <p className="mt-2 text-[11.5px] text-gray-500">
          Audience: <strong>{f.audienceType === 'all' ? 'Everyone' : f.audienceType === 'college' ? f.college?.name || 'choose a campus' : `${f.users.length} user(s)`}</strong>
        </p>
      </div>

      <ConfirmDialog
        open={confirmPublish}
        title={f.status === 'published' ? 'Update this published notice?' : 'Publish this notice?'}
        body={`It will appear on the Notice Board of ${f.audienceType === 'all' ? 'every student' : f.audienceType === 'college' ? `students at ${f.college?.name || 'the chosen campus'}` : `${f.users.length} selected user(s)`}${f.scheduleMode === 'later' ? ` from ${f.publishAt ? new Date(f.publishAt).toLocaleString() : 'the scheduled time'}` : ' right away'}.`}
        confirmLabel={f.status === 'published' ? 'Update' : 'Publish'}
        busy={busy}
        onConfirm={() => save(true)}
        onCancel={() => setConfirmPublish(false)}
      />
    </div>
  )
}

function toForm(n) {
  if (!n) return { ...EMPTY }
  const a = n.audience || { type: 'all' }
  return {
    id: n.id,
    status: n.status,
    title: n.title || '',
    body: n.body || '',
    priority: n.priority || 'normal',
    pinned: n.pinned === true,
    imageUrl: n.imageUrl || '',
    actionUrl: n.actionUrl || '',
    actionLabel: n.actionLabel || '',
    audienceType: a.type,
    college: a.type === 'college' ? { id: a.collegeId, name: a.collegeName || a.collegeId } : null,
    users: a.type === 'users' ? (a.labels || a.uids.map((uid) => ({ uid }))).map((u) => ({ uid: u.uid, name: u.name || '', username: u.username || '' })) : [],
    scheduleMode: n.publishAtMs && n.publishAtMs > Date.now() ? 'later' : 'now',
    publishAt: n.publishAtMs && n.publishAtMs > Date.now() ? toLocalInput(n.publishAtMs) : '',
    expiryMode: n.expiresAtMs ? 'date' : 'none',
    expiresAt: toLocalInput(n.expiresAtMs)
  }
}

export default function AdminNoticesPage() {
  const { sessionToken } = useAdminSession()
  const [tab, setTab] = useState('published')
  const [items, setItems] = useState(null)
  const [cursor, setCursor] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null | form
  const [confirm, setConfirm] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [toast, setToast] = useState(null)

  const load = useCallback(
    async (after) => {
      setError('')
      if (!after) setItems(null)
      try {
        const data = await callAdmin('adminListNotices', { sessionToken, status: tab, cursor: after || undefined })
        setItems((prev) => (after ? [...(prev || []), ...(data?.notices || [])] : data?.notices || []))
        setCursor(data?.nextCursor || null)
      } catch (err) {
        setError(err?.message || 'Could not load notices.')
      }
    },
    [sessionToken, tab]
  )
  useEffect(() => {
    load(null)
  }, [load])

  const act = async (n, action) => {
    setBusyId(n.id)
    try {
      if (action === 'delete') await callAdmin('adminDeleteNotice', { sessionToken, id: n.id })
      else await callAdmin('adminSetNoticeState', { sessionToken, id: n.id, action })
      setToast({ tone: 'success', message: { delete: 'Notice deleted.', archive: 'Notice archived — removed from every board.', restore: 'Moved to drafts.', publish: 'Notice published.', pin: 'Pinned.', unpin: 'Unpinned.' }[action] })
      setConfirm(null)
      load(null)
    } catch (err) {
      setToast({ tone: 'error', message: err?.message || 'That action failed. Nothing was changed.' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Notice Board"
        description="Official notices shown on students' profiles — for everyone, a campus, or specific people."
        actions={
          <Button variant="primary" onClick={() => setEditing({ ...EMPTY })}>
            <Plus className="w-4 h-4" /> New notice
          </Button>
        }
      />

      <Card padded={false}>
        <div className="px-4 pt-2 flex gap-5 border-b border-gray-100" role="tablist">
          {TABS.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`relative py-2.5 text-[13px] font-semibold ${tab === k ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}>
              {l}
              {tab === k && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-blue-600" />}
            </button>
          ))}
        </div>
        {error ? (
          <ErrorState message={error} onRetry={() => load(null)} />
        ) : !items ? (
          <div className="p-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={Megaphone} title={tab === 'published' ? 'No published notices' : tab === 'draft' ? 'No drafts' : 'Nothing archived'} description={tab === 'published' ? 'Create a notice to show it on students’ profiles.' : undefined} />
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((n) => {
              const scheduled = n.status === 'published' && n.publishAtMs > Date.now()
              const expired = n.expiresAtMs && n.expiresAtMs <= Date.now()
              return (
                <li key={n.id} className="px-4 py-3.5 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14px] font-semibold text-gray-900 truncate">{n.title}</p>
                      {n.pinned && <Badge tone="blue"><Pin className="w-3 h-3" /> Pinned</Badge>}
                      {n.priority !== 'normal' && <Badge tone={n.priority === 'urgent' ? 'rose' : 'amber'}>{n.priority}</Badge>}
                      {scheduled && <Badge tone="purple">Scheduled {fmtDateTime(n.publishAtMs)}</Badge>}
                      {expired && <Badge>Expired</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{n.body}</p>
                    <p className="mt-1 text-[11.5px] text-gray-400">
                      {audienceLabel(n.audience)} · updated {fmtRelative(n.updatedAtMs)}
                      {n.expiresAtMs && !expired ? ` · expires ${fmtDateTime(n.expiresAtMs)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {n.status !== 'archived' && (
                      <Button variant="ghost" aria-label="Edit" onClick={() => setEditing(toForm(n))}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                    {n.status === 'published' && (
                      <Button variant="ghost" aria-label={n.pinned ? 'Unpin' : 'Pin'} disabled={busyId === n.id} onClick={() => act(n, n.pinned ? 'unpin' : 'pin')}>
                        {n.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                      </Button>
                    )}
                    {n.status !== 'archived' ? (
                      <Button variant="ghost" aria-label="Archive" onClick={() => setConfirm({ n, action: 'archive' })}>
                        <Archive className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" aria-label="Restore to drafts" disabled={busyId === n.id} onClick={() => act(n, 'restore')}>
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" aria-label="Delete" onClick={() => setConfirm({ n, action: 'delete' })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {cursor && items && (
          <div className="p-3 border-t border-gray-100 flex justify-center">
            <Button onClick={() => load(cursor)}>Load more</Button>
          </div>
        )}
      </Card>

      <Drawer open={Boolean(editing)} title={editing?.id ? 'Edit notice' : 'New notice'} onClose={() => setEditing(null)} width="max-w-[980px]">
        {editing && (
          <NoticeEditor
            key={editing.id || 'new'}
            initial={editing}
            onToast={setToast}
            onClose={() => setEditing(null)}
            onSaved={(n) => {
              setEditing(null)
              setTab(n.status)
              load(null)
            }}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.action === 'delete' ? `Delete “${confirm?.n.title}” permanently?` : `Archive “${confirm?.n.title}”?`}
        body={confirm?.action === 'delete' ? 'It disappears from every board and cannot be restored.' : 'It disappears from every board right away. You can restore it to drafts later.'}
        confirmLabel={confirm?.action === 'delete' ? 'Delete' : 'Archive'}
        tone={confirm?.action === 'delete' ? 'danger' : 'primary'}
        busy={Boolean(confirm) && busyId === confirm.n.id}
        onConfirm={() => act(confirm.n, confirm.action)}
        onCancel={() => setConfirm(null)}
      />
      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
