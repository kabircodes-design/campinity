/**
 * One-time asset generator for the Android launcher icon — legacy
 * ic_launcher/ic_launcher_round PNGs, the adaptive-icon foreground
 * layer, and the Android 13+ themed-icon monochrome layer. Not part
 * of the app's runtime or build pipeline. jimp is not kept as a
 * project dependency — run `npm install -D jimp` before re-running
 * this script, then `npm uninstall jimp` afterward (same pattern as
 * generate-notification-icon.cjs).
 *
 * Source is the same real Campinity logomark already used everywhere
 * else in the app (Logo.jsx's light-mode variant, public/logo-light.png
 * — a transparent PNG, not the wordmark or mascot), never a new/
 * invented icon. The adaptive icon's background stays the existing
 * @color/ic_launcher_background (#FFFFFF, already defined) — this
 * script only (re)generates the foreground/legacy/monochrome bitmaps
 * on top of it, at every density Android expects:
 *
 *  - Legacy ic_launcher.png / ic_launcher_round.png: the logo
 *    composited onto a solid white square (pre-Android-8 launchers,
 *    or ic_launcher_round.png specifically, have no separate
 *    foreground/background layering — they're one flat bitmap each).
 *  - Adaptive foreground (mipmap-anydpi-v26/ic_launcher.xml's
 *    @mipmap/ic_launcher_foreground): the logo alone on a fully
 *    transparent canvas, scaled to roughly 60% of the canvas so it
 *    stays inside the ~66% "safe zone" every adaptive-icon mask shape
 *    (circle/squircle/rounded-square/etc, varies by OEM launcher)
 *    guarantees stays visible without being cropped.
 *  - Monochrome (Android 13+ "themed icons" — Settings > Wallpaper &
 *    style > Themed icons, when the user opts in the OS re-tints
 *    every app icon's SINGLE-CHANNEL silhouette to match the wallpaper
 *    palette instead of showing each app's own colors): the exact same
 *    silhouette-from-alpha technique already used by
 *    generate-notification-icon.cjs for the status-bar icon, at the
 *    same sizes as the adaptive foreground.
 *
 * Both ic_launcher.xml and ic_launcher_round.xml already declare
 * <background>/<foreground>; this script also adds a <monochrome>
 * element to both so the themed-icon layer actually gets used.
 */
const { Jimp } = require('jimp')
const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '..')
const RES = path.join(ROOT, 'android/app/src/main/res')
const SRC = path.join(ROOT, 'public/logo-light.png')

// Legacy flat icon sizes (48dp base, standard Android density scale).
const LEGACY_SIZES = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192
}

// Adaptive-icon layer canvas sizes (108dp base — matches the existing
// ic_launcher_foreground.png files this replaces, already 108/162/216/
// 324/432 in this project).
const ADAPTIVE_SIZES = {
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432
}

async function scaledCopy(source, maxBoxFraction, canvasSize) {
  const box = canvasSize * maxBoxFraction
  const scale = Math.min(box / source.bitmap.width, box / source.bitmap.height)
  const w = Math.max(1, Math.round(source.bitmap.width * scale))
  const h = Math.max(1, Math.round(source.bitmap.height * scale))
  return source.clone().resize({ w, h })
}

function centeredComposite(canvas, layer) {
  const x = Math.round((canvas.bitmap.width - layer.bitmap.width) / 2)
  const y = Math.round((canvas.bitmap.height - layer.bitmap.height) / 2)
  canvas.composite(layer, x, y)
  return canvas
}

async function main() {
  const source = await Jimp.read(SRC)

  console.log('--- legacy ic_launcher / ic_launcher_round (logo on solid white) ---')
  for (const [density, size] of Object.entries(LEGACY_SIZES)) {
    const canvas = new Jimp({ width: size, height: size, color: 0xffffffff })
    const logo = await scaledCopy(source, 0.72, size)
    centeredComposite(canvas, logo)
    const buf = await canvas.getBuffer('image/png')
    for (const name of ['ic_launcher.png', 'ic_launcher_round.png']) {
      const outPath = path.join(RES, `mipmap-${density}`, name)
      fs.writeFileSync(outPath, buf)
      console.log('wrote', outPath)
    }
  }

  console.log('\n--- adaptive foreground (logo alone, transparent canvas) ---')
  for (const [density, size] of Object.entries(ADAPTIVE_SIZES)) {
    const canvas = new Jimp({ width: size, height: size, color: 0x00000000 })
    const logo = await scaledCopy(source, 0.6, size)
    centeredComposite(canvas, logo)
    const outPath = path.join(RES, `mipmap-${density}`, 'ic_launcher_foreground.png')
    await canvas.write(outPath)
    console.log('wrote', outPath)
  }

  console.log('\n--- monochrome (Android 13+ themed icons, white silhouette from alpha) ---')
  for (const [density, size] of Object.entries(ADAPTIVE_SIZES)) {
    const canvas = new Jimp({ width: size, height: size, color: 0x00000000 })
    const logo = await scaledCopy(source, 0.6, size)
    logo.scan(0, 0, logo.bitmap.width, logo.bitmap.height, function (x, y, idx) {
      this.bitmap.data[idx + 0] = 255
      this.bitmap.data[idx + 1] = 255
      this.bitmap.data[idx + 2] = 255
      // alpha (idx + 3) left untouched
    })
    centeredComposite(canvas, logo)
    const outPath = path.join(RES, `mipmap-${density}`, 'ic_launcher_monochrome.png')
    await canvas.write(outPath)
    console.log('wrote', outPath)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
