import type { Plugin } from 'vite'
import { isStartView } from '../shared/manifest.ts'
import { PUBLIC_DIR, ROSTER_FILE, SOURCES_DIR } from './lib/paths.ts'
import { readRoster } from './lib/roster.ts'
import { SaveViewError, saveView } from './lib/save-view.ts'

// the camera readout posts here; see src/data/saveView.ts
export const SAVE_VIEW_PATH = '/__save-view'

// Dev server only: lets the viewer's camera readout write a build's starting view into its
// build.json. A built site is static files with no server, so this never exists outside
// `npm run dev`, and the button that calls it is compiled out of production builds.
export function saveViewEndpoint(): Plugin {
  return {
    name: 'save-view',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(SAVE_VIEW_PATH, (req, res) => {
        const reply = (status: number, body: object) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(body))
        }
        if (req.method !== 'POST') return reply(405, { error: 'use POST' })

        let raw = ''
        req.setEncoding('utf8')
        req.on('data', (chunk: string) => {
          raw += chunk
          if (raw.length > 10_000) req.destroy()
        })
        req.on('end', async () => {
          let body: { file?: unknown; view?: unknown }
          try {
            body = JSON.parse(raw)
          } catch {
            return reply(400, { error: 'the request was not JSON' })
          }
          if (typeof body.file !== 'string' || !isStartView(body.view)) {
            return reply(400, { error: 'expected { file, view } with a valid view' })
          }
          try {
            const roster = await readRoster(ROSTER_FILE)
            const dirs = { sources: SOURCES_DIR, publicDir: PUBLIC_DIR, roster }
            reply(200, { path: await saveView(dirs, body.file, body.view) })
          } catch (err) {
            const status = err instanceof SaveViewError ? err.status : 500
            reply(status, { error: (err as Error).message })
          }
        })
      })
    },
  }
}
