import { Loader2 } from 'lucide-react'
import CollegeOption from './CollegeOption.jsx'

export default function CollegeDropdown({ query, results, status, onSelect, onAddCollege }) {
  const trimmed = query.trim()

  return (
    <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-72 overflow-y-auto">
      {trimmed.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gray-400">Start typing to search colleges</p>
      ) : status === 'loading' ? (
        <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Searching colleges...
        </div>
      ) : status === 'error' ? (
        <p className="px-4 py-6 text-center text-sm text-red-500">Couldn't load colleges — try again</p>
      ) : results.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gray-400">No colleges found for "{trimmed}"</p>
      ) : (
        <ul>
          {results.map((college) => (
            <li key={college.id}>
              <CollegeOption college={college} onSelect={onSelect} />
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onAddCollege}
        className="w-full flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-semibold text-blue-600 hover:bg-blue-50 border-t border-gray-100 transition-all duration-300"
      >
        Can't find your college?
      </button>
    </div>
  )
}