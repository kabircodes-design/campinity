import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import Logo from './Logo.jsx'
import ThemeToggle from './ThemeToggle.jsx'
import Container from './Container.jsx'
import Icon from './Icon.jsx'

const links = [
  { label: 'Product', href: '#product' },
  { label: 'Journey', href: '#journey' },
  { label: 'Privacy', href: '#privacy' },
  { label: 'Events', href: '#events' }
]

export default function Nav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(window.scrollY > 8)
          ticking = false
        })
        ticking = true
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const handleLinkClick = (href) => {
    setOpen(false)
    const el = document.querySelector(href)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled ? 'theme-glass shadow-nav' : 'bg-transparent'
      }`}
    >
      <Container
        className={`flex items-center justify-between transition-[height] duration-500 ${
          scrolled ? 'h-14 sm:h-16' : 'h-16 sm:h-[72px]'
        }`}
      >
        <a href="#top" className="flex items-center" aria-label="Campinity home">
          <Logo className="w-8 h-8" withWordmark />
        </a>

        <nav className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <button
              key={link.href}
              onClick={() => handleLinkClick(link.href)}
              className="campus-nav-underline text-sm font-medium theme-text-secondary hover:theme-text-primary transition-colors duration-300"
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <ThemeToggle />
          <Link
            to="/login"
            className="theme-bg-accent theme-text-button inline-flex items-center gap-1.5 rounded-full text-sm font-semibold px-5 py-2.5 hover:opacity-90 transition-opacity duration-200"
          >
            Join your campus
            <Icon name="arrow" className="w-4 h-4" />
          </Link>
        </div>

        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setOpen((v) => !v)}
            className="relative w-10 h-10 flex items-center justify-center rounded-full active:opacity-70"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            <span className="relative w-5 h-4 block">
              <motion.span
                className="absolute left-0 top-0 h-[1.5px] w-5 rounded-full theme-bg-accent"
                animate={open ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                style={{ backgroundColor: 'var(--theme-textPrimary)' }}
              />
              <motion.span
                className="absolute left-0 top-[7px] h-[1.5px] w-5 rounded-full"
                animate={open ? { opacity: 0 } : { opacity: 1 }}
                transition={{ duration: 0.15 }}
                style={{ backgroundColor: 'var(--theme-textPrimary)' }}
              />
              <motion.span
                className="absolute left-0 top-[14px] h-[1.5px] w-5 rounded-full"
                animate={open ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                style={{ backgroundColor: 'var(--theme-textPrimary)' }}
              />
            </span>
          </button>
        </div>
      </Container>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="md:hidden theme-bg-surface theme-border border-t"
          >
            <Container className="flex flex-col py-4">
              {links.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleLinkClick(link.href)}
                  className="text-left py-3 text-base font-medium theme-text-primary theme-divider border-b last:border-none"
                >
                  {link.label}
                </button>
              ))}
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-full theme-bg-accent theme-text-button text-sm font-semibold px-5 py-3"
              >
                Join your campus
                <Icon name="arrow" className="w-4 h-4" />
              </Link>
            </Container>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
