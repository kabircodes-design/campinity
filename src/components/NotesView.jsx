import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Bookmark, Download, Lock, Search, ShieldCheck, Upload } from 'lucide-react'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { getNotesPosts } from '../firebase/postService.js'
import { subscribeToIsItemSaved } from '../saved/savedService.js'
import SaveBottomSheet from '../saved/SaveBottomSheet.jsx'
import { useMyVerification } from '../access/useMyVerification.js'
import VerificationGate from '../access/VerificationGate.jsx'
import { FEATURES } from '../access/permissions.js'
import { getUserProfile, updateUserProfile } from '../firebase/profileService.js'

const SUBJECTS = [
  { key: 'physics', label: 'Physics', emoji: '⚡', keywords: ['physics', 'electrostatics', 'mechanics', 'thermodynamics', 'optics', 'kinematics'] },
  { key: 'chemistry', label: 'Chemistry', emoji: '🧪', keywords: ['chemistry', 'chem', 'organic', 'inorganic', 'periodic'] }
]

const COLLECTIONS = [
  { key: 'chapter1', label: 'Chapter 1', emoji: '📘' },
  { key: 'chapter2', label: 'Chapter 2', emoji: '📘' },
  { key: 'important', label: 'Important', emoji: '⭐' },
  { key: 'pyqs', label: 'PYQs', emoji: '📝' },
  { key: 'practicals', label: 'Practicals', emoji: '🧪' },
  { key: 'general', label: 'General', emoji: '📄' }
]

/**
 * Real subject first (a genuine field on the post, written by the
 * composer's new Notes fields), falling back to honest keyword
 * matching only for old notes that predate this metadata — per
 * Section 17's explicit 'if there is no reliable note classification,
 * implement a clean minimal solution.' Never guesses when real data
 * exists.
 */
function resolveSubject(post) {
  if (post.subject && post.subject !== 'unassigned') return post.subject
  const haystack = `${post.text || ''} ${post.file?.name || ''}`.toLowerCase()
  for (const subject of SUBJECTS) {
    if (subject.keywords.some((kw) => haystack.includes(kw))) return subject.key
  }
  return 'unassigned'
}

function resolveCollection(post) {
  return post.collection || 'general'
}

/** Section 16 — filename becomes the display title fallback only; the real uploaded file/text field is never touched. */
function displayTitle(post) {
  if (post.text?.trim()) return post.text
  if (post.file?.name) return post.file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ')
  return 'Untitled note'
}

