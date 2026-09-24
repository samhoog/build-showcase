import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setBuildView, type StartView } from '../../shared/manifest.ts'
import { readManifest } from './manifest.ts'
import { scanSources } from './scan.ts'

export type SaveViewDirs = { sources: string; publicDir: string; roster: string[] }

export class SaveViewError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// builds/<owner>/<slug>.glb, the file a manifest entry points at. The owner is whoever's
// folder holds the build, whichever builder's page the view was set from.
const BUILD_FILE = /^builds\/([A-Za-z0-9_]{3,16})\/([a-z0-9]+(?:-[a-z0-9]+)*)\.glb$/

// Writes `view` into the build.json of the build behind `file`, keeping everything else in
// it, and into the manifest so the site shows it without another convert. The folder is
// found by scanning, never by joining request input into a path. Returns the path written.
export async function saveView(dirs: SaveViewDirs, file: string, view: StartView): Promise<string> {
  const match = BUILD_FILE.exec(file)
  if (!match) throw new SaveViewError(400, `"${file}" is not a build file`)
  const [, username, slug] = match

  // scanning parses every build.json, so a typo in one surfaces here
  const { players } = await scanSources(dirs.sources, dirs.roster).catch((err: Error) => {
    throw new SaveViewError(409, `${err.message}, fix it by hand first`)
  })
  const owner = players.find((p) => p.username.toLowerCase() === username.toLowerCase())
  const source = owner?.builds.find((b) => b.slug === slug)
  if (!source) throw new SaveViewError(404, `no build folder for ${file} in ${dirs.sources}/`)

  const path = join(source.dir, 'build.json')
  let current: Record<string, unknown> = {}
  try {
    current = JSON.parse(await readFile(path, 'utf8'))
  } catch (err) {
    // never overwrite a build.json that has a typo in it: that would lose the rest of it
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new SaveViewError(409, `${path} is not valid JSON, fix it by hand first`)
    }
  }
  await writeFile(path, JSON.stringify({ ...current, view }, null, 2) + '\n')

  const manifestPath = join(dirs.publicDir, 'builds', 'manifest.json')
  const manifest = await readManifest(manifestPath)
  if (manifest && setBuildView(manifest, file, view) > 0) {
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
  }
  return path
}
