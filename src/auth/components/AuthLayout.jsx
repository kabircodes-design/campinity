import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Logo from '../../components/Logo.jsx'
import Icon from '../../components/Icon.jsx'

const ease = [0.16, 1, 0.3, 1]

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.04 } }
}

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease } }
}

const floaters = [
  { icon: 'users', top: '18%', left: '72%', delay: 0 },
  { icon: 'calendar', top: '68%', left: '80%', delay: 0.6 },
  { icon: 'masks', top: '78%', left: '18%', delay: 1.2 }
]

/**
 * Shared shell for every auth-flow page (Login, Signup, Create Profile).
 * Owns the full viewport (h-dvh + overflow-hidden — never the browser's
 * own scrollbar) and the desktop split-screen brand panel, so each page
 * only supplies its own copy/fields and automatically gets the same
 * cohesive frame. If a page's content genuinely can't fit a short
 * viewport, the <main> column (not the page) is the single contained
 * scroll region — there is never more than one scrolling element at once.
 */
export default function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  maxWidthClass = 'max-w-[400px]',
  brandHeading = (
    <>
      Your campus.
      <br />
      One place.
    </>
  ),
  brandBody = 'Everything happening around your campus — feeds, notes, communities and people, all in one login.'
}) {
  return (
    <div className="h-dvh min-h-dvh w-full overflow-hidden bg-bg dark:bg-[#09090f] flex flex-col lg:flex-row relative">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-28 left-1/2 -translate-x-1/2 lg:left-[26%] w-[420px] h-[420px] sm:w-[560px] sm:h-[560px] rounded-full bg-accent-tint dark:bg-blue-500/10 blur-3xl opacity-70" />
        <div className="hidden lg:block absolute -bottom-40 right-[-120px] w-[440px] h-[440px] rounded-full bg-accent-glow/10 blur-3xl opacity-40" />
      </div>

      <div className="hidden lg:flex lg:w-[44%] xl:w-[42%] flex-col justify-center px-14 xl:px-20 relative overflow-hidden bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700 text-white flex-shrink-0">
        <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-white/5" aria-hidden="true" />
        <div className="absolute -bottom-28 -left-14 w-80 h-80 rounded-full bg-white/5" aria-hidden="true" />

        {floaters.map((f) => (
          <div
            key={f.icon}
            className="hidden xl:flex absolute w-11 h-11 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm animate-floatSlow"
            style={{ top: f.top, left: f.left, animationDelay: `${f.delay}s` }}
            aria-hidden="true"
          >
            <Icon name={f.icon} className="w-5 h-5 text-white/70" strokeWidth={1.5} />
          </div>
        ))}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="relative"
        >
          <Link to="/" className="inline-flex items-center" aria-label="Back to Campinity home">
            <Logo className="w-8 h-8" withWordmark forceDark />
          </Link>
          <p className="mt-8 text-[2.15rem] xl:text-4xl font-display font-bold leading-tight">{brandHeading}</p>
          <p className="mt-4 text-indigo-100/90 text-[15px] leading-relaxed max-w-sm">{brandBody}</p>
        </motion.div>
      </div>

      <div className="relative z-10 flex-1 min-h-0 flex flex-col">
        <header className="lg:hidden relative container-px pt-5 flex-shrink-0">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }}>
            <Link to="/" className="inline-flex items-center" aria-label="Back to Campinity home">
              <Logo className="w-7 h-7" withWordmark />
            </Link>
          </motion.div>
        </header>

        <main className="relative flex-1 min-h-0 flex items-center justify-center container-px py-4 sm:py-8 overflow-y-auto">
          <motion.div variants={stagger} initial="hidden" animate="show" className={`w-full ${maxWidthClass}`}>
            {(eyebrow || title) && (
              <motion.div variants={item}>
                {eyebrow && <p className="eyebrow mb-2.5 text-center">{eyebrow}</p>}
                <h1 className="text-center font-display font-bold text-balance text-[1.6rem] leading-[1.15] sm:text-[1.75rem]">
                  {title}
                </h1>
                {subtitle && (
                  <p className="mt-2 text-center text-[13.5px] sm:text-[14.5px] text-ink-soft dark:text-gray-400 leading-relaxed text-balance">
                    {subtitle}
                  </p>
                )}
              </motion.div>
            )}

            <motion.div
              variants={item}
              className="mt-6 sm:mt-7 rounded-xl3 border border-line dark:border-white/10 bg-surface dark:bg-[#11131a] shadow-card dark:shadow-none p-5 sm:p-7"
            >
              {children}
            </motion.div>

            {footer && (
              <motion.div variants={item} className="mt-5 text-center text-[13.5px] text-ink-soft dark:text-gray-400">
                {footer}
              </motion.div>
            )}

            <motion.p variants={item} className="hidden xs:block mt-4 text-center text-2xs text-ink-faint dark:text-gray-500">
              By continuing you agree to Campinity's{' '}
              <a href="#" className="text-ink-soft hover:text-accent dark:text-gray-400 dark:hover:text-blue-400 transition-colors duration-200">
                Terms
              </a>{' '}
              and{' '}
              <a href="#" className="text-ink-soft hover:text-accent dark:text-gray-400 dark:hover:text-blue-400 transition-colors duration-200">
                Privacy Policy
              </a>
              .
            </motion.p>
          </motion.div>
        </main>
      </div>
    </div>
  )
}
