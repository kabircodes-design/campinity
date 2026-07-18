import { Sparkles } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'

/**
 * Temporary stand-in so every nav destination is a real, working route
 * from day one. Each of these gets replaced by its real page as that
 * feature is built (Search, Create Post, Messages, Profile, ...) —
 * nothing about this component needs to survive that swap.
 */
export default function ComingSoon({ title, subtitle }) {
  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm flex items-center justify-center px-6 text-center">
        <div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto text-blue-600">
            <Sparkles className="w-6 h-6" strokeWidth={1.7} />
          </div>
          <h1 className="mt-4 text-lg font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-blue-600 font-medium">{subtitle}</p>}
          <p className="mt-2 text-sm text-gray-400 leading-relaxed max-w-xs mx-auto">
            This page is next in the build queue.
          </p>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}