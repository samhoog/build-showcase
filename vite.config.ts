import { copyFile } from 'node:fs/promises'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// Static hosts serve 404.html for unknown paths; a copy of index.html there lets deep
// links like /p/jeb_/watchtower load the app, which then routes on the client.
function spaFallback(): Plugin {
  return {
    name: 'spa-fallback',
    apply: 'build',
    closeBundle: () => copyFile('dist/index.html', 'dist/404.html'),
  }
}

// BASE_PATH lets the site be hosted under a sub-path (e.g. /build-showcase/)
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), spaFallback()],
  // unit tests only; e2e/ belongs to Playwright
  test: { include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'] },
})
