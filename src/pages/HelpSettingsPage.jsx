import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const FAQS = [
  { q: 'How do I verify my campus?', a: 'Go to your profile, tap Edit Profile, and follow the campus verification steps — verified accounts show a blue check next to their name.' },
  { q: 'How do message requests work?', a: "Messaging someone you don't follow (and who doesn't follow you) sends a request. They can accept or decline it from Messages > Requests before you can chat normally." },
  { q: 'How do I block someone?', a: 'Open their profile, tap the menu (⋯), and choose Block. You can review and unblock anyone from Settings > Privacy > Blocked users.' },
  { q: 'How do I control who can message me?', a: 'Go to Settings > Privacy > Who can message me, and choose Everyone or People you follow.' },
  { q: 'How do I delete my account?', a: 'Go to Settings > Delete Account. This permanently removes your profile, posts, and messages — it cannot be undone.' }
]

/** Real content, not a placeholder — App.jsx's /settings/help route previously rendered <ComingSoon>. */
export default function HelpSettingsPage() {
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
            <span className="text-base font-bold tracking-tight text-gray-900">Help &amp; Support</span>
          </div>
        </header>

        <main className="px-4 py-4">
          <div className="rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
            {FAQS.map((item) => (
              <details key={item.q} className="group px-4 py-3.5">
                <summary className="text-sm font-medium text-gray-900 cursor-pointer list-none flex items-center justify-between gap-2">
                  {item.q}
                  <span className="text-gray-300 group-open:rotate-45 transition-transform duration-200 text-lg leading-none">+</span>
                </summary>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
