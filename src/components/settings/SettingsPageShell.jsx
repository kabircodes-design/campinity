import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

/**
 * The exact page frame the existing settings pages use (AccountSettingsPage,
 * SecuritySettingsPage …): sticky header with back button, 480/640 px column,
 * light + dark surfaces. New settings pages use this so they stay identical.
 */
export default function SettingsPageShell({ title, back = '/settings', children, footer }) {
  const navigate = useNavigate()
  return (
    <div className="h-full w-full max-w-[100vw] lg:overflow-y-auto lg:min-w-0 overflow-x-hidden bg-gray-50 dark:bg-[#09090f]">
      <div className="mx-auto max-w-[480px] lg:max-w-[640px] bg-white dark:bg-[#11131a] min-h-full lg:min-h-0 lg:my-4 lg:rounded-2xl lg:border lg:border-gray-100 dark:lg:border-white/10 lg:shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:lg:shadow-none">
        <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#11131a]/95 backdrop-blur-md border-b border-gray-100 dark:border-white/10 lg:rounded-t-2xl">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate(back)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-50">{title}</span>
          </div>
        </header>
        <main className="py-2 pb-10">{children}</main>
        {footer}
      </div>
    </div>
  )
}

export function SectionLabel({ children }) {
  return <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{children}</p>
}

export function Notice({ tone = 'info', children }) {
  const cls = {
    info: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    warn: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
    error: 'bg-red-50 border border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400'
  }[tone]
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`mx-4 mt-3 rounded-xl px-4 py-3 text-[13px] font-medium leading-relaxed ${cls}`}>
      {children}
    </p>
  )
}

export const fieldCls =
  'w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3.5 py-3 text-[15px] text-gray-900 dark:text-gray-50 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:border-blue-500 transition-colors duration-150'
export const primaryBtn =
  'w-full rounded-xl bg-blue-600 text-white text-[15px] font-semibold py-3 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150'
