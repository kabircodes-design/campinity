import { useEffect, useState } from 'react'
import '../styles/FloatingAcademicObjects.css'

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = (event) => setReduced(event.matches)
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])
  return reduced
}

/* Minimal, consistent-stroke line icons — same visual language as the
   rest of this project's custom icon work (thin stroke, rounded caps,
   no fill), not a icon-library import. */
const ICONS = {
  book: 'M4 19.5V5.5C4 4.4 4.9 3.5 6 3.5H20V17.5H6C4.9 17.5 4 18.4 4 19.5ZM4 19.5C4 20.6 4.9 21.5 6 21.5H20V17.5',
  cap: 'M2 8L12 3L22 8L12 13L2 8Z M6 10.5V16C6 16 8.5 18 12 18C15.5 18 18 16 18 16V10.5 M22 8V14',
  document: 'M6 3.5H14L18 7.5V20.5H6V3.5Z M14 3.5V7.5H18 M8.5 12H15 M8.5 15.5H15',
  idCard: 'M3 6.5H21V17.5H3V6.5Z M6.5 10H9.5V14H6.5V10 M12.5 10.5H18 M12.5 13.5H16',
  folder: 'M3 6.5C3 5.4 3.9 4.5 5 4.5H9L11 6.5H19C20.1 6.5 21 7.4 21 8.5V17.5C21 18.6 20.1 19.5 19 19.5H5C3.9 19.5 3 18.6 3 17.5V6.5Z',
  pencil: 'M4 20L4.8 16.2L15.6 5.4C16.4 4.6 17.7 4.6 18.5 5.4C19.3 6.2 19.3 7.5 18.5 8.3L7.7 19.1L4 20Z M13.8 7.2L16.8 10.2'
}

const OBJECTS = [
  { icon: 'book', top: '8%', left: '10%', size: 30, opacity: 0.16, duration: 15, delay: 0, depth: 0.4 },
  { icon: 'cap', top: '14%', left: '78%', size: 34, opacity: 0.15, duration: 18, delay: 1.4, depth: 0.7 },
  { icon: 'document', top: '68%', left: '6%', size: 26, opacity: 0.14, duration: 13, delay: 0.7, depth: 0.3 },
  { icon: 'idCard', top: '76%', left: '82%', size: 28, opacity: 0.15, duration: 16, delay: 2.1, depth: 0.6 },
  { icon: 'folder', top: '40%', left: '88%', size: 24, opacity: 0.13, duration: 14, delay: 0.3, depth: 0.5 },
  { icon: 'pencil', top: '48%', left: '4%', size: 22, opacity: 0.13, duration: 17, delay: 1.8, depth: 0.35 },
  { icon: 'book', top: '86%', left: '40%', size: 20, opacity: 0.1, duration: 12, delay: 2.6, depth: 0.25 }
]

/**
 * Ambient environmental motion replacing the mascot — small academic
 * objects (book, cap, document, ID card, folder, pencil) drifting
 * slowly around the Hero, each with its own size/opacity/speed so
 * nothing reads as a repeating pattern. `depth` scales how far each
 * object shifts on scroll-based parallax (handled by the caller via
 * CSS custom property --chp-scroll, set from a scroll listener; this
 * component works with or without that being set — it degrades to
 * pure idle float if the variable is never updated).
 *
 * transform + opacity only, no layout-affecting properties. Respects
 * prefers-reduced-motion (idle drift stops; objects stay visible but
 * static).
 */
export default function FloatingAcademicObjects({ className = '' }) {
  const reducedMotion = usePrefersReducedMotion()

  return (
    <div className={`chp-float-objects ${className}`.trim()} aria-hidden="true">
      {OBJECTS.map((obj, i) => (
        <span
          key={i}
          className={`chp-float-object ${reducedMotion ? 'chp-float-object--static' : ''}`}
          style={{
            top: obj.top,
            left: obj.left,
            width: obj.size,
            height: obj.size,
            '--chp-obj-opacity': obj.opacity,
            '--chp-obj-duration': `${obj.duration}s`,
            '--chp-obj-delay': `${obj.delay}s`,
            '--chp-obj-depth': obj.depth
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            {ICONS[obj.icon].split(' M').map((d, j) => (
              <path key={j} d={j === 0 ? d : `M${d}`} />
            ))}
          </svg>
        </span>
      ))}
    </div>
  )
}
