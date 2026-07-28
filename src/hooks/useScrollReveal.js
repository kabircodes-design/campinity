import { useEffect, useRef, useState } from 'react'

/**
 * Intersection Observer-based scroll-reveal. Attach the returned ref to
 * any section; `visible` flips to true once, the first time it enters
 * the viewport (observer then disconnects — a one-time reveal, not a
 * repeating scroll effect). Pairs with the .campus-reveal /
 * .campus-reveal--visible classes in CampusBackground.css (opacity +
 * translateY only).
 *
 * Usage:
 *   const [ref, visible] = useScrollReveal()
 *   <section ref={ref} className={`campus-reveal ${visible ? 'campus-reveal--visible' : ''}`}>
 */
export function useScrollReveal(threshold = 0.15) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold])

  return [ref, visible]
}