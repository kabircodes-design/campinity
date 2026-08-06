import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, ImageOff } from 'lucide-react'
import { getPostById } from '../firebase/postService.js'
import { getCanonicalUrl } from './shareTypes.js'

/**
 * ONE reusable component, registry-driven by message.type. Adding a
 * future shareable type means adding one entry to SHARE_REGISTRY below
 * — no new component, no changes to MessageBubble.jsx.
 *
 * Each registry entry: { fetch(referenceId) -> data|null,
 * render(data, preview, navigate) -> JSX }. `fetch` is what makes
 * "the preview updates automatically" real — the actual current
 * document is always loaded, `preview` is only the instant-paint
 * fallback shown while that fetch is in flight or if it fails.
 *
 * Phase 1 ships one COMPLETE entry (shared_post, since Phase 2 is
 * post-sharing specifically) and honest placeholders for every other
 * type — not fake cards, not silent failures, a real "coming soon"
 * state visually consistent with the loading/error states real
 * entries show.
 */

function PlaceholderCard({ label }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 px-3.5 py-3 text-center">
      <p className="text-xs text-gray-400">{label} — coming in a later phase.</p>
    </div>
  )
}

function UnavailableCard({ message }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-3">
      <ImageOff className="w-4 h-4 text-gray-300 flex-shrink-0" />
      <p className="text-xs text-gray-500">{message}</p>
    </div>
  )
}

const SHARE_REGISTRY = {
  shared_post: {
    fetch: (referenceId, currentUid) => getPostById(referenceId, currentUid),
    render: (post, preview, navigate) => (
      <button
        type="button"
        onClick={() => navigate(getCanonicalUrl('post', post.id))}
        className="w-full text-left rounded-xl border border-gray-100 overflow-hidden hover:border-gray-200 transition-all duration-200"
      >
        {post.imagePreviewUrl && (
          <img src={post.imagePreviewUrl} alt="" className="w-full h-32 object-cover" />
        )}
        <div className="p-3">
          <p className="text-xs font-semibold text-gray-900 truncate">{post.name}</p>
          {post.text && <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{post.text}</p>}
          <div className="mt-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <Heart className="w-3 h-3" />
              {post.likes}
            </span>
            <span className="text-[11px] font-semibold text-blue-600">View Post</span>
          </div>
        </div>
      </button>
    ),
    unavailableMessage: 'This post is no longer available.'
  },

  shared_profile: { fetch: null, render: null, placeholderLabel: 'Shared profile' },
  shared_story: { fetch: null, render: null, placeholderLabel: 'Shared story' },
  shared_event: { fetch: null, render: null, placeholderLabel: 'Shared event' },
  shared_community: { fetch: null, render: null, placeholderLabel: 'Shared community' },
  shared_club: { fetch: null, render: null, placeholderLabel: 'Shared club' },
  shared_radar_profile: { fetch: null, render: null, placeholderLabel: 'Shared connection' },
  forwarded_message: { fetch: null, render: null, placeholderLabel: 'Forwarded message' }
}

export default function SharedCard({ message, currentUid }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const entry = SHARE_REGISTRY[message.type]
  const preview = message.sharedPayload?.preview
  const referenceId = message.sharedPayload?.referenceId

  useEffect(() => {
    if (!entry?.fetch || !referenceId) {
      setLoading(false)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    setFailed(false)
    entry
      .fetch(referenceId, currentUid)
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
  }, [entry, referenceId, currentUid])

  if (!entry) {
    // Unknown type — never crash. A future app version might send a
    // type this client doesn't recognize yet (e.g. mid-rollout).
    return <UnavailableCard message="This message type isn't supported yet." />
  }

  if (!entry.render) {
    return <PlaceholderCard label={entry.placeholderLabel} />
  }

  if (loading) {
    return <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />
  }

  if (failed || !data) {
    return <UnavailableCard message={entry.unavailableMessage || 'This content is unavailable.'} />
  }

  return entry.render(data, preview, navigate)
}
