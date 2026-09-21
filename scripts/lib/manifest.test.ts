import { describe, expect, it } from 'vitest'
import type { Build, Player } from '../../shared/manifest.ts'
import { sortManifest } from './manifest.ts'

function build(title: string, builtOn?: string): Build {
  return {
    slug: title,
    title,
    builtOn,
    file: '',
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
