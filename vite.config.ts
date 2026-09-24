import { copyFile } from 'node:fs/promises'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { PUBLIC_DIR } from './scripts/lib/paths.ts'
import { saveViewEndpoint } from './scripts/save-view-endpoint.ts'

// the e2e tests build a sandboxed copy of the site from .e2e/ (see playwright.config.ts)
const outDir = process.env.OUT_DIR ?? 'dist'

// Static hosts serve 404.html for unknown paths; a copy of index.html there lets deep
// links like /p/jeb_/watchtower load the app, which then routes on the client.
function spaFallback(): Plugin {
  return {
    name: 'spa-fallback',
    apply: 'build',
    closeBundle: () => copyFile(`${outDir}/index.html`, `${outDir}/404.html`),
  }
}

// BASE_PATH lets the site be hosted under a sub-path (e.g. /build-showcase/)
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  publicDir: PUBLIC_DIR,
  build: { outDir },
  plugins: [react(), spaFallback(), saveViewEndpoint()],
  // unit tests only; e2e/ belongs to Playwright
  test: { include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'shared/**/*.test.ts'] },
})
