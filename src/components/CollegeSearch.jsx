import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import CollegeDropdown from './CollegeDropdown.jsx'
import { searchColleges } from '../firebase/collegeService.js'

const DEBOUNCE_MS = 400

/**
 * @param {string} id - input id, for label association
 * @param {string} label - field label
 * @param {object|null} value - the selected college object (or null)
 * @param {(college: object|null) => void} onChange - called with the
 *   selected college object, or null when the selection is cleared.
 *   Free-typed text is NEVER passed here — only a full college object
 *   from Firestore, or null.
 * @param {string} error - inline validation message
 * @param {boolean} disabled
 */
export default function CollegeSearch({ id, label, value, onChange, error, disabled }) {
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const [query, setQuery] = useState(value?.name || '')
  const [isOpen, setIsOpen] = useState(false)
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'success' | 'error'
  const requestIdRef = useRef(0)

  useEffect(() => {
    setQuery(value?.name || '')
  }, [value])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
        setQuery(value?.name || '')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [value])

  // Debounced Firestore search — only runs while the dropdown is open,
  // guards against a slow/stale response overwriting a newer keystroke's
  // result (same request-id pattern as useUsernameAvailability).
  useEffect(() => {
    if (!isOpen) return undefined

    const trimmed = query.trim()
    requestIdRef.current += 1

    if (!trimmed) {
      setResults([])
      setStatus('idle')
      return undefined
    }

    setStatus('loading')
    const requestId = requestIdRef.current

    const timer = window.setTimeout(async () => {
      try {
        const data = await searchColleges(trimmed)
        if (requestIdRef.current !== requestId) return
        setResults(data)
        setStatus('success')
      } catch {
        if (requestIdRef.current !== requestId) return
        setResults([])
        setStatus('error')
      }
    }, DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [query, isOpen])

  const handleInputChange = (event) => {
    setQuery(event.target.value)
    setIsOpen(true)
    if (value) onChange(null)
  }

  const handleSelect = (college) => {
    onChange(college)
    setQuery(college.name)
    setIsOpen(false)
  }

  const handleAddCollege = () => {
    setIsOpen(false)
    navigate('/college/add')
  }

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          {label}
        </label>
      )}

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          id={id}
          type="text"
          value={query}
          disabled={disabled}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder="Search by college, city or state"
          autoComplete="off"
          aria-describedby={error ? `${id}-error` : undefined}
          className={`w-full rounded-xl border bg-gray-50 pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all duration-300 ${
            error ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'
          }`}
        />
      </div>

      {isOpen && (
        <CollegeDropdown
          query={query}
          results={results}
          status={status}
          onSelect={handleSelect}
          onAddCollege={handleAddCollege}
        />
      )}

      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}