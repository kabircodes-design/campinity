# Campinity — Landing Page

A production-quality, mobile-first landing page for Campinity, rebuilt from
scratch with a clean component architecture.

## Stack

- React 18
- Vite 5
- Tailwind CSS 3
- Framer Motion 11

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL and resize the viewport down to 390px — the
entire page is designed mobile-first with zero horizontal overflow, then
scales up for tablet and desktop.

```bash
npm run build    # production build to /dist
npm run preview  # preview the production build locally
```

## Project structure

```
src/
  components/       Reusable UI building blocks (Nav, Hero, FeatureCard, ...)
  data/             Content as data (features.js, journey.js, events.js)
  hooks/            useReducedMotion — respects prefers-reduced-motion
  App.jsx           Composes all sections in order
  index.css         Tailwind layers + base resets + overflow guards
tailwind.config.js  Design tokens: color, type, radius, shadow, motion
```

## Design system

- **Color** — near-black ink (`#0B0E14`) on an off-white surface
  (`#FAFAFC`), one accent blue (`#2F5FFF`) tying back to the Campinity
  logomark. No decorative gradients beyond soft, purposeful glows.
- **Type** — Inter Tight for display headings, Inter for body copy, IBM
  Plex Mono for eyebrows/labels/data — a Linear-style utility accent.
- **Motion** — Framer Motion animations are restricted to `transform` and
  `opacity` (GPU-accelerated), scroll-triggered with `viewport={{ once: true }}`
  so nothing re-animates on scroll-back, and fully disabled under
  `prefers-reduced-motion`.
- **Signature element** — the hero's Campus Radar visualization, a real
  product feature turned into the page's opening thesis instead of a
  generic gradient blob.

## Performance notes

- Only `transform`/`opacity` are animated — no layout-triggering properties.
- Scroll-linked UI (nav blur) is throttled with `requestAnimationFrame`.
- All scroll-reveal animations run once (`viewport={{ once: true }}`) to
  avoid re-render cost on repeated scrolling.
- The events carousel is a contained, `overflow-x-auto` region — it never
  triggers page-level horizontal scroll.
- No external images — all visuals are inline SVG / CSS, so there is zero
  image payload and zero CLS from late-loading assets.
