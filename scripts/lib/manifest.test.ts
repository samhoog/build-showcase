import { describe, expect, it } from 'vitest'
import type { Build, Player } from '../../shared/manifest.ts'
import { shareBuilds, sortManifest } from './manifest.ts'

function build(title: string, builtOn?: string, builders: string[] = []): Build {
  return {
    slug: title,
    title,
    builtOn,
    builders,
    file: `builds/${title}.glb`,
    hash: '',
    bytes: 0,
    triangles: 0,
    size: [1, 1, 1],
  }
}

function player(username: string, builds: Build[] = []): Player {
  return { username, displayName: username, skin: '', slim: false, builds }
}

describe('sortManifest', () => {
  it('puts the players with the most builds first', () => {
    const sorted = sortManifest([
      player('alex', [build('a')]),
      player('jeb_', [build('a'), build('b'), build('c')]),
      player('Notch', [build('a'), build('b')]),
    ])
    expect(sorted.map((p) => p.username)).toEqual(['jeb_', 'Notch', 'alex'])
  })

  it('breaks ties by name without caring about case', () => {
    const sorted = sortManifest([player('jeb_'), player('Notch'), player('alex')])
    expect(sorted.map((p) => p.username)).toEqual(['alex', 'jeb_', 'Notch'])
  })

  it('orders builds newest first, with undated builds at the end', () => {
    const [p] = sortManifest([
      player('jeb_', [build('old', '2025-01-01'), build('undated'), build('new', '2026-09-01')]),
    ])
    expect(p.builds.map((b) => b.title)).toEqual(['new', 'old', 'undated'])
  })
})

describe('shareBuilds', () => {
  it('lists a shared build under every builder, all pointing at the same file', () => {
    const { players, problems } = shareBuilds([
      player('Dsny', [build('notredame', undefined, ['Dsny', 'mason31', 'jw01'])]),
      player('mason31'),
      player('jw01', [build('hut', undefined, ['jw01'])]),
    ])

    expect(problems).toEqual([])
    expect(players.map((p) => p.builds.map((b) => b.slug))).toEqual([
      ['notredame'],
      ['notredame'],
      ['hut', 'notredame'],
    ])
    for (const p of players) {
      const shared = p.builds.find((b) => b.slug === 'notredame')!
      expect(shared.file).toBe('builds/notredame.glb')
      expect(shared.builders).toEqual(['Dsny', 'mason31', 'jw01'])
    }
  })

  it('uses the roster spelling and ignores repeats', () => {
    const { players } = shareBuilds([
      player('Dsny', [build('castle', undefined, ['Dsny', 'MASON31', 'mason31', 'dsny'])]),
      player('mason31'),
    ])
    expect(players[0].builds[0].builders).toEqual(['Dsny', 'mason31'])
  })

  it('warns about a builder who is not a player, and still credits the rest', () => {
    const { players, problems } = shareBuilds([
      player('Dsny', [build('castle', undefined, ['Dsny', 'Herobrine', 'jw01'])]),
      player('jw01'),
    ])
    expect(problems).toEqual([
      'Dsny/castle: builder "Herobrine" is not a player, add them to players.json',
    ])
    expect(players[0].builds[0].builders).toEqual(['Dsny', 'jw01'])
  })

  it("does not overwrite a builder's own build of the same name", () => {
    const { players, problems } = shareBuilds([
      player('Dsny', [build('castle', undefined, ['Dsny', 'jw01'])]),
      player('jw01', [build('castle', undefined, ['jw01'])]),
    ])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/jw01 already has a build called "castle"/)
    expect(players[1].builds).toHaveLength(1)
    expect(players[0].builds[0].builders).toEqual(['Dsny'])
  })
})
