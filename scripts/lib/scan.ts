import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { isValidUsername, titleFromSlug, toSlug } from './slug.ts'

export type BuildMeta = { title: string; description?: string; builtOn?: string }

export type BuildSource = {
  slug: string
  dir: string
  objPath: string
  meta: BuildMeta
  // newest mtime of any file in the folder, used to skip unchanged builds
  newestMtimeMs: number
}

export type PlayerSource = {
  username: string
  displayName: string
  dir: string
  builds: BuildSource[]
}

export type ScanResult = { players: PlayerSource[]; problems: string[] }

async function readJson<T>(path: string): Promise<Partial<T>> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Partial<T>
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw new Error(`${path} is not valid JSON`, { cause: err })
  }
}

async function subdirs(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

async function scanBuild(dir: string, folder: string): Promise<BuildSource | string> {
  const files = (await readdir(dir, { recursive: true, withFileTypes: true })).filter((e) =>
    e.isFile(),
  )
  const objs = files.filter((f) => f.name.toLowerCase().endsWith('.obj'))
  if (objs.length === 0) return `${dir}: no .obj file, skipped`
  if (objs.length > 1) return `${dir}: more than one .obj file, keep one build per folder`

  const mtimes = await Promise.all(files.map((f) => stat(join(f.parentPath, f.name))))
  const meta = await readJson<BuildMeta>(join(dir, 'build.json'))
  return {
    slug: toSlug(folder),
    dir,
    objPath: join(objs[0].parentPath, objs[0].name),
    meta: { ...meta, title: meta.title ?? titleFromSlug(folder) },
    newestMtimeMs: Math.max(...mtimes.map((s) => s.mtimeMs)),
  }
}

// Players are everyone on the roster (players.json, committed) plus every username folder
// under models-src/ (gitignored). The roster is what lets someone appear before they have
// a build; its spelling wins when a folder differs only by case.
export async function scanSources(root: string, roster: string[] = []): Promise<ScanResult> {
  const players: PlayerSource[] = []
  const problems: string[] = []
  const folders = await subdirs(root)

  const usernames = [...roster]
  for (const folder of folders) {
    if (!roster.some((name) => name.toLowerCase() === folder.toLowerCase())) usernames.push(folder)
  }

  for (const username of usernames) {
    if (!isValidUsername(username)) {
      problems.push(`"${username}" is not a valid Minecraft username, skipped`)
      continue
    }

    const folder = folders.find((name) => name.toLowerCase() === username.toLowerCase())
    const dir = join(root, folder ?? username)
    const builds: BuildSource[] = []
    // models-src/<username>/<build>/*.obj
    for (const build of folder ? await subdirs(dir) : []) {
      const result = await scanBuild(join(dir, build), build)
      if (typeof result === 'string') problems.push(result)
      else builds.push(result)
    }

    const info = await readJson<{ displayName: string }>(join(dir, 'player.json'))
    players.push({ username, displayName: info.displayName ?? username, dir, builds })
  }

  return { players, problems }
}
