import { useEffect, useMemo, useState } from 'react'

/**
 * Single self-contained animated background component — icons, blur
 * circles, connection lines, and particles all live in this one file on
 * purpose, alongside CampusBackground.css. No sibling components, no
 * data files, no icon folder.
 *
 * Usage:
 *   <AnimatedBackground variant="landing" />
 *   <AnimatedBackground variant="login" />
 *   <AnimatedBackground variant="signup" />
 *
 * Renders `position: absolute; inset: 0; pointer-events: none` behind
 * everything — the host page needs `position: relative` on its outer
 * wrapper and its real content wrapped in `relative z-10` so it always
 * paints above this layer.
 */

const ICON_PATHS = {
  book: 'M4 19.5V5.5C4 4.4 4.9 3.5 6 3.5H20V17.5H6C4.9 17.5 4 18.4 4 19.5ZM4 19.5C4 20.6 4.9 21.5 6 21.5H20V17.5',
  cap: 'M2 8L12 3L22 8L12 13L2 8Z M6 10.5V16C6 16 8.5 18 12 18C15.5 18 18 16 18 16V10.5 M22 8V14',
  chat: 'M4 5.5C4 4.4 4.9 3.5 6 3.5H18C19.1 3.5 20 4.4 20 5.5V14.5C20 15.6 19.1 16.5 18 16.5H9L5 20V16.5H6C4.9 16.5 4 15.6 4 14.5V5.5Z',
  notes: 'M6 3.5H14L18 7.5V20.5H6V3.5Z M14 3.5V7.5H18 M8.5 12H15 M8.5 15.5H15',
  star: 'M12 3L14.4 9.1L21 9.6L16 13.9L17.6 20.4L12 16.9L6.4 20.4L8 13.9L3 9.6L9.6 9.1L12 3Z'
}

function CampusIcon({ name, ...props }) {
  const raw = ICON_PATHS[name]
  if (!raw) return null
  const paths = raw.split(' M')

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {paths.map((d, i) => (
        <path key={i} d={i === 0 ? d : `M${d}`} />
      ))}
    </svg>
  )
}

// Hand-placed, not generated — each entry is a real design decision:
// icon, position, size, opacity, animation timing.
const LANDING_ELEMENTS = [
  { icon: 'book', top: '8%', left: '6%', size: 34, opacity: 0.1, duration: 16, delay: 0 },
  { icon: 'cap', top: '14%', left: '82%', size: 40, opacity: 0.12, duration: 19, delay: 1.5 },
  { icon: 'chat', top: '68%', left: '10%', size: 30, opacity: 0.09, duration: 14, delay: 0.8 },
  { icon: 'notes', top: '78%', left: '86%', size: 32, opacity: 0.1, duration: 17, delay: 2.2 },
  { icon: 'star', top: '24%', left: '46%', size: 18, opacity: 0.14, duration: 12, delay: 0.4 },
  { icon: 'book', top: '52%', left: '92%', size: 26, opacity: 0.08, duration: 15, delay: 3 },
  { icon: 'cap', top: '86%', left: '40%', size: 28, opacity: 0.1, duration: 18, delay: 1.1 },
  { icon: 'chat', top: '38%', left: '4%', size: 24, opacity: 0.09, duration: 13, delay: 2.6 },
  { icon: 'star', top: '6%', left: '38%', size: 14, opacity: 0.13, duration: 11, delay: 1.8 },
  { icon: 'notes', top: '58%', left: '58%', size: 22, opacity: 0.07, duration: 20, delay: 0.6 },
  { icon: 'star', top: '90%', left: '68%', size: 16, opacity: 0.12, duration: 10, delay: 2.9 },
  { icon: 'book', top: '30%', left: '70%', size: 20, opacity: 0.08, duration: 16.5, delay: 1.3 },
  { icon: 'cap', top: '46%', left: '22%', size: 24, opacity: 0.09, duration: 14.5, delay: 3.4 },
  { icon: 'chat', top: '12%', left: '58%', size: 22, opacity: 0.08, duration: 18.5, delay: 0.9 },
  { icon: 'star', top: '72%', left: '30%', size: 15, opacity: 0.13, duration: 9.5, delay: 2.1 },
  { icon: 'notes', top: '94%', left: '14%', size: 26, opacity: 0.07, duration: 17.5, delay: 1.6 }
]

const LOGIN_ELEMENTS = [
  { icon: 'cap', top: '10%', left: '10%', size: 30, opacity: 0.08, duration: 18, delay: 0 },
  { icon: 'book', top: '78%', left: '88%', size: 28, opacity: 0.07, duration: 16, delay: 1.5 },
  { icon: 'star', top: '20%', left: '86%', size: 14, opacity: 0.1, duration: 12, delay: 0.8 },
  { icon: 'notes', top: '86%', left: '16%', size: 24, opacity: 0.06, duration: 19, delay: 2.2 },
  { icon: 'chat', top: '54%', left: '4%', size: 22, opacity: 0.06, duration: 15, delay: 1.1 },
  { icon: 'star', top: '46%', left: '94%', size: 12, opacity: 0.09, duration: 11, delay: 2.7 }
]

