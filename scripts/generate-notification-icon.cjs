/**
 * One-time asset generator for the Android push-notification small
 * icon (status-bar icon). Not part of the app's runtime or build
 * pipeline. jimp is not kept as a project dependency — run
 * `npm install -D jimp` before re-running this script, then
 * `npm uninstall jimp` afterward.
 *
 * Android renders notification small icons as a flat white silhouette
 * regardless of the source image's actual colors (only the alpha
 * channel is used) — this script makes that explicit by recoloring
 * every pixel of the existing Campinity mark to solid white while
 * preserving its alpha exactly, at each standard density size Android
 * expects (mdpi 24px through xxxhdpi 96px), matching Android's own
 * asset guidelines rather than relying on runtime downscaling from one
 * image. Does not touch the splash or launcher icon assets.
 */
const { Jimp } = require('jimp')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const RES = path.join(ROOT, 'android/app/src/main/res')
const SRC = path.join(ROOT, 'public/logo-dark.png')

const TARGETS = [
  ['drawable-mdpi/ic_stat_notify.png', 24],
  ['drawable-hdpi/ic_stat_notify.png', 36],
  ['drawable-xhdpi/ic_stat_notify.png', 48],
  ['drawable-xxhdpi/ic_stat_notify.png', 72],
  ['drawable-xxxhdpi/ic_stat_notify.png', 96]
]

async function main() {
  const source = await Jimp.read(SRC)

  // Recolor every pixel to solid white, preserving alpha exactly.
  source.scan(0, 0, source.bitmap.width, source.bitmap.height, function (x, y, idx) {
    this.bitmap.data[idx + 0] = 255
    this.bitmap.data[idx + 1] = 255
    this.bitmap.data[idx + 2] = 255
    // idx + 3 (alpha) left untouched
  })

  for (const [rel, size] of TARGETS) {
    const icon = source.clone().resize({ w: size, h: size })
    const outPath = path.join(RES, rel)
    await icon.write(outPath)
    console.log('wrote', outPath)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
