import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Tests import the app's real source from ../src. React, the router and
// the other runtime libraries resolve to the APP's node_modules, so the
// components under test share one React instance with Testing Library.
const here = fileURLToPath(new URL('.', import.meta.url)).split('\\').join('/')
const PROJECT = here.replace(/tests\/$/, '')
const SRC_DIR = `${PROJECT}src`

// Testing Library is loaded by Node (not Vite), so the alias below does
// not apply to its own `require('react')`. Test workers are forked after
// this file runs and inherit NODE_PATH, which points them at the app's
// single React copy.
process.env.NODE_PATH = `${PROJECT}node_modules`

export default defineConfig({
  root: here,
  cacheDir: `${here}node_modules/.vite-cache`,
  esbuild: { jsx: 'automatic' },
  define: { __APP_VERSION__: JSON.stringify('1.0.0-test'), __BUILD_TIME__: JSON.stringify('2026-01-01T00:00:00.000Z') },
  resolve: {
    alias: [
      {
        find: /^(react|react-dom|react-router-dom|react-router|firebase|framer-motion|lucide-react|@capacitor\/[a-z-]+)(\/.*)?$/,
        replacement: `${PROJECT}node_modules/$1$2`
      }
    ]
  },
  server: { fs: { allow: [PROJECT] } },
  test: {
    environment: 'jsdom',
    include: ['*.test.jsx'],
    setupFiles: ['./setup.js'],
    env: { SRC_DIR }
  }
})
