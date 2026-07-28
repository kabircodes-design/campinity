import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

/**
 * Premium post-signup success overlay, shown as a sibling of the
 * signup card (e.g. inside the same `relative` container as the auth
 * background). Auto-dismisses on its own a couple seconds after
 * appearing — no action required from the caller beyond passing
 * `active`.
 *
 * Every prop is optional and defaults safely, so this never throws
 * even if SignupPage.jsx (or anything else) renders it with nothing
 * passed at all.
 *
 * Styled as a fixed dark glassmorphism card with a blue glow,
 * independent of the app's Light/Dark/System + theme-pack system —
 * consistent with how the rest of the pre-auth pages (login/signup
 * background) are deliberately theme-independent, so this always
 * looks the same regardless of what a returning user previously chose
 * in Settings. Every color here is either a literal hex/rgba value or
 * an opacity-modified Tailwind utility (bg-white/10, text-white/70,
 * etc.) — never a bare `bg-white` / `text-gray-*` class, which would
 * otherwise get silently remapped by the app's global theme-token
 * overrides.
 */
export default function SignupCelebration({
  active = false,
  title = 'Account Created Successfully',
  message = "Welcome to Campinity — you're almost in.",
  durationMs = 2600,
  onDone
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) return undefined

    setVisible(true)
    const timer = window.setTimeout(() => {
      setVisible(false)
      if (typeof onDone === 'function') onDone()
    }, durationMs)

    return () => window.clearTimeout(timer)
  }, [active, durationMs, onDone])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center px-4 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          role="status"
          aria-live="polite"
        >
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />

          <motion.div
            className="relative w-full max-w-[340px] rounded-3xl px-8 py-10 text-center overflow-hidden"
            style={{
              background: 'rgba(15, 18, 32, 0.6)',
              backdropFilter: 'blur(22px)',
              WebkitBackdropFilter: 'blur(22px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.45), 0 0 80px rgba(59, 130, 246, 0.18)'
            }}
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.div
              className="absolute -inset-10 -z-10"
              style={{
                background: 'radial-gradient(circle, rgba(59,130,246,0.35), transparent 65%)',
                filter: 'blur(20px)'
              }}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1.1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />

            <motion.div
              className="mx-auto flex items-center justify-center w-16 h-16 rounded-full"
              style={{
                background: 'radial-gradient(circle at 40% 35%, #60a5fa, #2563eb 70%)',
                boxShadow: '0 0 30px rgba(59, 130, 246, 0.6)'
              }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.45, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none">
                <motion.path
                  d="M5 12.5L10 17.5L19 7"
                  stroke="#ffffff"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.4, ease: 'easeOut' }}
                />
              </svg>
            </motion.div>

            <motion.h2
              className="mt-6 text-lg font-bold text-white"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35 }}
            >
              {title}
            </motion.h2>

            <motion.p
              className="mt-2 text-sm leading-relaxed text-white/65"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.45 }}
            >
              {message}
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}