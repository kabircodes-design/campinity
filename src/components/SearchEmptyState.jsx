import { SearchX } from 'lucide-react'

export default function SearchEmptyState({ query }) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto text-gray-300">
        <SearchX className="w-7 h-7" strokeWidth={1.7} />
      </div>
      <p className="mt-4 text-sm font-semibold text-gray-900">No students or colleges found</p>
      <p className="mt-1 text-sm text-gray-400">
        {query ? `Nothing matched "${query}".` : 'Try a different name, username, course, or college.'}
      </p>
    </div>
  )
}