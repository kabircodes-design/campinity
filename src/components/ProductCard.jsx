import { useEffect, useState } from 'react'
import { Heart, ShoppingBag } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { auth } from '../firebase/firebase.js'
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
 * Reusable product card used by every product grid on the Marketplace
 * (main grid, Sponsored row, From Your Campus row). Favorite toggle is
 * real — it uses the same generic savedItems system PostCard.jsx already
 * relies on (entityType: 'product'), not a fake/local-only heart.
 */
export default function ProductCard({ product, onOpen }) {
  const uid = auth.currentUser?.uid
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!uid) return undefined
    return subscribeToIsItemSaved(uid, 'product', product.id, setSaved)
  }, [uid, product.id])

  const handleToggleSave = (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (!uid) return
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

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group text-left rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:border-gray-200 hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)] hover:-translate-y-[1px] transition-all duration-200"
    >
      <div className="relative aspect-square bg-gray-100">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-6 h-6 text-gray-300" />
          </div>
        )}

        {product.sponsored?.label && (
          <span className="absolute top-2 left-2 rounded-full bg-amber-400/95 text-amber-950 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5">
            {product.sponsored.label}
          </span>
        )}

        {uid && (
          <span
            role="button"
            tabIndex={0}
            aria-label={saved ? 'Remove from saved' : 'Save product'}
            onClick={handleToggleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleToggleSave(e)
            }}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 backdrop-blur-[2px] flex items-center justify-center shadow-sm hover:bg-white transition-all duration-150"
          >
            <Heart className={`w-3.5 h-3.5 ${saved ? 'fill-rose-500 text-rose-500' : 'text-gray-500'}`} />
          </span>
        )}
      </div>

      <div className="p-2.5 lg:p-3">
        <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
        <p className="text-sm font-bold text-blue-600 mt-0.5">₹{product.price}</p>
        <div className="mt-1.5 flex items-center gap-1.5 min-w-0">
          <Avatar
            initials={getInitials(product.sellerName)}
            colorClass={getAvatarColor(product.sellerId)}
            size="sm"
            src={undefined}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-gray-500 truncate leading-tight">{product.sellerName}</p>
            {product.collegeName && (
              <p className="text-[10px] text-gray-400 truncate leading-tight">{product.collegeName}</p>
            )}
          </div>
          <span className="flex-shrink-0 text-[10px] text-gray-300">{timeAgoFromMs(product.createdAtMs)}</span>
        </div>
      </div>
    </button>
  )
}
