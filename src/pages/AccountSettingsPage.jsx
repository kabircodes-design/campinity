import { useNavigate } from 'react-router-dom'
import { AtSign, KeyRound, LogIn, Mail, ShieldCheck, User } from 'lucide-react'
import SettingsItem from '../components/SettingsItem.jsx'
import SettingsPageShell, { SectionLabel } from '../components/settings/SettingsPageShell.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { auth } from '../firebase/firebase.js'

/**
 * Account hub — every row opens a real, working flow:
 * Edit profile · Username (reservation transaction) · Email (Firebase
 * verifyBeforeUpdateEmail) · Password (reauth + updatePassword).
 * Account information is read from Firebase Auth + the real profile.
 */
const PROVIDER_LABEL = { password: 'Email & password', 'google.com': 'Google' }

export default function AccountSettingsPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const user = auth.currentUser
  const usesPassword = Boolean(user?.providerData?.some((p) => p.providerId === 'password'))
  const created = user?.metadata?.creationTime ? new Date(user.metadata.creationTime) : profile?.createdAt?.toDate?.() || null
  const lastSignIn = user?.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime) : null
  const fmt = (d) => (d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '—')
  const verifiedBadge = (
    <span className={`text-[11.5px] font-semibold ${user?.emailVerified ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-300'}`}>{user?.emailVerified ? 'Verified' : 'Not verified'}</span>
  )

  return (
    <SettingsPageShell title="Account">
      <SectionLabel>Profile</SectionLabel>
      <SettingsItem icon={User} label="Edit profile" description="Photo, name, bio, campus, course" onClick={() => navigate('/profile/edit')} />
      <SettingsItem icon={AtSign} label="Username" description={profile?.username ? `@${profile.username}` : 'Choose a username'} onClick={() => navigate('/settings/username')} />

      <SectionLabel>Sign-in</SectionLabel>
      <SettingsItem icon={Mail} label="Email address" description={user?.email || '—'} rightElement={verifiedBadge} onClick={() => navigate('/settings/email')} />
      {usesPassword && <SettingsItem icon={KeyRound} label="Password" description="Change your password" onClick={() => navigate('/settings/change-password')} />}

      <SectionLabel>Account information</SectionLabel>
      <dl className="mx-4 rounded-2xl border border-gray-100 dark:border-white/10 divide-y divide-gray-100 dark:divide-white/10 text-[13.5px]">
        {[
          ['Campus status', profile?.verifiedCampus ? <span className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400"><ShieldCheck className="w-4 h-4" /> Verified Campus Member</span> : 'Not verified'],
          ['Campus', [profile?.college, profile?.course, profile?.year].filter(Boolean).join(' · ') || '—'],
          ['Signs in with', (user?.providerData || []).map((p) => PROVIDER_LABEL[p.providerId] || p.providerId).join(', ') || '—'],
          ['Member since', fmt(created)],
          ['Last sign-in', fmt(lastSignIn)]
        ].map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-4 px-4 py-3">
            <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
            <dd className="text-right text-gray-900 dark:text-gray-50 min-w-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="px-4 pt-3 flex items-center gap-1.5 text-[12px] text-gray-400 dark:text-gray-500">
        <LogIn className="w-3.5 h-3.5" /> Log out and account deletion are on the main Settings page.
      </p>
    </SettingsPageShell>
  )
}
