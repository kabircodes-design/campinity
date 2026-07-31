import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'
import Container from './Container.jsx'
import Icon from './Icon.jsx'
import '../styles/HeroCinematic.css'

const ease = [0.16, 1, 0.3, 1]

/**
 * Cinematic scroll-driven hero — one continuous scene, not a
 * fade-to-next-section transition. A tall wrapper (220vh) creates
 * scroll range; an inner `position: sticky` viewport stays pinned
 * while the user scrolls through it, and Framer Motion's
 * useScroll/useTransform (already a project dependency — no GSAP
 * added, Framer Motion is sufficient here) map that scroll progress
 * onto the background's scale/position, the giant typography's
 * reveal, and the foreground content's exit.
 *
 * True "typography behind the building" occlusion: three stacked
 * layers, not a blend-mode approximation —
 *   1. .chp-cinema__bg   — the full photographed scene (sky + building)
 *   2. .chp-cinema__type — "CAMPINITY", positioned across the frame
 *   3. .chp-cinema__building — a building-only cutout (transparent
 *      everywhere else) extracted from the same source photo, sitting
 *      on top of the type layer
 * Wherever the building cutout is opaque, it physically covers the
 * text underneath — real DOM/z-index occlusion, not a lighting trick.
 * The cutout was produced via GrabCut foreground segmentation on the
 * source photo (bounding box seeded on the building's known position,
 * cleaned to its largest connected region) — not hand-traced, so its
 * edges follow the photo's own silhouette rather than a manual mask,
 * and can have minor softness at fine detail (individual tree
 * branches, the dome's antenna) where segmentation is inherently
 * harder than at large continuous edges like the roofline or columns.
 *
 * Real content (headline, CTA, wording) is unchanged from the existing
 * Hero — only the staging around it changed.
 */
export default function HeroCinematic() {
  const wrapperRef = useRef(null)
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ['start start', 'end start']
  })

  // Camera push-in — background scales up slowly as the user scrolls
  // through the pinned section. The building cutout scales in lockstep
  // (same transform values) so the two layers stay pixel-aligned as
  // they move — if they drifted apart, the occlusion would visibly
  // misalign.
  const cameraScale = useTransform(scrollYProgress, [0, 1], [1, 1.22])
  const cameraY = useTransform(scrollYProgress, [0, 1], ['0%', '-4%'])

  // Giant typography — hidden at scroll start, gradually revealed and
  // very slightly scaled as the "camera" approaches.
  const typeOpacity = useTransform(scrollYProgress, [0.2, 0.62], [0, 1])
  const typeScale = useTransform(scrollYProgress, [0.2, 1], [0.88, 1])

  // Foreground content recedes as the camera pushes in, so it never
  // visually competes with the reveal.
  const contentOpacity = useTransform(scrollYProgress, [0, 0.22], [1, 0])
  const contentY = useTransform(scrollYProgress, [0, 0.3], ['0%', '-5%'])

  const indicatorOpacity = useTransform(scrollYProgress, [0, 0.06], [1, 0])

  return (
    <section ref={wrapperRef} className="chp-cinema relative" style={{ height: '220vh' }}>
      <div className="chp-cinema__pin sticky top-0 h-screen overflow-hidden">
        <motion.div className="chp-cinema__bg" style={{ scale: cameraScale, y: cameraY }} aria-hidden="true" />

        <motion.h2
          className="chp-cinema__type"
          style={{ opacity: typeOpacity, scale: typeScale }}
          aria-hidden="true"
        >
          CAMPINITY
        </motion.h2>

        {/* Building cutout — sits above the type layer, occluding it
            wherever the silhouette is opaque. Scaled identically to
            .chp-cinema__bg so the two stay aligned through the zoom. */}
        <motion.div
          className="chp-cinema__building"
          style={{ scale: cameraScale, y: cameraY }}
          aria-hidden="true"
        />

        <div className="chp-cinema__vignette" aria-hidden="true" />

        <motion.div
          className="relative z-10 h-full flex flex-col items-center justify-end pb-20 sm:pb-28"
          style={{ opacity: contentOpacity, y: contentY }}
        >
          <Container className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease }}
              className="chp-cinema__badge inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 backdrop-blur px-3.5 py-1.5 mb-6"
            >
              <Icon name="shield" className="w-3.5 h-3.5 text-[#79B8FF]" strokeWidth={1.8} />
              <span className="font-mono text-2xs uppercase tracking-[0.12em] text-white/75">
                The operating system for college campuses
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35, ease }}
              className="font-display font-extrabold text-white text-[2.5rem] sm:text-6xl leading-[1.05] text-balance"
            >
              Everything campus.
              <br />
              <span className="chp-gradient-text">One app.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5, ease }}
              className="mt-5 text-white/70 text-[15px] sm:text-lg max-w-xl mx-auto text-balance"
            >
              Connect, collaborate and grow — all in one verified, privacy-first
              platform built for real campus life.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.65, ease }}
              className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
            >
              <Link
                to="/login"
                aria-label="Join your campus — go to sign up"
                className="chp-cta-primary chp-cta-magnetic inline-flex items-center justify-center gap-2 rounded-full text-[15px] font-semibold px-7 py-3.5 active:scale-[0.98]"
              >
                Join your campus
                <Icon name="arrow" className="w-4 h-4" />
              </Link>
            </motion.div>
          </Container>
        </motion.div>

        <motion.div
          className="chp-scroll-indicator chp-scroll-indicator--labeled"
          style={{ opacity: indicatorOpacity }}
          aria-hidden="true"
        >
          <span className="chp-scroll-indicator__dot" />
          <span className="chp-cinema__scroll-label">Scroll to Enter Campus</span>
        </motion.div>
      </div>
    </section>
  )
}