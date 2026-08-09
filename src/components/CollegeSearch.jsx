import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { Search, X, GraduationCap } from 'lucide-react'
import { db } from '../firebase/firebase.js'

/**
 * Real Firestore search now — a debounced prefix-range query on
 * nameLower, the same established pattern already used elsewhere in
 * this project (searchCommunitiesByName, searchUsersForShare). No
 * longer routes through dummyColleges.js at all — that module no
 * longer exports a search function, per the migration plan's explicit
 * instruction that CollegeSearch.jsx itself should query Firestore
 * directly.
 *
 * Prop interface unchanged from before — { id, label, value, onChange,
 * error, disabled } — EditProfilePage.jsx's existing call site needed
 * no changes. value/onChange still carry the whole college object;
 * display now reads city/state (the real schema) instead of the old
 * fabricated `location` field.
 */
export default function CollegeSearch({ id, label, value, onChange, error, disabled }) {
  const [query_, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const term = query_.trim().toLowerCase()
    if (!term) {
      setResults([])
      setLoading(false)
      return undefined
    }
    setLoading(true)
    const requestId = ++requestIdRef.current
    const timer = window.setTimeout(async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'colleges'),
            where('nameLower', '>=', term),
            where('nameLower', '<=', term + '\uf8ff'),
            limit(20)
          )
        )
        if (requestIdRef.current !== requestId) return // a newer keystroke superseded this search
        setResults(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch {
        if (requestIdRef.current === requestId) setResults([])
      } finally {
        if (requestIdRef.current === requestId) setLoading(false)
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [query_])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (college) => {
    onChange(college)
    setQuery('')
    setOpen(false)
  }

  const handleClear = () => {
    onChange(null)
    setQuery('')
  }

  const selectedLocation = value ? [value.city, value.state].filter(Boolean).join(', ') : ''

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          {label}
        </label>
      )}

      {value ? (
        <div
          className={`w-full flex items-center gap-2.5 rounded-xl border bg-gray-50 px-4 py-2.5 ${
            error ? 'border-red-400' : 'border-gray-200'
          }`}
        >
          <GraduationCap className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900 truncate">{value.name}</p>
            {selectedLocation && <p className="text-[11px] text-gray-400 truncate">{selectedLocation}</p>}
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear selected college"
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            id={id}
            type="text"
            value={query_}
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            disabled={disabled}
            placeholder="Search your college..."
            className={`w-full rounded-xl border bg-gray-50 pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all duration-300 ${
              error ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'
            }`}
          />
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      {open && !value && query_.trim() && (
        <div className="absolute z-30 mt-1.5 w-full max-h-64 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-lg py-1">
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">Searching...</p>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-gray-400">No colleges found.</p>
              <Link
                to="/college/add"
                className="mt-1.5 inline-block text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Can't find your college? Add it
              </Link>
            </div>
          ) : (
            results.map((college) => {
              const location = [college.city, college.state].filter(Boolean).join(', ')
              return (
                <button
                  key={college.id}
                  type="button"
                  onClick={() => handleSelect(college)}
                  className="w-full flex items-center gap-2.5 text-left px-4 py-2.5 hover:bg-gray-50 transition-all duration-150"
                >
                  <GraduationCap className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 truncate">{college.name}</p>
                    {location && <p className="text-[11px] text-gray-400 truncate">{location}</p>}
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
