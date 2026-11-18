import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  plugins: [react()],
  // Shown in Settings > About.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },
  // Dev server only: don't watch the separate admin app (its Gradle build output locks files on Windows).
  server: { watch: { ignored: ['**/admin-app/**'] } },
  build: {
    target: 'es2019',
    cssCodeSplit: true,
    sourcemap: false
  }
})
