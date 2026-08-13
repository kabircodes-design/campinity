import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Heart, ImageOff } from 'lucide-react'
import { getPostById } from '../firebase/postService.js'
import { getCanonicalUrl } from '../sharing/shareTypes.js'

/**
 * Registry-driven, same principle as SharedCard.jsx (Sharing System) —
 * one component, one entry per entityType, adding a future saveable
 * type needs one registry entry, not a new component. Deliberately a
 * SEPARATE component from SharedCard rather than reused directly:
 * SharedCard's prop shape is built around a chat `message` object
 * (message.type, message.sharedPayload), while a saved item's shape
 * is flatter (entityType, entityId, preview directly) — same
 * architecture principle, different real prop contract.
 */

function PlaceholderCard({ label }) {
  return (
    <div className="aspect-square rounded-xl border border-dashed border-gray-200 flex items-center justify-center p-2">
      <p className="text-[11px] text-gray-400 text-center">{label} — coming soon</p>
    </div>
  )
}

function UnavailableCard({ message }) {
  return (
    <div className="aspect-square rounded-xl bg-gray-50 border border-gray-100 flex flex-col items-center justify-center gap-1.5 p-2">
      <ImageOff className="w-4 h-4 text-gray-300" />
      <p className="text-[10px] text-gray-400 text-center">{message}</p>
    </div>
  )
}

const ENTITY_REGISTRY = {
  post: {
    fetch: (entityId, currentUid) => getPostById(entityId, currentUid),
    render: (post, navigate) => (
      <button
        type="button"
        onClick={() => navigate(getCanonicalUrl('post', post.id))}
        className="aspect-square rounded-xl overflow-hidden border border-gray-100 relative group"
      >
        {post.file ? (
          <div className="w-full h-full bg-indigo-50 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
            <FileText className="w-6 h-6 text-indigo-500 flex-shrink-0" />
            <p className="text-[10px] font-medium text-gray-700 line-clamp-2">{post.file.name}</p>
            {(post.subject || post.chapter) && (
              <p className="text-[9px] text-gray-400 line-clamp-1">{[post.subject, post.chapter].filter(Boolean).join(' · ')}</p>
            )}
          </div>
        ) : post.imagePreviewUrl ? (
          <img src={post.imagePreviewUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gray-50 flex items-center justify-center p-2">
            <p className="text-[10px] text-gray-500 line-clamp-4">{post.text}</p>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Heart className="w-3 h-3 text-white" fill="white" />
          <span className="text-[10px] text-white font-medium">{post.likes}</span>
        </div>
      </button>
    ),
    unavailableMessage: 'Post unavailable'
  },
  profile: { fetch: null, render: null, placeholderLabel: 'Profile' },
  event: { fetch: null, render: null, placeholderLabel: 'Event' },
  community: { fetch: null, render: null, placeholderLabel: 'Community' },
  club: { fetch: null, render: null, placeholderLabel: 'Club' },
  marketplace: { fetch: null, render: null, placeholderLabel: 'Listing' }
}

export default function SavedItemCard({ item, currentUid }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const entry = ENTITY_REGISTRY[item.entityType]

  useEffect(() => {
    if (!entry?.fetch) {
      setLoading(false)
      return undefined
    }
    let cancelled = false
    entry
      .fetch(item.entityId, currentUid)
      .then((result) => {
        if (cancelled) return
        if (!result) setFailed(true)
        else setData(result)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [entry, item.entityId, currentUid])

  if (!entry) return <UnavailableCard message="Unsupported item" />
  if (!entry.render) return <PlaceholderCard label={entry.placeholderLabel} />
  if (loading) return <div className="aspect-square rounded-xl bg-gray-100 animate-pulse" />
  if (failed || !data) return <UnavailableCard message={entry.unavailableMessage || 'Unavailable'} />

  return entry.render(data, navigate)
}
