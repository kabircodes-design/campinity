import { useEffect, useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import { useAdminSession } from '../hooks/useAdminSession.jsx'
import { callAdmin } from '../services/adminCallable.js'
import AdminToast from '../components/AdminToast.jsx'

/**
 * Real Marketplace listings via adminListMarketplaceProducts (the same
 * products/{productId} collection marketplaceService.js's real
 * Marketplace feature uses). Hide/unhide toggles a real `hidden`
 * field marketplaceService.js's getMarketplaceProducts() now filters
 * on — reversible, nothing deleted.
 */
export default function AdminMarketplacePage() {
  const { sessionToken } = useAdminSession()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioningId, setActioningId] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [toast, setToast] = useState(null)

  const load = () => {
    setLoading(true)
    setError('')
    callAdmin('adminListMarketplaceProducts', { sessionToken, pageSize: 40 })
      .then((data) => setProducts(data?.products || []))
      .catch((err) => setError(err?.message || 'Could not load marketplace listings.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [sessionToken])

  const handleAction = async (product, action) => {
    if (actioningId) return
    setActioningId(product.id)
    setConfirmTarget(null)
    try {
      await callAdmin('adminModerateProduct', { sessionToken, productId: product.id, action })
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, hidden: action === 'hide' } : p)))
      setToast({ tone: 'success', message: action === 'hide' ? 'Listing hidden.' : 'Listing unhidden.' })
    } catch (err) {
      setToast({ tone: 'error', message: err?.message || 'Could not update this listing.' })
    } finally {
      setActioningId(null)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">Marketplace</h1>
      <p className="mt-1 text-sm text-gray-400">Review listings and hide ones that violate campus guidelines.</p>

      <div className="mt-5">
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
        ) : products.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-gray-900">No listings yet.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {products.map((product) => (
              <div key={product.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3.5">
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBag className="w-5 h-5 text-gray-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
                    {product.hidden && (
                      <span className="flex-shrink-0 rounded-full bg-gray-100 text-gray-500 text-[9px] font-bold uppercase px-1.5 py-0.5">Hidden</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">₹{product.price} · {product.category} · {product.sellerName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmTarget({ product, action: product.hidden ? 'unhide' : 'hide' })}
                  disabled={actioningId === product.id}
                  className={`flex-shrink-0 rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-200 disabled:opacity-50 ${
                    product.hidden ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-red-200 text-red-600 hover:bg-red-50'
                  }`}
                >
                  {product.hidden ? 'Unhide' : 'Hide'}
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
              {confirmTarget.action === 'hide' ? `Hide "${confirmTarget.product.name}"?` : `Unhide "${confirmTarget.product.name}"?`}
            </p>
            <p className="mt-1.5 text-sm text-gray-400">
              {confirmTarget.action === 'hide' ? 'This listing will no longer appear in the Marketplace. You can unhide it later.' : 'This listing will reappear in the Marketplace.'}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button type="button" onClick={() => setConfirmTarget(null)} className="flex-1 rounded-full border border-gray-200 text-gray-600 text-sm font-semibold py-2">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAction(confirmTarget.product, confirmTarget.action)}
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
