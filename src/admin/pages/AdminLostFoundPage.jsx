import { useEffect, useState } from 'react'
import { Camera, MapPin } from 'lucide-react'
import { useAdminSession } from '../hooks/useAdminSession.jsx'
import { callAdmin } from '../services/adminCallable.js'
import AdminToast from '../components/AdminToast.jsx'

const TABS = [
  { key: 'active', label: 'Active' },
  { key: 'removed', label: 'Removed' }
]

/**
 * Real Lost & Found listings via adminListLostFound (the same
 * lostFound/{itemId} collection the actual feature uses — no second
 * database). "Remove" sets status: 'removed', which the user-facing
 * getLostFoundItems() query (only ever filters by exact status) already
 * excludes automatically — reversible via "Restore," nothing deleted.
 */
export default function AdminLostFoundPage() {
  const { sessionToken } = useAdminSession()
  const [tab, setTab] = useState('active')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioningId, setActioningId] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [toast, setToast] = useState(null)

  const load = () => {
    setLoading(true)
    setError('')
    callAdmin('adminListLostFound', { sessionToken, status: tab, pageSize: 30 })
      .then((data) => setItems(data?.items || []))
      .catch((err) => setError(err?.message || 'Could not load Lost & Found listings.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [tab])

  const handleAction = async (item, action) => {
    if (actioningId) return
    setActioningId(item.id)
    setConfirmTarget(null)
    try {
      await callAdmin('adminModerateLostFoundItem', { sessionToken, itemId: item.id, action })
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      setToast({ tone: 'success', message: action === 'remove' ? 'Listing removed.' : 'Listing restored.' })
    } catch (err) {
      setToast({ tone: 'error', message: err?.message || 'Could not update this listing.' })
    } finally {
      setActioningId(null)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">Lost &amp; Found</h1>
      <p className="mt-1 text-sm text-gray-400">Review listings and remove ones that violate campus guidelines.</p>

      <div className="mt-5 flex items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
              tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-400">{error}</p>
            <button type="button" onClick={load} className="mt-3 text-sm font-semibold text-blue-600">
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-gray-900">Nothing here.</p>
            <p className="mt-1 text-sm text-gray-400">No {tab} listings right now.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-3.5">
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-5 h-5 text-gray-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.title}</p>
                    <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${item.type === 'lost' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}>
                      {item.type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">
                    {item.category} <span className="mx-1">·</span>
                    <MapPin className="inline w-3 h-3" /> {item.location}
                  </p>
                  {item.description && <p className="mt-1 text-xs text-gray-500 line-clamp-1">{item.description}</p>}
                  <p className="mt-1 text-[10px] text-gray-300">Posted by {item.createdBy}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmTarget({ item, action: tab === 'active' ? 'remove' : 'restore' })}
                  disabled={actioningId === item.id}
                  className={`flex-shrink-0 rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-200 disabled:opacity-50 ${
                    tab === 'active' ? 'border border-red-200 text-red-600 hover:bg-red-50' : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {tab === 'active' ? 'Remove' : 'Restore'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmTarget && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <button type="button" aria-label="Cancel" onClick={() => setConfirmTarget(null)} className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-[340px] rounded-2xl bg-white p-5">
            <p className="text-sm font-semibold text-gray-900">
              {confirmTarget.action === 'remove' ? `Remove "${confirmTarget.item.title}"?` : `Restore "${confirmTarget.item.title}"?`}
            </p>
            <p className="mt-1.5 text-sm text-gray-400">
              {confirmTarget.action === 'remove' ? 'This listing will be hidden from the public board. You can restore it later.' : 'This listing will reappear on the public board.'}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button type="button" onClick={() => setConfirmTarget(null)} className="flex-1 rounded-full border border-gray-200 text-gray-600 text-sm font-semibold py-2">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAction(confirmTarget.item, confirmTarget.action)}
                className="flex-1 rounded-full bg-blue-600 text-white text-sm font-semibold py-2"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
