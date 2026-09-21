import { defineConfig, devices } from '@playwright/test'

// headless Chromium has no GPU; SwiftShader gives it a software WebGL
const launchOptions = {
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
}

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4183', launchOptions },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1360, height: 900 } },
    },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  // The site under test is a production build filled with generated sample builds. It lives
  // entirely in .e2e/ so a test run never touches the real models-src/, public/ or dist/.
  webServer: {
    command:
      'node scripts/sample/generate.ts && npm run convert && npm run build && npm run preview -- --port 4183 --strictPort',
    env: {
      SOURCES_DIR: '.e2e/models-src',
      PUBLIC_DIR: '.e2e/public',
      OUT_DIR: '.e2e/dist',
      // no roster: the tests know exactly two players, Notch and jeb_
      ROSTER_FILE: '.e2e/no-roster.json',
    },
    url: 'http://localhost:4183',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
