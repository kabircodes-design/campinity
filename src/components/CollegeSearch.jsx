import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import CollegeDropdown from './CollegeDropdown.jsx'
import { searchColleges } from '../data/dummyColleges.js'

/**
 * @param {string} id - input id, for label association
 * @param {string} label - field label
 * @param {object|null} value - the selected college object (or null)
 * @param {(college: object|null) => void} onChange - called with the
 *   selected college object, or null when the selection is cleared.
 *   Free-typed text is NEVER passed here — only a full college object
 *   from the verified list, or null.
 * @param {string} error - inline validation message
 * @param {boolean} disabled
 */
export default function CollegeSearch({ id, label, value, onChange, error, disabled }) {
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const [query, setQuery] = useState(value?.name || '')
  const [isOpen, setIsOpen] = useState(false)

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

  const results = isOpen ? searchColleges(query) : []

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
        <CollegeDropdown query={query} results={results} onSelect={handleSelect} onAddCollege={handleAddCollege} />
      )}

      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}