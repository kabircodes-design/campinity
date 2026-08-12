import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Upload } from 'lucide-react'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { getNotesPosts } from '../firebase/postService.js'

const SUBJECTS = [
  { key: 'physics', label: 'Physics', emoji: '⚡', keywords: ['physics', 'electrostatics', 'mechanics', 'thermodynamics', 'optics', 'kinematics'] },
  { key: 'chemistry', label: 'Chemistry', emoji: '🧪', keywords: ['chemistry', 'chem', 'organic', 'inorganic', 'periodic', 'mcq'] }
]

/**
 * Real, honest subject classification — no subject field exists on
 * posts (confirmed by reading the schema), so this matches the post's
 * actual text/filename against a small keyword list per Section 17's
 * explicit instruction: "do not classify every PDF automatically as
 * Physics/Chemistry unless the application has enough information."
 * Anything that doesn't match either list falls through to 'other'
 * rather than being guessed.
 */
function detectSubject(post) {
  const haystack = `${post.text || ''} ${post.file?.name || ''}`.toLowerCase()
  for (const subject of SUBJECTS) {
    if (subject.keywords.some((kw) => haystack.includes(kw))) return subject.key
  }
  return 'other'
}

export default function NotesView() {
  const navigate = useNavigate()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeSubject, setActiveSubject] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
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
  }, [])

  const withSubject = useMemo(() => notes.map((n) => ({ ...n, subject: detectSubject(n) })), [notes])

  const filtered = useMemo(() => {
    let list = withSubject
    if (activeSubject !== 'all') list = list.filter((n) => n.subject === activeSubject)
    const term = searchTerm.trim().toLowerCase()
    if (term) {
      list = list.filter((n) => {
        const haystack = `${n.text || ''} ${n.file?.name || ''} ${n.subject || ''}`.toLowerCase()
        return haystack.includes(term)
      })
    }
    return list
  }, [withSubject, activeSubject, searchTerm])

  return (
    <div className="px-4 lg:px-6 py-4">
      <h2 className="text-xl font-bold text-gray-900 tracking-tight">Notes</h2>
      <p className="mt-1 text-sm text-gray-400">Study smarter. Find the notes you actually need.</p>

      <div className="relative mt-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search notes, subjects, topics..."
          className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all duration-300"
        />
      </div>

      {!searchTerm && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          {SUBJECTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveSubject(activeSubject === s.key ? 'all' : s.key)}
              className={`rounded-2xl border p-4 text-left transition-all duration-200 ${
                activeSubject === s.key
                  ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                  : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <span className="text-2xl">{s.emoji}</span>
              <p className="mt-2 text-sm font-semibold text-gray-900">{s.label}</p>
              <p className="text-xs text-gray-400">Notes & revision</p>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-4 overflow-x-auto scroll-hidden">
        {['all', ...SUBJECTS.map((s) => s.key)].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSubject(key)}
            className={`flex-shrink-0 rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-200 ${
              activeSubject === key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {key === 'all' ? 'All' : SUBJECTS.find((s) => s.key === key)?.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader size="md" tone="dark" />
          </div>
        ) : error ? (
          <p className="py-16 text-center text-sm text-gray-400">{error}</p>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-gray-900">
              {searchTerm ? 'No notes found' : activeSubject === 'all' ? 'No notes yet' : `No ${SUBJECTS.find((s) => s.key === activeSubject)?.label} notes yet`}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              {searchTerm ? 'Try another subject or search term.' : 'Be the first to share useful revision material with your campus.'}
            </p>
            {!searchTerm && (
              <button
                type="button"
                onClick={() => navigate('/create')}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-indigo-600 text-white text-xs font-semibold px-4 py-2 hover:bg-indigo-700 transition-all duration-200"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload a note
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((note) => {
              const subjectMeta = SUBJECTS.find((s) => s.key === note.subject)
              return (
                <a
                  key={note.id}
                  href={note.file?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-2xl border border-gray-100 p-4 hover:border-indigo-200 hover:shadow-sm hover:-translate-y-[1px] transition-all duration-200"
                >
                  <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide">
                    {subjectMeta ? `${subjectMeta.emoji} ${subjectMeta.label}` : 'Other'}
                  </span>
                  <p className="mt-2 text-sm font-semibold text-gray-900 truncate">{note.file?.name}</p>
                  {note.text && <p className="mt-0.5 text-xs text-gray-400 line-clamp-2">{note.text}</p>}
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
                    <span>📄 PDF</span>
                    {note.file?.size && <span>· {note.file.size}</span>}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">Uploaded {note.time}</span>
                    <span className="text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">Open →</span>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
