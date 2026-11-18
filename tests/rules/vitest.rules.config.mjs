import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Rules tests run in Node against the Firestore emulator, using the app's
// own firebase SDK (no extra test dependencies).
const here = fileURLToPath(new URL('.', import.meta.url)).split('\\').join('/')
const PROJECT = here.replace(/tests\/rules\/$/, '')

export default defineConfig({
  root: here,
  cacheDir: `${here}../node_modules/.vite-cache-rules`,
  resolve: {
    alias: [{ find: /^(firebase)(\/.*)?$/, replacement: `${PROJECT}node_modules/$1$2` }]
  },
  server: { fs: { allow: [PROJECT] } },
  test: {
    environment: 'node',
    include: ['*.test.mjs'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false
  }
})
