/**
 * One-time asset generator for the Android native splash screen.
 * Not part of the app's runtime or build pipeline. jimp is not kept as
 * a project dependency — run `npm install -D jimp` before re-running
 * this script, then `npm uninstall jimp` afterward.
 *
 * Regenerates the legacy full-bleed splash.png at each existing
 * density/orientation bucket (same pixel dimensions Capacitor's
 * default template already created) with the real Campinity mark
 * centered on the app's actual light background color, replacing
 * Capacitor's placeholder blue "X" image. Also generates a pair of
 * transparent-background icon-only PNGs for Android 12+'s native
 * Splash Screen API.
 *
 * Both the light-theme and dark-theme splash icon use the SAME mark
 * (logo-light.png's content) rather than switching to logo-dark.png
 * for dark mode — confirmed deliberately after comparing both: logo-
 * dark.png's castle silhouette is drawn in dark navy, which nearly
 * disappears against the near-black splash_background, while logo-
 * light.png's mark (white cutout details on solid blue) stays legible
 * on both backgrounds.
 */
const { Jimp } = require('jimp')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const RES = path.join(ROOT, 'android/app/src/main/res')

const LIGHT_BG = 0xf7f8fcff // matches --theme-background light token
const MARK_SRC = path.join(ROOT, 'public/logo-light.png') // used for both themes — see header comment

const LEGACY_TARGETS = [
  ['drawable/splash.png', 480, 320],
  ['drawable-port-mdpi/splash.png', 320, 480],
  ['drawable-port-hdpi/splash.png', 480, 800],
  ['drawable-port-xhdpi/splash.png', 720, 1280],
  ['drawable-port-xxhdpi/splash.png', 960, 1600],
  ['drawable-port-xxxhdpi/splash.png', 1280, 1920],
  ['drawable-land-mdpi/splash.png', 480, 320],
  ['drawable-land-hdpi/splash.png', 800, 480],
  ['drawable-land-xhdpi/splash.png', 1280, 720],
  ['drawable-land-xxhdpi/splash.png', 1600, 960],
  ['drawable-land-xxxhdpi/splash.png', 1920, 1280],
]

async function composeLegacy(markPath, w, h, outPath) {
  const canvas = new Jimp({ width: w, height: h, color: LIGHT_BG })
  const mark = await Jimp.read(markPath)
  // Icon occupies ~22% of the shorter canvas dimension, matching the
  // original placeholder's visual proportion (small centered mark on
  // a large canvas, not a full-width logo lockup).
  const target = Math.round(Math.min(w, h) * 0.22)
  mark.resize({ w: target })
  canvas.composite(mark, Math.round((w - mark.bitmap.width) / 2), Math.round((h - mark.bitmap.height) / 2))
  await canvas.write(outPath)
  console.log('wrote', outPath)
}

async function composeIcon(markPath, outPath, size = 480) {
  const canvas = new Jimp({ width: size, height: size, color: 0x00000000 })
  const mark = await Jimp.read(markPath)
  const target = Math.round(size * 0.58)
  mark.resize({ w: target })
  canvas.composite(mark, Math.round((size - mark.bitmap.width) / 2), Math.round((size - mark.bitmap.height) / 2))
  await canvas.write(outPath)
  console.log('wrote', outPath)
}

async function main() {
  for (const [rel, w, h] of LEGACY_TARGETS) {
    await composeLegacy(MARK_SRC, w, h, path.join(RES, rel))
  }
  await composeIcon(MARK_SRC, path.join(RES, 'drawable/ic_splash_icon.png'))
  await composeIcon(MARK_SRC, path.join(RES, 'drawable-night/ic_splash_icon.png'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