const SIGNUP_ELEMENTS = [
  { icon: 'book', top: '12%', left: '88%', size: 28, opacity: 0.07, duration: 17, delay: 0.3 },
  { icon: 'cap', top: '82%', left: '8%', size: 32, opacity: 0.08, duration: 19, delay: 1.4 },
  { icon: 'star', top: '18%', left: '12%', size: 14, opacity: 0.1, duration: 12, delay: 0.6 },
  { icon: 'chat', top: '64%', left: '92%', size: 24, opacity: 0.06, duration: 15.5, delay: 2 },
  { icon: 'notes', top: '90%', left: '58%', size: 22, opacity: 0.06, duration: 18, delay: 1 },
  { icon: 'star', top: '40%', left: '4%', size: 12, opacity: 0.09, duration: 10.5, delay: 2.5 }
]

const VARIANT_ELEMENTS = { landing: LANDING_ELEMENTS, login: LOGIN_ELEMENTS, signup: SIGNUP_ELEMENTS }
const VARIANT_PARTICLE_COUNT = { landing: 14, login: 7, signup: 7 }

function getViewportTier() {
  if (typeof window === 'undefined') return 'desktop'
  const w = window.innerWidth
  if (w < 640) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

export default function AnimatedBackground({ variant = 'landing' }) {
  const [tier, setTier] = useState(getViewportTier)
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  const [parallax, setParallax] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleResize = () => setTier(getViewportTier())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = (e) => setReducedMotion(e.matches)
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  const parallaxEnabled = variant === 'landing' && tier === 'desktop' && !reducedMotion

  useEffect(() => {
    if (!parallaxEnabled) {
      setParallax({ x: 0, y: 0 })
      return undefined
    }
    let frame = null
    const handleMouseMove = (event) => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        setParallax({
          x: (event.clientX / window.innerWidth - 0.5) * 2,
          y: (event.clientY / window.innerHeight - 0.5) * 2
        })
        frame = null
      })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [parallaxEnabled])

  const densityCap = tier === 'mobile' ? 0.35 : tier === 'tablet' ? 0.65 : 1
  const intensity = tier === 'mobile' ? 0.7 : tier === 'tablet' ? 0.88 : 1

  const elements = useMemo(() => {
    const base = VARIANT_ELEMENTS[variant] || VARIANT_ELEMENTS.landing
    const count = Math.max(3, Math.round(base.length * densityCap))
    return base.slice(0, count).map((el) => ({ ...el, opacity: +(el.opacity * intensity).toFixed(3) }))
  }, [variant, densityCap, intensity])

  const particleCount = Math.max(0, Math.round((VARIANT_PARTICLE_COUNT[variant] || 8) * densityCap))
  const particles = useMemo(
    () =>
      Array.from({ length: particleCount }).map((_, i) => ({
        id: i,
        top: `${(i * 37) % 100}%`,
        left: `${(i * 61) % 100}%`,
        size: 2 + (i % 3),
        duration: 10 + (i % 8),
        delay: +(((i * 9) % 50) / 10).toFixed(1)
      })),
    [particleCount]
  )

  const lines = variant === 'landing'
    ? [
        { x1: 12, y1: 20, x2: 38, y2: 42, delay: 0 },
        { x1: 70, y1: 15, x2: 55, y2: 38, delay: 2 },
        { x1: 80, y1: 70, x2: 60, y2: 55, delay: 4 },
        { x1: 20, y1: 75, x2: 42, y2: 60, delay: 1 }
      ]
    : [
        { x1: 15, y1: 18, x2: 40, y2: 40, delay: 0 },
        { x1: 78, y1: 74, x2: 58, y2: 56, delay: 2.5 }
      ]

  return (
    <div
      className={`campus-bg campus-bg--${variant} ${reducedMotion ? 'campus-bg--reduced-motion' : ''}`}
      style={{ '--parallax-x': `${parallax.x * 10}px`, '--parallax-y': `${parallax.y * 10}px` }}
      aria-hidden="true"
    >
      <div className="campus-bg__gradient" />

      <span className="campus-bg__blob campus-bg__blob--1" />
      <span className="campus-bg__blob campus-bg__blob--2" />
      <span className="campus-bg__blob campus-bg__blob--3" />

      <svg className="campus-bg__lines" viewBox="0 0 100 100" preserveAspectRatio="none">
        {lines.map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            className="campus-bg__line"
            style={{ '--line-delay': `${line.delay}s` }}
          />
        ))}
      </svg>

      <div className="campus-bg__layer">
        {elements.map((el, i) => (
          <span
            key={i}
            className="campus-bg__icon"
            style={{
              top: el.top,
              left: el.left,
              width: el.size,
              height: el.size,
              '--icon-opacity': el.opacity,
              '--float-duration': `${el.duration}s`,
              '--float-delay': `${el.delay}s`
            }}
          >
            <CampusIcon name={el.icon} className="w-full h-full" />
          </span>
        ))}

        {particles.map((p) => (
          <span
            key={p.id}
            className="campus-bg__particle"
            style={{
              top: p.top,
              left: p.left,
              width: p.size,
              height: p.size,
              '--float-duration': `${p.duration}s`,
              '--float-delay': `${p.delay}s`
            }}
          />
        ))}
      </div>
    </div>
  )
}