// npm run convert: models-src/<username>/<build>/ -> public/builds/<username>/<build>.glb,
// plus player skins and the manifest the site reads. Everything it writes is gitignored.
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Build, Player } from '../shared/manifest.ts'
import { findBuild, readManifest, shareBuilds, sortManifest } from './lib/manifest.ts'
import { readBlockDimensions } from './lib/obj-header.ts'
import { objToGlb } from './lib/obj-to-glb.ts'
import { PUBLIC_DIR, ROSTER_FILE, SOURCES_DIR } from './lib/paths.ts'
import { optimizeGlb } from './lib/optimize.ts'
import { type BuildSource, scanSources } from './lib/scan.ts'
import { ensureSkin } from './lib/skins.ts'

// ROSTER: committed list of usernames, so players exist before (and apart from) their models
const SOURCES = SOURCES_DIR
const ROSTER = ROSTER_FILE
const PUBLIC = PUBLIC_DIR
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
  console.log(
    `  ${source.slug}: ${mb(raw.byteLength)} -> ${mb(glb.byteLength)}, ${stats.triangles} triangles`,
  )

  return {
    slug: source.slug,
    ...source.meta,
    builders: withOwner(username, source),
    file,
    hash: createHash('sha1').update(glb).digest('hex').slice(0, 8),
    bytes: glb.byteLength,
    ...stats,
    // Mineways' own count when it gives one, the measured mesh otherwise
    size: (await readBlockDimensions(source.objPath)) ?? stats.size,
  }
}

// the player whose folder holds the files, then whoever build.json credits
function withOwner(username: string, source: BuildSource): string[] {
  return [username, ...(source.meta.builders ?? [])]
}

// delete what belongs to builds and players that are gone: GLBs, then emptied folders, skins
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
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const dir = join(root, entry.name)
    if (entry.isDirectory() && (await readdir(dir)).length === 0) await rm(dir, { recursive: true })
  }

  const usernames = new Set(players.map((p) => p.username))
  for (const file of await readdir(join(PUBLIC, 'skins')).catch(() => [])) {
    if (!usernames.has(file.replace(/\.(png|json)$/, ''))) {
      await rm(join(PUBLIC, 'skins', file))
      console.log(`  removed ${join(PUBLIC, 'skins', file)}`)
    }
  }
}

const previous = await readManifest(MANIFEST)
const roster = await readFile(ROSTER, 'utf8').then(
  (text) => JSON.parse(text) as string[],
  () => [],
)
const { players: sources, problems } = await scanSources(SOURCES, roster)
const players: Player[] = []
let failed = 0

for (const source of sources) {
  console.log(source.username)
  const builds: Build[] = []

  for (const build of source.builds) {
    // unchanged since the last run: keep the previous entry, but pick up build.json edits
    // (a build shared with this player by someone else is theirs, not a previous run of this)
    const own = `builds/${source.username}/${build.slug}.glb`
    const known = findBuild(previous, source.username, build.slug)
    if (known?.file === own && (await mtimeMs(join(PUBLIC, own))) > build.newestMtimeMs) {
      // spelled out so a field removed from build.json also leaves the manifest
      const { description, builtOn, view } = build.meta
      builds.push({
        ...known,
        ...build.meta,
        description,
        builtOn,
        view,
        builders: withOwner(source.username, build),
      })
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
// shared builds go under every builder before sorting, so they count towards each total
const shared = shareBuilds(players)
problems.push(...shared.problems)
const manifest = { generatedAt: new Date().toISOString(), players: sortManifest(shared.players) }
await writeFile(MANIFEST, JSON.stringify(manifest, null, 2))
await removeStale(players)

for (const problem of problems) console.warn(`warning: ${problem}`)
// count files, not listings: a shared build is one build
const total = players.reduce((n, p) => n + p.builds.length, 0)
console.log(`${players.length} players, ${total} builds -> ${MANIFEST}`)
if (failed > 0) {
  console.error(`${failed} build(s) failed to convert`)
  process.exitCode = 1
}
