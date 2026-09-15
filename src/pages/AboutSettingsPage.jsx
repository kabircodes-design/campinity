import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Logo from '../components/Logo.jsx'

/** Real content, not a placeholder — App.jsx's /settings/about route previously rendered <ComingSoon>. */
export default function AboutSettingsPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50 dark:bg-[#09090f]">
      <div className="mx-auto max-w-[480px] lg:max-w-[640px] bg-white dark:bg-[#11131a] min-h-screen lg:shadow-sm dark:lg:shadow-none">
        <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#11131a]/95 backdrop-blur-md border-b border-gray-100 dark:border-white/10">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate('/settings')}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-50">About Campinity</span>
          </div>
        </header>

        <main className="px-4 py-8 text-center">
          <Logo className="w-14 h-14 mx-auto" />
          <p className="mt-4 text-lg font-bold text-gray-900 dark:text-gray-50">Campinity</p>
          <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Version 1.0.0 (MVP)</p>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
            Your campus, one place — feeds, notes, communities and people, all in one login.
          </p>
        </main>
      </div>
    </div>
  )
}
