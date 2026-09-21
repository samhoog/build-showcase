import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
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
})
