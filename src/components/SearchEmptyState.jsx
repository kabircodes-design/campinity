import { SearchX } from 'lucide-react'

/** Shown when a search genuinely returns zero results across every category. */
export default function SearchEmptyState({ query, suggestions = [], onSuggestionClick }) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
        <SearchX className="w-5 h-5 text-gray-400" />
      </div>
      <p className="mt-3 text-sm font-semibold text-gray-900">No results for "{query}"</p>
      <p className="mt-1 text-sm text-gray-400">Try a different name, username, or keyword.</p>
      {suggestions.length > 0 && (
        <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onSuggestionClick?.(name)}
              className="rounded-full bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1.5 hover:bg-gray-200 transition-all duration-200"
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
