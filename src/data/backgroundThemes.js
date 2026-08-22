/**
 * The "animation engine" (AnimatedBackground.jsx / BackgroundLayer.jsx /
 * FloatingIcon.jsx / Particles.jsx) never changes to add a new seasonal
 * theme — only this file does. A future theme is just another entry in
 * BACKGROUND_THEMES built the same way 'default' is: call scatter()
 * with a different icon pool (and optionally different size/opacity/
 * duration ranges), or hand-write a fully custom array — both are
 * plain { icon, top, left, size, opacity, duration, delay, drift,
 * rotate } objects, which is all FloatingIcon needs.
 *
 * scatter() is deterministic (a numeric formula, not Math.random), so
 * the same theme always renders the same layout — varied size/opacity/
 * position/duration/delay per element without any randomness to chase
 * down if something looks off.
 */

function scatter(count, { icons, sizeRange = [20, 44], opacityRange = [0.05, 0.14], durationRange = [9, 20], seedStart = 0 }) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * 1.6)))
  const rows = Math.ceil(count / cols)
  const elements = []

  for (let i = 0; i < count; i += 1) {
    const seed = seedStart + i
    const col = i % cols
    const row = Math.floor(i / cols)

    const jitterTop = ((seed * 53) % 100) / 100
    const jitterLeft = ((seed * 91) % 100) / 100

    const top = Math.min(96, Math.max(2, ((row + jitterTop) / rows) * 100))
    const left = Math.min(96, Math.max(2, ((col + jitterLeft) / cols) * 100))

    const icon = icons[seed % icons.length]
    const sizeSpan = Math.max(1, sizeRange[1] - sizeRange[0])
    const opacitySpan = opacityRange[1] - opacityRange[0]
    const durationSpan = Math.max(1, durationRange[1] - durationRange[0])

    const size = sizeRange[0] + ((seed * 17) % sizeSpan)
    const opacity = +(opacityRange[0] + (((seed * 29) % 100) / 100) * opacitySpan).toFixed(3)
    const duration = durationRange[0] + ((seed * 7) % durationSpan)
    const delay = +(((seed * 13) % 40) / 10).toFixed(1)
    const drift = 12 + ((seed * 11) % 18)
    const rotate = (seed % 2 === 0 ? 1 : -1) * (2 + (seed % 3))

    elements.push({
      icon,
      top: `${top.toFixed(1)}%`,
      left: `${left.toFixed(1)}%`,
      size,
      opacity,
      duration,
      delay,
      drift,
      rotate
    })
  }

  return elements
}

const RICH_ICON_POOL = ['book', 'cap', 'chat', 'pin', 'notes', 'building', 'star', 'circle']
const SUBTLE_ICON_POOL = ['book', 'cap', 'notes', 'star', 'circle']

export const BACKGROUND_THEMES = {
  default: {
    landing: scatter(20, {
      icons: RICH_ICON_POOL,
      sizeRange: [20, 46],
      opacityRange: [0.05, 0.13],
      durationRange: [9, 20],
      seedStart: 1
    }),
    login: scatter(8, {
      icons: SUBTLE_ICON_POOL,
      sizeRange: [18, 32],
      opacityRange: [0.04, 0.09],
      durationRange: [10, 18],
      seedStart: 41
    }),
    signup: scatter(8, {
      icons: SUBTLE_ICON_POOL,
      sizeRange: [18, 32],
      opacityRange: [0.04, 0.09],
      durationRange: [10, 18],
      seedStart: 73
    })
  }

  // Future seasonal themes go here, e.g.:
  // winter: {
  //   landing: scatter(20, { icons: ['snowflake', 'mitten', ...], ... }),
  //   login: scatter(8, { ... }),
  //   signup: scatter(8, { ... })
  // }
}

export { scatter }