import Container from './Container.jsx'
import Logo from './Logo.jsx'
import Icon from './Icon.jsx'

const socials = [
  { name: 'Instagram', icon: 'instagram', href: 'https://instagram.com/campinity.xyz' },
  { name: 'LinkedIn', icon: 'linkedin', href: 'https://linkedin.com/company/campinity' },
  { name: 'X', icon: 'x', href: 'https://x.com/campinity' }
]

const legal = [
  { label: 'Privacy Policy', href: '#' },
  { label: 'Terms', href: '#' }
]

/**
 * The actual bug: this file used to render <Logo ... premium /> — a
 * prop the current Logo.jsx no longer accepts (harmlessly ignored,
 * not a crash) — sitting next to text/border classes (text-ink,
 * text-ink-soft, text-ink-faint, border-line, bg-surface,
 * border-lineSoft) from the OLD static color system, not the new
 * --theme-* token system. Logo itself switches correctly with the
 * theme; everything else in this file never did, because it was never
 * on the token system to begin with. That mismatch — icon/wordmark
 * correctly flipping between light/dark while the surrounding footer
 * text stayed frozen at its original color — is what "branding
 * appears partially black and partially white" actually was.
 *
 * Fixed by moving every color in this file onto the same theme-token
 * classes Nav.jsx already uses, and dropping the obsolete `premium`
 * prop.
 */
export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t theme-border theme-bg-surface">
      <Container className="pt-14 pb-8 sm:pt-16">
        <div className="grid sm:grid-cols-3 gap-10 sm:gap-8">
          <div>
            <Logo className="w-8 h-8" withWordmark />
            <p className="mt-4 text-[13.5px] theme-text-secondary leading-relaxed max-w-[240px]">
              The operating system for college campuses. Every profile
              verified. Privacy always first.
            </p>
          </div>

          <div>
            <p className="font-mono text-2xs uppercase tracking-[0.1em] theme-text-muted mb-4">
              Contact
            </p>
            <ul className="space-y-3 text-[13.5px]">
              <li className="theme-text-secondary">
                Founder — <span className="theme-text-primary font-medium">Kabir Saiyed</span>
              </li>
              <li>
                <a
                  href="https://wa.me/917387097365"
                  className="flex items-center gap-2 theme-text-secondary hover:theme-accent transition-colors duration-200"
                >
                  <Icon name="whatsapp" className="w-4 h-4" strokeWidth={1.4} />
                  +91 7387097365
                </a>
              </li>
              <li>
                <a
                  href="mailto:hello@cam**********"
                  className="flex items-center gap-2 theme-text-secondary hover:theme-accent transition-colors duration-200"
                >
                  <Icon name="mail" className="w-4 h-4" strokeWidth={1.6} />
                  hello@cam**********
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="font-mono text-2xs uppercase tracking-[0.1em] theme-text-muted mb-4">
              Legal
            </p>
            <ul className="space-y-3 text-[13.5px]">
              {legal.map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="theme-text-secondary hover:theme-accent transition-colors duration-200">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>

            <p className="font-mono text-2xs uppercase tracking-[0.1em] theme-text-muted mb-4 mt-7">
              Follow
            </p>
            <div className="flex items-center gap-2.5">
              {socials.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  aria-label={social.name}
                  className="w-9 h-9 rounded-full border theme-border flex items-center justify-center theme-text-secondary hover:theme-accent hover:border-[color:var(--theme-accent)] transition-colors duration-200"
                >
                  <Icon name={social.icon} className="w-4 h-4" strokeWidth={1.5} />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t theme-divider flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-2xs theme-text-muted">© {year} Campinity. All rights reserved.</p>
          <p className="text-2xs theme-text-muted font-mono">Built for students, by student.</p>
        </div>
      </Container>
    </footer>
  )
}
