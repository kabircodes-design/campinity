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

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-line bg-surface">
      <Container className="pt-14 pb-8 sm:pt-16">
        <div className="grid sm:grid-cols-3 gap-10 sm:gap-8">
          <div>
            <Logo className="w-8 h-8" withWordmark premium />
            <p className="mt-4 text-[13.5px] text-ink-soft leading-relaxed max-w-[240px]">
              The operating system for college campuses. Every profile
              verified. Privacy always first.
            </p>
          </div>

          <div>
            <p className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint mb-4">
              Contact
            </p>
            <ul className="space-y-3 text-[13.5px]">
              <li className="text-ink-soft">
                Founder — <span className="text-ink font-medium">It's Secret Gng😜</span>
              </li>
              <li>
                <a
                  href="https://wa.me/9173********"
                  className="flex items-center gap-2 text-ink-soft hover:text-accent transition-colors duration-200"
                >
                  <Icon name="whatsapp" className="w-4 h-4" strokeWidth={1.4} />
                  +91 73********
                </a>
              </li>
              <li>
                <a
                  href="mailto:hello@cam**********"
                  className="flex items-center gap-2 text-ink-soft hover:text-accent transition-colors duration-200"
                >
                  <Icon name="mail" className="w-4 h-4" strokeWidth={1.6} />
                  hello@cam**********
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint mb-4">
              Legal
            </p>
            <ul className="space-y-3 text-[13.5px]">
              {legal.map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="text-ink-soft hover:text-accent transition-colors duration-200">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>

            <p className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint mb-4 mt-7">
              Follow
            </p>
            <div className="flex items-center gap-2.5">
              {socials.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  aria-label={social.name}
                  className="w-9 h-9 rounded-full border border-line flex items-center justify-center text-ink-soft hover:text-accent hover:border-accent/30 transition-colors duration-200"
                >
                  <Icon name={social.icon} className="w-4 h-4" strokeWidth={1.5} />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-lineSoft flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-2xs text-ink-faint">© {year} Campinity. All rights reserved.</p>
          <p className="text-2xs text-ink-faint font-mono">Built for students, by student.</p>
        </div>
      </Container>
    </footer>
  )
}