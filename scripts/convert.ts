// npm run convert: models-src/<username>/<build>/ -> public/builds/<username>/<build>.glb,
// plus player skins and the manifest the site reads. Everything it writes is gitignored.
import { createHash } from 'node:crypto'
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Build, Player } from '../shared/manifest.ts'
import { findBuild, readManifest, sortManifest } from './lib/manifest.ts'
import { objToGlb } from './lib/obj-to-glb.ts'
import { optimizeGlb } from './lib/optimize.ts'
import { type BuildSource, scanSources } from './lib/scan.ts'
import { ensureSkin } from './lib/skins.ts'

const SOURCES = 'models-src'
const PUBLIC = 'public'
const MANIFEST = join(PUBLIC, 'builds', 'manifest.json')

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`

async function mtimeMs(path: string): Promise<number> {
  return stat(path).then(
    (s) => s.mtimeMs,
    () => 0,
  )
}

async function convertBuild(username: string, source: BuildSource): Promise<Build> {
  const raw = await objToGlb(source.objPath)
  const { glb, stats } = await optimizeGlb(raw)
  const file = `builds/${username}/${source.slug}.glb`

  await mkdir(join(PUBLIC, 'builds', username), { recursive: true })
  await writeFile(join(PUBLIC, file), glb)
  console.log(`  ${source.slug}: ${mb(raw.byteLength)} -> ${mb(glb.byteLength)}, ${stats.triangles} triangles`)

  return {
    slug: source.slug,
    ...source.meta,
    file,
    hash: createHash('sha1').update(glb).digest('hex').slice(0, 8),
    bytes: glb.byteLength,
    ...stats,
  }
}

// delete GLBs whose source folder is gone
async function removeStale(players: Player[]) {
  const keep = new Set(players.flatMap((p) => p.builds.map((b) => join(PUBLIC, b.file))))
  const root = join(PUBLIC, 'builds')
  for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
    const path = join(entry.parentPath, entry.name)
    if (entry.isFile() && path.endsWith('.glb') && !keep.has(path)) {
      await rm(path)
      console.log(`  removed ${path}`)
    }
  }
}

const previous = await readManifest(MANIFEST)
const { players: sources, problems } = await scanSources(SOURCES).catch(() => ({
  players: [],
  problems: [`${SOURCES}/ not found`],
}))
const players: Player[] = []
let failed = 0

for (const source of sources) {
  console.log(source.username)
  const builds: Build[] = []

  for (const build of source.builds) {
    // unchanged since the last run: keep the previous entry, but pick up build.json edits
    const known = findBuild(previous, source.username, build.slug)
    if (known && (await mtimeMs(join(PUBLIC, known.file))) > build.newestMtimeMs) {
      builds.push({ ...known, ...build.meta })
      console.log(`  ${build.slug}: up to date`)
      continue
    }
    try {
      builds.push(await convertBuild(source.username, build))
    } catch (err) {
      failed++
      console.error(`  ${build.slug}: FAILED, ${(err as Error).message}`)
    }
  }

  const { slim } = await ensureSkin(source.username, join(PUBLIC, 'skins'))
  players.push({
    username: source.username,
    displayName: source.displayName,
    skin: `skins/${source.username}.png`,
    slim,
    builds,
  })
}

await mkdir(join(PUBLIC, 'builds'), { recursive: true })
const manifest = { generatedAt: new Date().toISOString(), players: sortManifest(players) }
await writeFile(MANIFEST, JSON.stringify(manifest, null, 2))
await removeStale(players)

for (const problem of problems) console.warn(`warning: ${problem}`)
const total = players.reduce((n, p) => n + p.builds.length, 0)
console.log(`${players.length} players, ${total} builds -> ${MANIFEST}`)
if (failed > 0) {
  console.error(`${failed} build(s) failed to convert`)
  process.exitCode = 1
}
