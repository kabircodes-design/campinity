import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Logo from '../components/Logo.jsx'

/** Real content, not a placeholder — App.jsx's /settings/about route previously rendered <ComingSoon>. */
export default function AboutSettingsPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[640px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate('/settings')}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900">About Campinity</span>
          </div>
        </header>

        <main className="px-4 py-8 text-center">
          <Logo className="w-14 h-14 mx-auto" />
          <p className="mt-4 text-lg font-bold text-gray-900">Campinity</p>
          <p className="mt-1 text-sm text-gray-400">Version 1.0.0 (MVP)</p>
          <p className="mt-4 text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
            Your campus, one place — feeds, notes, communities and people, all in one login.
          </p>
        </main>
      </div>
    </div>
  )
}
