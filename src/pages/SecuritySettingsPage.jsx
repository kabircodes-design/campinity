import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { BadgeCheck, Clock, KeyRound, LogOut, Mail, MailWarning, ShieldCheck, Smartphone } from 'lucide-react'
import SettingsItem from '../components/SettingsItem.jsx'
import SettingsPageShell, { SectionLabel } from '../components/settings/SettingsPageShell.jsx'
import { auth } from '../firebase/firebase.js'

/**
 * Security — real actions only: password change (reauth + updatePassword),
 * email change (verifyBeforeUpdateEmail), email verification status, and
 * secure logout of this device. Signing out OTHER devices, a login-activity
 * list and two-factor authentication need server support Campinity doesn't
 * have yet (Firebase's client SDK can't list or revoke other sessions), so
 * they are shown as not available rather than faked.
 */
const NotYet = () => <span className="text-[11px] font-semibold text-gray-300 dark:text-gray-600">Not available yet</span>

export default function SecuritySettingsPage() {
  const navigate = useNavigate()
  const user = auth.currentUser
  const usesPassword = Boolean(user?.providerData?.some((p) => p.providerId === 'password'))
  const [signingOut, setSigningOut] = useState(false)

  const logout = async () => {
    setSigningOut(true)
    await signOut(auth).catch(() => {})
    navigate('/login', { replace: true })
  }

  return (
    <SettingsPageShell title="Security">
      <SectionLabel>Sign-in</SectionLabel>
      {usesPassword ? (
        <SettingsItem icon={KeyRound} label="Change password" description="Requires your current password" onClick={() => navigate('/settings/change-password')} />
      ) : (
        <SettingsItem icon={KeyRound} label="Password" description="You sign in with Google — manage it in your Google account" />
      )}
      <SettingsItem icon={Mail} label="Email address" description={user?.email || '—'} onClick={() => navigate('/settings/email')} />
      <SettingsItem
        icon={user?.emailVerified ? BadgeCheck : MailWarning}
        label="Email verification"
        description={user?.emailVerified ? 'Your email is verified' : 'Verify your email to keep your account secure'}
        rightElement={user?.emailVerified ? <span className="text-[11.5px] font-semibold text-emerald-600 dark:text-emerald-400">Verified</span> : undefined}
        onClick={user?.emailVerified ? undefined : () => navigate('/verify-email')}
      />

      <SectionLabel>Sessions</SectionLabel>
      <SettingsItem icon={LogOut} label={signingOut ? 'Logging out…' : 'Log out of this device'} description="Ends your session on this device" onClick={signingOut ? undefined : logout} />
      <SettingsItem icon={Smartphone} label="Sign out of other devices" description="Needs server support — changing your password is the safest way today" rightElement={<NotYet />} />
      <SettingsItem icon={Clock} label="Login activity" description="A list of recent sign-ins" rightElement={<NotYet />} />
      <SettingsItem icon={ShieldCheck} label="Two-factor authentication" description="Extra sign-in protection" rightElement={<NotYet />} />
    </SettingsPageShell>
  )
}
