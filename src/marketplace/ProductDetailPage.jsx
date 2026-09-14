import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Flag, Heart, MessageCircle, ShoppingBag, Trash2 } from 'lucide-react'
import Loader from '../auth/components/Loader.jsx'
import Avatar from '../components/Avatar.jsx'
import ReportModal from '../components/ReportModal.jsx'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { auth } from '../firebase/firebase.js'
import { deleteProduct, getProductById } from '../firebase/marketplaceService.js'
import { getOrCreateChat } from '../firebase/chatService.js'
import { saveItem, subscribeToIsItemSaved, unsaveItem } from '../saved/savedService.js'

function timeAgoFromMs(ms) {
  if (!ms) return ''
  const diffMs = Date.now() - ms
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

/**
 * Redesigned to match the rest of the rebuilt Marketplace. Two real
 * capabilities that were previously missing entirely are added here
 * (not invented — both use infrastructure that already exists
 * elsewhere in the app, identically wired): messaging the seller
 * (getOrCreateChat + navigate, same pattern LostFoundPage already
 * uses) and a save/favorite toggle (the generic savedItems system
 * PostCard.jsx already relies on). The owner also gets a real delete
 * action, since the Firestore rule already allows it and there was
 * previously no UI for it at all.
 */
export default function ProductDetailPage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'notfound' | 'error'
  const [saved, setSaved] = useState(false)
  const [messaging, setMessaging] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  const uid = auth.currentUser?.uid

  useEffect(() => {
    let cancelled = false
    getProductById(productId)
      .then((data) => {
        if (cancelled) return
        if (!data) setStatus('notfound')
        else {
          setProduct(data)
          setStatus('success')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [productId])

  useEffect(() => {
    if (!uid || !productId) return undefined
    return subscribeToIsItemSaved(uid, 'product', productId, setSaved)
  }, [uid, productId])

  const isOwner = uid && product?.sellerId === uid

  const handleToggleSave = () => {
    if (!uid || !product) return
    if (saved) {
      unsaveItem(uid, 'product', product.id).catch(() => {})
    } else {
      saveItem(uid, 'product', product.id, {
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl
      }).catch(() => {})
    }
  }

  const handleMessageSeller = async () => {
    if (!uid || !product || isOwner || messaging) return
    setMessaging(true)
    try {
      const chatId = await getOrCreateChat(uid, product.sellerId)
      navigate(`/messages/${chatId}`)
    } catch (err) {
      console.error('Could not start chat with seller:', err)
      setMessaging(false)
    }
  }

  const handleDelete = async () => {
    if (!product || !isOwner || deleting) return
    if (!window.confirm('Remove this listing? This can\'t be undone.')) return
    setDeleting(true)
    try {
      await deleteProduct(product.id)
      navigate('/marketplace')
    } catch (err) {
      console.error('Could not delete product:', err)
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden" style={{ backgroundColor: '#f8fafc' }}>
      <div className="mx-auto max-w-[480px] lg:max-w-[560px] bg-white min-h-screen lg:shadow-[0_1px_3px_rgba(15,23,42,0.04)] lg:border-x lg:border-gray-100">
        <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
          <div className="h-14 flex items-center justify-between px-3">
            <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5" />
            </button>
            {uid && !isOwner && product && (
              <button
                type="button"
                aria-label={saved ? 'Remove from saved' : 'Save product'}
                onClick={handleToggleSave}
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100"
              >
                <Heart className={`w-5 h-5 ${saved ? 'fill-rose-500 text-rose-500' : ''}`} />
              </button>
            )}
          </div>
        </header>

        {status === 'loading' && (
          <div className="py-16 flex justify-center">
            <Loader size="md" tone="dark" />
          </div>
        )}

        {status === 'notfound' && (
          <div className="py-16 text-center px-6">
            <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-gray-300" />
            </div>
            <p className="mt-3 text-sm font-semibold text-gray-900">Product not found</p>
            <p className="mt-1 text-sm text-gray-400">It may have been removed by the seller.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="py-16 text-center px-6">
            <p className="text-sm font-semibold text-gray-900">Couldn't load this product.</p>
          </div>
        )}

        {status === 'success' && product && (
          <div>
            <div className="aspect-square bg-gray-100">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingBag className="w-8 h-8 text-gray-300" />
                </div>
              )}
            </div>

            <div className="p-4 lg:p-5">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">{product.category}</p>
              <h1 className="mt-1 text-xl font-bold text-gray-900 leading-tight">{product.name}</h1>
              <div className="mt-1.5 flex items-center gap-2">
                <p className="text-2xl font-bold text-gray-900">₹{product.price}</p>
                <p className="text-xs text-gray-400">{timeAgoFromMs(product.createdAtMs)}</p>
              </div>

              {product.description && (
                <p className="mt-3 text-sm text-gray-700 leading-relaxed">{product.description}</p>
              )}

              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-gray-100 p-3">
                <Avatar initials={getInitials(product.sellerName)} colorClass={getAvatarColor(product.sellerId)} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{product.sellerName}</p>
                  <p className="text-xs text-gray-400 truncate">{product.collegeName || 'Campinity seller'}</p>
                </div>
              </div>

              {!isOwner && (
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleMessageSeller}
                    disabled={!uid || messaging}
                    className="w-full flex items-center justify-center gap-1.5 rounded-full bg-blue-600 text-white text-sm font-semibold py-3 hover:bg-blue-700 disabled:opacity-50 transition-all duration-200"
                  >
                    <MessageCircle className="w-4 h-4" /> {messaging ? 'Opening chat…' : 'Message Seller'}
                  </button>
                  {uid && (
                    <button
                      type="button"
                      onClick={() => setReportOpen(true)}
                      className="w-full flex items-center justify-center gap-1.5 rounded-full border border-gray-200 text-gray-500 text-xs font-semibold py-2.5 hover:border-gray-300 hover:text-gray-700 transition-all duration-200"
                    >
                      <Flag className="w-3.5 h-3.5" /> Report listing
                    </button>
                  )}
                </div>
              )}

              {isOwner && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="mt-4 w-full flex items-center justify-center gap-1.5 rounded-full border border-red-100 text-red-500 text-sm font-semibold py-3 hover:bg-red-50 disabled:opacity-50 transition-all duration-200"
                >
                  <Trash2 className="w-4 h-4" /> {deleting ? 'Removing…' : 'Remove Listing'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {product && (
        <ReportModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="product"
          targetId={product.id}
          targetOwnerUid={product.sellerId}
        />
      )}
    </div>
  )
}
