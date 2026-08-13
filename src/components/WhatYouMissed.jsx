import { useEffect, useMemo, useState } from 'react'
import { Eye } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import { getUserProfile, updateUserProfile } from '../firebase/profileService.js'

/**
 * "What you missed" — every count here is real, derived from data
 * already fetched elsewhere (posts, notesForPreview) compared against
 * genuine lastSeen timestamps read from the user's own profile
 * document. Reuses the exact lastSeenNotesBySubject field built for
 * Notes' own seen/unseen system last session — no duplicate tracking
 * mechanism. A new lastSeenHomeAt field follows that same established
 * pattern for posts specifically. Renders nothing at all when there's
 * genuinely nothing new, per the explicit 'do not spam the user'
 * instruction.
 */
export default function WhatYouMissed({ posts, notes }) {
  const [lastSeenHomeAt, setLastSeenHomeAt] = useState(undefined) // undefined = not loaded yet
  const [lastSeenNotesBySubject, setLastSeenNotesBySubject] = useState(undefined)

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    getUserProfile(uid)
      .then((profile) => {
        setLastSeenHomeAt(profile?.lastSeenHomeAt?.toMillis ? profile.lastSeenHomeAt.toMillis() : null)
        setLastSeenNotesBySubject(profile?.lastSeenNotesBySubject || {})
      })
      .catch(() => {
        setLastSeenHomeAt(null)
        setLastSeenNotesBySubject({})
      })
  }, [])

  const newPostsCount = useMemo(() => {
    if (lastSeenHomeAt === undefined) return 0
    return posts.filter((p) => p.createdAtMs && (lastSeenHomeAt === null || p.createdAtMs > lastSeenHomeAt)).length
  }, [posts, lastSeenHomeAt])

  const newNotesCount = useMemo(() => {
    if (lastSeenNotesBySubject === undefined) return 0
    return notes.filter((n) => {
      const seenAt = lastSeenNotesBySubject[n.subject]
      return n.createdAtMs && (!seenAt || n.createdAtMs > seenAt)
    }).length
  }, [notes, lastSeenNotesBySubject])

  const handleCatchUp = () => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    setLastSeenHomeAt(Date.now())
    updateUserProfile(uid, { lastSeenHomeAt: new Date() }).catch(() => {})
  }

  if (newPostsCount === 0 && newNotesCount === 0) return null

  const parts = []
  if (newPostsCount > 0) parts.push(`${newPostsCount} new post${newPostsCount === 1 ? '' : 's'}`)
  if (newNotesCount > 0) parts.push(`${newNotesCount} new note${newNotesCount === 1 ? '' : 's'}`)

  return (
    <div className="px-4 lg:px-0 mt-4">
      <button
        type="button"
        onClick={handleCatchUp}
        className="w-full flex items-center gap-3 rounded-2xl border border-gray-100 px-4 py-3 text-left hover:border-blue-200 transition-all duration-200"
      >
        <Eye className="w-5 h-5 text-blue-500 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">👀 You missed this</p>
          <p className="text-xs text-gray-400">{parts.join(' · ')}</p>
        </div>
      </button>
    </div>
  )
}
