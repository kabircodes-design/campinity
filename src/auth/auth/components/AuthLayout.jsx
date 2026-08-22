import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Logo from '../../components/Logo.jsx'

const ease = [0.16, 1, 0.3, 1]

export default function AuthLayout({ eyebrow, title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-bg relative overflow-hidden flex flex-col">
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[560px] h-[560px] rounded-full bg-accent-tint blur-3xl opacity-70"
        aria-hidden="true"
      />

      <header className="relative container-px pt-6 sm:pt-8">
        <Link to="/" className="inline-flex items-center" aria-label="Back to Campinity home">
          <Logo className="w-8 h-8" withWordmark />
        </Link>
      </header>

      <main className="relative flex-1 flex items-center justify-center container-px py-10 sm:py-14">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="w-full max-w-[400px]"
        >
          {eyebrow && <p className="eyebrow mb-3 text-center">{eyebrow}</p>}
          <h1 className="text-center font-display font-bold text-balance text-[1.75rem] leading-[1.15] sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-center text-[14.5px] text-ink-soft leading-relaxed text-balance">
              {subtitle}
            </p>
          )}

          <div className="mt-8 rounded-xl3 border border-line bg-surface shadow-card p-6 sm:p-8">
            {children}
          </div>

          {footer && <div className="mt-6 text-center text-[14px] text-ink-soft">{footer}</div>}
        </motion.div>
      </main>

      <footer className="relative container-px pb-8">
        <p className="text-center text-2xs text-ink-faint">
          By continuing you agree to Campinity's{' '}
          <a href="#" className="text-ink-soft hover:text-accent transition-colors duration-200">
            Terms
          </a>{' '}
          and{' '}
          <a href="#" className="text-ink-soft hover:text-accent transition-colors duration-200">
            Privacy Policy
          </a>
          .
        </p>
      </footer>
    </div>
  )
}
