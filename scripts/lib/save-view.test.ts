import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Manifest } from '../../shared/manifest.ts'
import { saveView, type SaveViewDirs } from './save-view.ts'

let root: string
let dirs: SaveViewDirs
const view = {
  azimuth: 57,
  elevation: 20,
  zoom: 1.01,
  target: [4.9, 18.4, 0.7] as [number, number, number],
}
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'))

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'save-view-'))
  dirs = { sources: join(root, 'models-src'), publicDir: join(root, 'public'), roster: ['Dsny'] }
  // the folder name has a space; the slug in the file path does not
  await mkdir(join(dirs.sources, 'Dsny', 'Notre Dame'), { recursive: true })
  await writeFile(join(dirs.sources, 'Dsny', 'Notre Dame', 'nd.obj'), '')
  await mkdir(join(dirs.publicDir, 'builds'), { recursive: true })
  const manifest = {
    generatedAt: '',
    players: [
      { username: 'Dsny', builds: [{ slug: 'notre-dame', file: 'builds/Dsny/notre-dame.glb' }] },
      {
        username: 'TheRealJard',
        builds: [{ slug: 'notre-dame', file: 'builds/Dsny/notre-dame.glb' }],
      },
    ],
  }
  await writeFile(join(dirs.publicDir, 'builds', 'manifest.json'), JSON.stringify(manifest))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('saveView', () => {
  it('writes the view into build.json, keeping what else is there', async () => {
    const buildJson = join(dirs.sources, 'Dsny', 'Notre Dame', 'build.json')
    await writeFile(buildJson, JSON.stringify({ title: 'Notre Dame', builders: ['TheRealJard'] }))

    const path = await saveView(dirs, 'builds/Dsny/notre-dame.glb', view)

    expect(path).toBe(buildJson)
    expect(await readJson(buildJson)).toEqual({
      title: 'Notre Dame',
      builders: ['TheRealJard'],
      view,
    })
  })

  it('creates build.json if there is none, and replaces an older view', async () => {
    const buildJson = join(dirs.sources, 'Dsny', 'Notre Dame', 'build.json')
    await saveView(dirs, 'builds/Dsny/notre-dame.glb', { azimuth: 1, elevation: 2 })
    await saveView(dirs, 'builds/Dsny/notre-dame.glb', view)
    expect(await readJson(buildJson)).toEqual({ view })
  })

  it('updates every manifest entry for the build, so no convert is needed', async () => {
    await saveView(dirs, 'builds/Dsny/notre-dame.glb', view)
    const manifest: Manifest = await readJson(join(dirs.publicDir, 'builds', 'manifest.json'))
    expect(manifest.players.map((p) => p.builds[0].view)).toEqual([view, view])
  })

  it('refuses a build.json it cannot parse rather than overwrite it', async () => {
    const buildJson = join(dirs.sources, 'Dsny', 'Notre Dame', 'build.json')
    await writeFile(buildJson, '{ "title": "Notre Dame", }')
    await expect(saveView(dirs, 'builds/Dsny/notre-dame.glb', view)).rejects.toMatchObject({
      status: 409,
    })
    expect(await readFile(buildJson, 'utf8')).toBe('{ "title": "Notre Dame", }')
  })

  it.each([
    ['a path outside builds/', '../../etc/passwd'],
    ['a traversal inside the name', 'builds/Dsny/../../x.glb'],
    ['a non-GLB file', 'builds/Dsny/notre-dame.json'],
  ])('rejects %s', async (_name, file) => {
    await expect(saveView(dirs, file, view)).rejects.toMatchObject({ status: 400 })
  })

  it('says so when there is no such build folder', async () => {
    await expect(saveView(dirs, 'builds/Dsny/castle.glb', view)).rejects.toMatchObject({
      status: 404,
    })
  })
})
