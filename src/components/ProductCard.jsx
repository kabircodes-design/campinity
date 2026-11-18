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

function formatPrice(price) {
  const n = Number(price)
  if (!Number.isFinite(n)) return `₹${price}`
  return `₹${n.toLocaleString('en-IN')}`
}

/**
 * Product card used by every product grid / rail on the Marketplace.
 * The save (heart) toggle is real — the same savedItems system PostCard
 * uses (entityType 'product'). Tapping the card opens product detail,
 * where contacting / messaging the seller lives.
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
    <div
      role="link"
      tabIndex={0}
      aria-label={`${product.name}, ${formatPrice(product.price)}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen?.()
        }
      }}
      className="group min-w-0 cursor-pointer text-left rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:border-gray-200 hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)] active:scale-[0.985] transition-all duration-200"
    >
      <div className="relative aspect-square bg-gray-100 overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-7 h-7 text-gray-300" />
          </div>
        )}

        {product.sponsored?.label && (
          <span className="absolute top-2 left-2 rounded-full bg-amber-400/95 text-amber-950 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5">
            {product.sponsored.label}
          </span>
        )}

        {product.category && (
          <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-black/55 text-white text-[10px] font-semibold px-2 py-0.5 backdrop-blur-[2px]">
            {product.category}
          </span>
        )}

        {uid && (
          <button
            type="button"
            aria-label={saved ? 'Remove from saved' : 'Save product'}
            aria-pressed={saved}
            onClick={handleToggleSave}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-sm active:scale-90 transition-all duration-150"
          >
            <Heart className={`w-4 h-4 ${saved ? 'fill-rose-500 text-rose-500' : 'text-gray-600'}`} />
          </button>
        )}
      </div>

      <div className="p-2.5 lg:p-3">
        <p className="text-base font-bold text-gray-900 leading-tight truncate" title={formatPrice(product.price)}>{formatPrice(product.price)}</p>
        <p className="mt-0.5 text-[13px] font-medium text-gray-700 leading-snug line-clamp-2 min-h-[2.4em] break-words">{product.name}</p>
        <div className="mt-2 flex items-center gap-1.5 min-w-0">
          <Avatar
            initials={getInitials(product.sellerName)}
            colorClass={getAvatarColor(product.sellerId)}
            size="xs"
            src={undefined}
          />
          <p className="min-w-0 flex-1 text-[11px] text-gray-500 truncate leading-tight">
            {product.sellerName}
            {product.collegeName ? <span className="text-gray-400"> · {product.collegeName}</span> : null}
          </p>
          <span className="flex-shrink-0 text-[10px] text-gray-400">{timeAgoFromMs(product.createdAtMs)}</span>
        </div>
      </div>
    </div>
  )
}