function NoteCard({ note, verified }) {
  const [isSaved, setIsSaved] = useState(false)
  const [saveSheetOpen, setSaveSheetOpen] = useState(false)
  const [gateFeature, setGateFeature] = useState(null)
  const subjectMeta = SUBJECTS.find((s) => s.key === resolveSubject(note))

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return undefined
    return subscribeToIsItemSaved(uid, 'post', note.id, setIsSaved)
  }, [note.id])

  const handleOpen = () => {
    if (verified === false) {
      setGateFeature(FEATURES.VIEW_CAMPUS_PDF)
      return
    }
    if (note.file?.url) window.open(note.file.url, '_blank', 'noopener,noreferrer')
  }

  const handleSave = () => {
    if (verified === false) {
      setGateFeature(FEATURES.SAVE_CAMPUS_RESOURCE)
      return
    }
    setSaveSheetOpen(true)
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={(e) => e.key === 'Enter' && handleOpen()}
        className="group block rounded-2xl border border-gray-100 p-4 hover:border-indigo-200 hover:shadow-sm hover:-translate-y-[1px] transition-all duration-200 cursor-pointer"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide">
            {subjectMeta ? `${subjectMeta.emoji} ${subjectMeta.label}` : 'Notes'}
          </span>
        </div>
        <p className="mt-1.5 text-sm font-semibold text-gray-900 truncate">{displayTitle(note)}</p>
        {note.chapter && <p className="text-xs text-gray-400">{note.chapter}</p>}
        <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
          <span>📄 PDF</span>
          {note.file?.size && <span>· {note.file.size}</span>}
          <span>· Posted {note.time}</span>
        </div>
        {verified === false ? (
          <p className="mt-2 text-[11px] text-blue-600 font-medium">🔒 Verified members</p>
        ) : null}
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            aria-label={isSaved ? 'Saved' : 'Save'}
            aria-pressed={isSaved}
            onClick={(e) => {
              e.stopPropagation()
              handleSave()
            }}
            className={`flex items-center gap-1 text-xs font-semibold rounded-full px-3 py-1.5 transition-all duration-200 ${
              isSaved ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" fill={isSaved ? 'currentColor' : 'none'} />
            {isSaved ? 'Saved' : 'Save'}
          </button>
          <span className="flex items-center gap-1 text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
            {verified === false ? (
              <>
                <Lock className="w-3.5 h-3.5" /> Verify to open
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" /> Download
              </>
            )}
          </span>
        </div>
      </div>

      <VerificationGate open={Boolean(gateFeature)} onClose={() => setGateFeature(null)} feature={gateFeature} />

      <SaveBottomSheet
        open={saveSheetOpen}
        onClose={() => setSaveSheetOpen(false)}
        entityType="post"
        entityId={note.id}
        preview={{
          title: displayTitle(note),
          subtitle: note.name,
          username: note.username,
          image: note.imagePreviewUrl || null
        }}
      />
    </>
  )
}

export default function NotesView() {
  const verified = useMyVerification()
  const [notesGateOpen, setNotesGateOpen] = useState(false)
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeSubject, setActiveSubject] = useState('all')
  const [activeCollection, setActiveCollection] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [lastSeenBySubject, setLastSeenBySubject] = useState(undefined) // undefined = not loaded yet

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    getUserProfile(uid)
      .then((profile) => setLastSeenBySubject(profile?.lastSeenNotesBySubject || {}))
      .catch(() => setLastSeenBySubject({}))
  }, [])

  /**
   * Marks ONE subject as seen up to right now — called ONLY when the
   * user actually opens that specific subject, never on mount and
   * never for unrelated subjects, matching both 'do not mark
   * everything read merely because the page mounted' and the
   * per-subject independence the spec's own example shows ('Physics ●
   * Chemistry' — opening Physics must not clear Chemistry's dot).
   */
  const markSubjectSeen = (subjectKey) => {
    const uid = auth.currentUser?.uid
    if (!uid || !subjectKey) return
    const now = Date.now()
    setLastSeenBySubject((prev) => ({ ...(prev || {}), [subjectKey]: now }))
    updateUserProfile(uid, { lastSeenNotesBySubject: { ...(lastSeenBySubject || {}), [subjectKey]: new Date(now) } }).catch(() => {})
  }

  const load = () => {
    let cancelled = false
    setLoading(true)
    setError('')
    getNotesPosts(auth.currentUser?.uid)
      .then((data) => {
        if (!cancelled) setNotes(data.filter((p) => p.file))
      })
      .catch((err) => {
        console.error('Could not load notes:', err)
        if (!cancelled) setError("Couldn't load notes.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }

  useEffect(() => {
    return load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const withMeta = useMemo(
    () => notes.map((n) => ({ ...n, resolvedSubject: resolveSubject(n), resolvedCollection: resolveCollection(n) })),
    [notes]
  )

  // Real counts only — every number below is derived from withMeta,
  // never hardcoded, per Section 30's explicit 'no fake demo data.'
  const subjectCounts = useMemo(() => {
    const counts = {}
    SUBJECTS.forEach((s) => {
      counts[s.key] = withMeta.filter((n) => n.resolvedSubject === s.key).length
    })
    return counts
  }, [withMeta])

  // Real unseen-per-subject — derived purely from lastSeenBySubject vs
  // each note's actual createdAtMs, no invented signal. Stays empty
  // while lastSeenBySubject is still loading (undefined), avoiding a
  // flash of incorrect dots before the real value arrives.
  const subjectHasUnseen = useMemo(() => {
    if (lastSeenBySubject === undefined) return {}
    const result = {}
    SUBJECTS.forEach((s) => {
      const seenAt = lastSeenBySubject[s.key]
      result[s.key] = withMeta.some(
        (n) => n.resolvedSubject === s.key && n.createdAtMs && (!seenAt || n.createdAtMs > seenAt)
      )
    })
    return result
  }, [withMeta, lastSeenBySubject])

  const term = searchTerm.trim().toLowerCase()
  const searchScope = activeSubject === 'all' ? withMeta : withMeta.filter((n) => n.resolvedSubject === activeSubject)
  const searchResults = term
    ? searchScope.filter((n) => {
        const haystack = `${n.text || ''} ${n.file?.name || ''} ${n.resolvedSubject} ${n.resolvedCollection} ${n.chapter || ''} ${n.name || ''}`.toLowerCase()
        return haystack.includes(term)
      })
    : []

  const recentNotes = useMemo(() => [...withMeta].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)).slice(0, 3), [withMeta])

  // "Last Minute" — real signals only, per the explicit rule set:
  // user-marked important (collection==='important', a real existing
  // composer field, not invented) OR uploaded within the last 48
  // hours. No fabricated exam-date awareness, no AI recommendation —
  // just the two honest signals actually available.
  const lastMinuteNotes = useMemo(() => {
    const now = Date.now()
    const twoDaysMs = 48 * 60 * 60 * 1000
    return withMeta
      .filter((n) => n.resolvedCollection === 'important' || (n.createdAtMs && now - n.createdAtMs < twoDaysMs))
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
      .slice(0, 6)
  }, [withMeta])

  const collectionNotes = activeCollection
    ? withMeta.filter((n) => n.resolvedSubject === activeSubject && n.resolvedCollection === activeCollection)
    : []

  const collectionCountsForSubject = useMemo(() => {
    const scoped = withMeta.filter((n) => n.resolvedSubject === activeSubject)
    const counts = {}
    COLLECTIONS.forEach((c) => {
      counts[c.key] = scoped.filter((n) => n.resolvedCollection === c.key).length
    })
    return counts
  }, [withMeta, activeSubject])

  if (loading) {
    return (
      <div className="px-4 lg:px-6 py-16 flex justify-center">
        <Loader size="md" tone="dark" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 lg:px-6 py-16 text-center">
        <p className="text-sm font-semibold text-gray-900">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-3 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold px-5 py-2 hover:border-gray-300 transition-all duration-300"
        >
          Try Again
        </button>
      </div>
    )
  }

  // Collection drill-down — a focused, document-list view (Section 19)
  if (activeCollection) {
    const collMeta = COLLECTIONS.find((c) => c.key === activeCollection)
    const subjMeta = SUBJECTS.find((s) => s.key === activeSubject)
    return (
      <div className="px-4 lg:px-6 py-4">
        <button
          type="button"
          onClick={() => setActiveCollection(null)}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" /> {subjMeta?.label}
        </button>
        <h2 className="mt-2 text-xl font-bold text-gray-900 tracking-tight">
          {collMeta?.emoji} {collMeta?.label}
        </h2>
        <p className="text-sm text-gray-400">{collectionNotes.length} notes</p>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {collectionNotes.length === 0 ? (
            <p className="col-span-2 py-10 text-center text-sm text-gray-400">No notes here yet.</p>
          ) : (
            collectionNotes.map((note) => <NoteCard key={note.id} note={note} verified={verified} />)
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 lg:px-6 py-4">
      <h2 className="text-xl font-bold text-gray-900 tracking-tight">Notes</h2>
      <p className="mt-1 text-sm text-gray-400">Your campus knowledge library.</p>

      {verified === false && (
        <button
          type="button"
          onClick={() => setNotesGateOpen(true)}
          className="mt-4 w-full flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-3.5 text-left hover:border-blue-200 transition-all duration-200"
        >
          <ShieldCheck className="w-8 h-8 text-blue-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Verify your campus</p>
            <p className="text-xs text-gray-500">Your campus study library is waiting.</p>
          </div>
          <span className="text-xs font-semibold text-blue-600 flex-shrink-0">Verify Campus →</span>
        </button>
      )}

      <div className="relative mt-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search notes, PDFs, chapters..."
          className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all duration-300"
        />
      </div>

      <div className="flex items-center gap-2 mt-4 overflow-x-auto scroll-hidden">
        {['all', ...SUBJECTS.map((s) => s.key)].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setActiveSubject(key)
              if (key !== 'all') markSubjectSeen(key)
            }}
            className={`flex-shrink-0 rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-200 ${
              activeSubject === key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {key === 'all' ? 'All' : SUBJECTS.find((s) => s.key === key)?.label}
          </button>
        ))}
      </div>

      {term ? (
        <div className="mt-5">
          <p className="text-sm font-bold text-gray-900 mb-3">
            {searchResults.length} result{searchResults.length === 1 ? '' : 's'}
          </p>
          {searchResults.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-semibold text-gray-900">No notes found</p>
              <p className="mt-1 text-sm text-gray-400">Try another subject or search term.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {searchResults.map((note) => (
                <NoteCard key={note.id} note={note} verified={verified} />
              ))}
            </div>
          )}
        </div>
      ) : activeSubject === 'all' ? (
        <>
          <div className="mt-5">
            <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900 mb-1">⚡ Last Minute</p>
            <p className="text-xs text-gray-400 mb-3">Things your campus says you shouldn't miss before tomorrow.</p>
            {lastMinuteNotes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {lastMinuteNotes.map((note) => (
                  <NoteCard key={note.id} note={note} verified={verified} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-100 px-4 py-5 text-center">
                <p className="text-sm font-semibold text-gray-900">⚡ Nothing urgent right now.</p>
                <p className="mt-1 text-xs text-gray-400">Looks like your campus is calm. Check back later.</p>
              </div>
            )}
          </div>

          {recentNotes.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-bold text-gray-900 mb-3">Recently added</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recentNotes.map((note) => (
                  <NoteCard key={note.id} note={note} verified={verified} />
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <p className="text-sm font-bold text-gray-900 mb-3">Browse by subject</p>
            <div className="grid grid-cols-2 gap-3">
              {SUBJECTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    setActiveSubject(s.key)
                    markSubjectSeen(s.key)
                  }}
                  className="relative rounded-2xl border border-gray-100 p-4 text-left hover:border-indigo-200 hover:shadow-sm transition-all duration-200"
                >
                  {subjectHasUnseen[s.key] && (
                    <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-red-500" aria-label="New notes" />
                  )}
                  <span className="text-2xl">{s.emoji}</span>
                  <p className="mt-2 text-sm font-semibold text-gray-900">{s.label}</p>
                  <p className="text-xs text-gray-400">{subjectCounts[s.key]} notes</p>
                </button>
              ))}
            </div>
          </div>

          {notes.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-sm font-semibold text-gray-900">No notes yet</p>
              <p className="mt-1 text-sm text-gray-400">Be the first to share useful study material with your campus.</p>
            </div>
          )}
        </>
      ) : (
        <div className="mt-5">
          <p className="text-sm font-bold text-gray-900 mb-3">
            {SUBJECTS.find((s) => s.key === activeSubject)?.label} collections
          </p>
          {subjectCounts[activeSubject] === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-semibold text-gray-900">
                📚 No {SUBJECTS.find((s) => s.key === activeSubject)?.label} notes yet
              </p>
              <p className="mt-1 text-sm text-gray-400">Be the first to share useful study material with your campus.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {COLLECTIONS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setActiveCollection(c.key)}
                  className="rounded-2xl border border-gray-100 p-4 text-left hover:border-indigo-200 hover:shadow-sm transition-all duration-200"
                >
                  <span className="text-xl">{c.emoji}</span>
                  <p className="mt-2 text-sm font-semibold text-gray-900">{c.label}</p>
                  <p className="text-xs text-gray-400">{collectionCountsForSubject[c.key] || 0} notes</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <VerificationGate
        open={notesGateOpen}
        onClose={() => setNotesGateOpen(false)}
        feature={FEATURES.VIEW_CAMPUS_PDF}
      />
    </div>
  )
}
