import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import baseTailwind from '../tailwind.config.js'

/**
 * CAMPINITY ADMIN web bundle (the Android admin app loads this).
 * Separate from the public app's build: own entry (admin-app/index.html),
 * own output (admin-app/dist), same Firebase web config (.env at the repo
 * root — public client config, not a secret) and the same design tokens.
 *
 *   npx vite build --config admin-app/vite.config.mjs
 *   npx vite --config admin-app/vite.config.mjs        (dev, port 5174)
 */
const here = fileURLToPath(new URL('.', import.meta.url))
const ROOT = fileURLToPath(new URL('..', import.meta.url))

export default defineConfig({
  root: here,
  envDir: ROOT,
  base: './',
  publicDir: false,
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          ...baseTailwind,
          // Only admin code + the few shared components it renders.
          content: [`${here}index.html`, `${here}src/**/*.{js,jsx}`, `${ROOT}src/admin/**/*.{js,jsx}`, `${ROOT}src/pages/AdminPage.jsx`, `${ROOT}src/components/CollegeSearch.jsx`]
        }),
        autoprefixer()
      ]
    }
  },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2019', sourcemap: false },
  server: { host: '127.0.0.1', port: 5174, strictPort: true, fs: { allow: [ROOT] } }
})
