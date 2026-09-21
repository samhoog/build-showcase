import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { scanSources } from './scan.ts'

let root: string

async function addBuild(username: string, folder: string, files: Record<string, string>) {
  const dir = join(root, username, folder)
  await mkdir(dir, { recursive: true })
  for (const [name, body] of Object.entries(files)) await writeFile(join(dir, name), body)
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'scan-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('scanSources', () => {
  it('finds players and their builds', async () => {
    await addBuild('jeb_', 'harbour-lighthouse', { 'a.obj': '', 'a.mtl': '' })
    await addBuild('jeb_', 'Oak Tree', { 'tree.obj': '' })
    await addBuild('Notch', 'cottage', { 'c.obj': '' })

    const { players, problems } = await scanSources(root)

    expect(problems).toEqual([])
    expect(players.map((p) => p.username)).toEqual(['Notch', 'jeb_'])
    const jeb = players[1]
    expect(jeb.builds.map((b) => b.slug).sort()).toEqual(['harbour-lighthouse', 'oak-tree'])
    expect(jeb.builds.find((b) => b.slug === 'oak-tree')?.meta.title).toBe('Oak Tree')
  })

  it('lets build.json and player.json override derived names', async () => {
    await addBuild('jeb_', 'tower', {
      't.obj': '',
      'build.json': JSON.stringify({ title: 'The Watchtower', builtOn: '2026-08-01' }),
    })
    await writeFile(join(root, 'jeb_', 'player.json'), JSON.stringify({ displayName: 'Jens' }))

    const { players } = await scanSources(root)

    expect(players[0].displayName).toBe('Jens')
    expect(players[0].builds[0].meta).toEqual({ title: 'The Watchtower', builtOn: '2026-08-01' })
  })

  it('reports folders it cannot use instead of failing', async () => {
    await addBuild('not a username', 'thing', { 'a.obj': '' })
    await addBuild('jeb_', 'empty', { 'notes.txt': '' })
    await addBuild('jeb_', 'double', { 'a.obj': '', 'b.obj': '' })

    const { players, problems } = await scanSources(root)

    expect(players).toHaveLength(1)
    expect(players[0].builds).toEqual([])
    expect(problems).toHaveLength(3)
    expect(problems.join('\n')).toMatch(/not a valid Minecraft username/)
    expect(problems.join('\n')).toMatch(/no \.obj file/)
    expect(problems.join('\n')).toMatch(/more than one \.obj/)
  })

  it('includes roster players who have no folder yet', async () => {
    await addBuild('jeb_', 'tower', { 't.obj': '' })

    const { players, problems } = await scanSources(root, ['Dsny', 'jeb_'])

    expect(problems).toEqual([])
    expect(players.map((p) => [p.username, p.builds.length])).toEqual([
      ['Dsny', 0],
      ['jeb_', 1],
    ])
  })

  it('matches a folder to the roster whatever its case, keeping the roster spelling', async () => {
    await addBuild('dsny', 'castle', { 'c.obj': '' })

    const { players } = await scanSources(root, ['Dsny'])

    expect(players).toHaveLength(1)
    expect(players[0].username).toBe('Dsny')
    expect(players[0].builds.map((b) => b.slug)).toEqual(['castle'])
  })

  it('works from the roster alone when the sources folder does not exist', async () => {
    const { players } = await scanSources(join(root, 'missing'), ['Dsny'])
    expect(players.map((p) => p.username)).toEqual(['Dsny'])
  })

  it('reports invalid roster names', async () => {
    const { players, problems } = await scanSources(root, ['no spaces allowed'])
    expect(players).toEqual([])
    expect(problems.join()).toMatch(/not a valid Minecraft username/)
  })

  it('dates a build by its model files, so editing build.json does not reconvert it', async () => {
    await addBuild('jeb_', 'tower', { 't.obj': '', 't.png': '', 'build.json': '{}' })
    const dir = join(root, 'jeb_', 'tower')
    const model = new Date('2026-01-01T00:00:00Z')
    await utimes(join(dir, 't.obj'), model, model)
    await utimes(join(dir, 't.png'), model, model)
    // build.json edited much later
    const edited = new Date('2026-09-01T00:00:00Z')
    await utimes(join(dir, 'build.json'), edited, edited)

    const { players } = await scanSources(root)

    expect(players[0].builds[0].newestMtimeMs).toBe(model.getTime())
  })
})
