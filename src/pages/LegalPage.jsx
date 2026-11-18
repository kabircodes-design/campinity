import { useParams } from 'react-router-dom'
import SettingsPageShell, { Notice } from '../components/settings/SettingsPageShell.jsx'

/**
 * Community guidelines + plain-language summaries of how Campinity handles
 * data and use. The summaries describe what the app actually does today;
 * they are NOT a substitute for full legal documents, and say so.
 */
const DOCS = {
  guidelines: {
    title: 'Community guidelines',
    intro: 'Campinity is a space for students to connect. Keep it respectful, safe and genuine.',
    sections: [
      ['Be yourself', 'Use your real identity. Don’t impersonate other students, staff, clubs or Campinity.'],
      ['Respect people', 'No harassment, bullying, hate speech, threats or targeted abuse — in posts, comments, chats or calls.'],
      ['Keep it safe', 'No sexual content involving anyone without consent, no content involving minors, no promotion of self-harm or violence.'],
      ['Be honest', 'No scams, spam, fake listings or misleading information. Marketplace and Lost & Found posts must be real.'],
      ['Respect privacy', 'Don’t share someone’s personal details, private messages or photos without their permission.'],
      ['Academic integrity', 'Share notes to help others learn — not to cheat on exams or assignments, or to share material you don’t have the right to share.'],
      ['Reporting', 'Use Report on any post, comment, profile or listing. Reports are reviewed by the Campinity team, who may remove content or restrict or suspend accounts.']
    ]
  },
  privacy: {
    title: 'Privacy (summary)',
    intro: 'A plain-language summary of how Campinity handles your information today.',
    sections: [
      ['What we store', 'Your account (email, sign-in method), your profile (name, username, photo, bio, campus, course), the content you post, your messages, and settings such as notification and privacy preferences.'],
      ['Who sees what', 'Your profile and public posts are visible to signed-in students. Your email is not shown on your profile. Messages are visible only to the people in the conversation.'],
      ['Location', 'If you turn on Radar, your exact location is readable only by you; others see campus-level proximity, never your coordinates.'],
      ['Verification documents', 'Campus ID documents you submit are used only to verify you and are reviewed by the Campinity team.'],
      ['Your controls', 'Choose who can message you, hide your activity status, block people, and delete your account from Settings.'],
      ['Deletion', 'Deleting your account removes your profile, posts and messages from Campinity.']
    ]
  },
  terms: {
    title: 'Terms (summary)',
    intro: 'A plain-language summary of the main rules for using Campinity.',
    sections: [
      ['Eligibility', 'Campinity is for students. Keep your account details accurate and your password private.'],
      ['Your content', 'You own what you post. By posting, you let Campinity display it to the audience you choose.'],
      ['Acceptable use', 'Follow the Community guidelines. Don’t misuse the service, attempt to access other accounts, or interfere with how Campinity works.'],
      ['Moderation', 'Campinity may remove content and restrict, suspend or close accounts that break the rules.'],
      ['Changes', 'Features may change as Campinity grows. Important changes will be announced in the app, for example on your Notice Board.']
    ]
  }
}

export default function LegalPage() {
  const { doc: key } = useParams()
  const d = DOCS[key] || DOCS.guidelines
  return (
    <SettingsPageShell title={d.title} back="/settings/help">
      <p className="px-4 pt-3 text-[14px] leading-relaxed text-gray-600 dark:text-gray-300">{d.intro}</p>
      <div className="px-4 pt-4 space-y-4">
        {d.sections.map(([h, body]) => (
          <section key={h}>
            <h2 className="text-[14.5px] font-bold text-gray-900 dark:text-gray-50">{h}</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-gray-600 dark:text-gray-300">{body}</p>
          </section>
        ))}
      </div>
      {key !== 'guidelines' && <Notice tone="warn">This is a summary, not the full legal policy. A complete {key === 'privacy' ? 'privacy policy' : 'terms of service'} has not been published yet.</Notice>}
    </SettingsPageShell>
  )
}
