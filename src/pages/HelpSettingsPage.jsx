import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bug, FileText, HeartHandshake, Lock, Send } from 'lucide-react'
import SettingsItem from '../components/SettingsItem.jsx'
import SettingsPageShell, { Notice, SectionLabel, fieldCls, primaryBtn } from '../components/settings/SettingsPageShell.jsx'
import { auth } from '../firebase/firebase.js'
import { submitReport } from '../firebase/reportService.js'

const FAQS = [
  { q: 'How do I verify my campus?', a: 'Go to your profile, tap Edit Profile, and follow the campus verification steps — verified accounts show a blue check next to their name.' },
  { q: 'How do message requests work?', a: "Messaging someone you don't follow (and who doesn't follow you) sends a request. They can accept or decline it from Messages > Requests before you can chat normally." },
  { q: 'How do I block someone?', a: 'Open their profile, tap the menu (⋯), and choose Block. You can review and unblock anyone from Settings > Blocked users.' },
  { q: 'How do I control who can message me?', a: 'Go to Settings > Privacy > Who can message me, and choose Everyone or People you follow.' },
  { q: 'How do I change my username or email?', a: 'Go to Settings > Account. Username changes take effect right away; email changes take effect after you open the confirmation link sent to the new address.' },
  { q: 'What is the Notice Board on my profile?', a: 'Official notices from the Campinity team — for everyone, your campus, or just you. Tap a notice to read it in full.' },
  { q: 'How do I delete my account?', a: 'Go to Settings > Delete account. This permanently removes your profile, posts, and messages — it cannot be undone.' }
]

const CATEGORIES = [
  ['bug', 'Something is broken'],
  ['account', 'Account or sign-in problem'],
  ['safety', 'Safety concern'],
  ['other', 'Something else']
]

/**
 * Report a problem goes into the existing moderation pipeline (reports/*,
 * targetType 'app_problem') — the same queue the Admin Panel's Reports
 * inbox reads — so it reaches the team without a new backend.
 */
function ReportProblem() {
  const [category, setCategory] = useState('bug')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState(null)

  const send = async (e) => {
    e.preventDefault()
    const uid = auth.currentUser?.uid
    if (!uid) return
    if (details.trim().length < 10) return setState({ tone: 'error', text: 'Please describe the problem in a few words (10+ characters).' })
    setBusy(true)
    setState(null)
    try {
      const context = `[${navigator.userAgent.includes('Android') ? 'Android' : 'Web'} · v${__APP_VERSION__} · ${window.location.pathname}]`
      await submitReport({ reporterUid: uid, targetType: 'app_problem', targetId: `problem-${Date.now().toString(36)}`, reason: category, details: `${details.trim()} ${context}`.slice(0, 500) })
      setDetails('')
      setState({ tone: 'success', text: 'Thanks — your report reached the Campinity team.' })
    } catch (err) {
      setState({ tone: 'error', text: err?.code === 'permission-denied' ? "We couldn't send your report. Please try again later." : err?.message || "We couldn't send your report." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={send} className="px-4 pb-2 space-y-3">
      <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Problem type" className={fieldCls}>
        {CATEGORIES.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={440} rows={4} placeholder="What happened? What did you expect?" aria-label="Problem details" className={`${fieldCls} resize-y`} />
      {state && <p role={state.tone === 'error' ? 'alert' : 'status'} className={`text-[13px] ${state.tone === 'error' ? 'text-red-600' : 'text-emerald-600 dark:text-emerald-400'}`}>{state.text}</p>}
      <button type="submit" disabled={busy} className={primaryBtn}>
        <span className="inline-flex items-center gap-2">
          <Send className="w-4 h-4" /> {busy ? 'Sending…' : 'Send report'}
        </span>
      </button>
      <p className="text-[11.5px] text-gray-500 dark:text-gray-400">We include the app version, platform and current page to help us investigate. Don't include passwords.</p>
    </form>
  )
}

export default function HelpSettingsPage() {
  const navigate = useNavigate()
  const [showReport, setShowReport] = useState(false)
  return (
    <SettingsPageShell title="Help & Support">
      <SectionLabel>Common questions</SectionLabel>
      <div className="mx-4 rounded-2xl border border-gray-100 divide-y divide-gray-100 dark:border-white/10 dark:divide-white/10 overflow-hidden">
        {FAQS.map((item) => (
          <details key={item.q} className="group px-4 py-3.5">
            <summary className="text-sm font-medium text-gray-900 dark:text-gray-50 cursor-pointer list-none flex items-center justify-between gap-2">
              {item.q}
              <span className="text-gray-300 dark:text-gray-600 group-open:rotate-45 transition-transform duration-200 text-lg leading-none">+</span>
            </summary>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{item.a}</p>
          </details>
        ))}
      </div>

      <SectionLabel>Get help</SectionLabel>
      <SettingsItem icon={Bug} label="Report a problem" description="Tell the Campinity team what went wrong" onClick={() => setShowReport((v) => !v)} />
      {showReport && <ReportProblem />}

      <SectionLabel>Policies</SectionLabel>
      <SettingsItem icon={HeartHandshake} label="Community guidelines" onClick={() => navigate('/settings/legal/guidelines')} />
      <SettingsItem icon={Lock} label="Privacy (summary)" onClick={() => navigate('/settings/legal/privacy')} />
      <SettingsItem icon={FileText} label="Terms (summary)" onClick={() => navigate('/settings/legal/terms')} />
      <Notice tone="info">Questions about a notice or your account can also be sent with “Report a problem”.</Notice>
    </SettingsPageShell>
  )
}
