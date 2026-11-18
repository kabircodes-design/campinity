import { useNavigate } from 'react-router-dom'
import { BookOpen, FileText, LifeBuoy, ShieldCheck, Sparkles } from 'lucide-react'
import Logo from '../components/Logo.jsx'
import SettingsPageShell from '../components/settings/SettingsPageShell.jsx'
import { Card, ListRow, RowGroup } from '../components/ui/Premium.jsx'

const builtOn = (() => {
  try {
    return new Date(__BUILD_TIME__).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
})()

/** Real content: version/build come from vite.config.js defines. */
export default function AboutSettingsPage() {
  const navigate = useNavigate()
  return (
    <SettingsPageShell title="About Campinity">
      <div className="px-4 space-y-5 pt-2">
        <Card className="relative overflow-hidden px-6 py-8 text-center bg-gradient-to-b from-blue-50 to-white dark:from-blue-500/10 dark:to-[#11131a]">
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full bg-blue-400/15 blur-3xl pointer-events-none" aria-hidden="true" />
          <Logo className="relative w-16 h-16 mx-auto drop-shadow-sm" />
          <h2 className="relative mt-4 text-[22px] font-bold tracking-tight text-gray-900 dark:text-gray-50">Campinity</h2>
          <p className="relative mt-1 text-sm text-gray-600 dark:text-gray-300 max-w-xs mx-auto leading-relaxed">
            Your campus, one place — feeds, notes, communities and people, all in one login.
          </p>
          <div className="relative mt-5 inline-flex items-center gap-2 rounded-full bg-white/80 dark:bg-white/10 border border-gray-100 dark:border-white/10 px-3.5 py-1.5 text-[12.5px] text-gray-600 dark:text-gray-300">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span>
              Version <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-50">{__APP_VERSION__}</span>
              {builtOn && <span> · Built {builtOn}</span>}
            </span>
          </div>
        </Card>

        <RowGroup label="Policies">
          <ListRow icon={BookOpen} tone="blue" title="Community guidelines" description="How we keep Campinity kind and safe" onClick={() => navigate('/settings/legal/guidelines')} />
          <ListRow icon={ShieldCheck} tone="emerald" title="Privacy (summary)" description="What we collect and why" onClick={() => navigate('/settings/legal/privacy')} />
          <ListRow icon={FileText} tone="violet" title="Terms (summary)" description="The main rules for using Campinity" onClick={() => navigate('/settings/legal/terms')} />
        </RowGroup>

        <RowGroup label="Support">
          <ListRow icon={LifeBuoy} tone="amber" title="Help & support" description="FAQs and report a problem" onClick={() => navigate('/settings/help')} />
        </RowGroup>

        <p className="text-center text-[12px] text-gray-400 dark:text-gray-500 pb-2">Made for students, by students.</p>
      </div>
    </SettingsPageShell>
  )
}
