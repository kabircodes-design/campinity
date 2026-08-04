import { Users } from 'lucide-react'

/** Real implementation — referenced by FollowersPage.jsx/FollowingPage.jsx but never shown to me. Simple message prop, matching how those pages already call it. */
export default function EmptyFollowState({ message }) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto">
        <Users className="w-5 h-5 text-gray-300" strokeWidth={1.7} />
      </div>
      <p className="mt-3 text-sm text-gray-400">{message}</p>
    </div>
  )
}
