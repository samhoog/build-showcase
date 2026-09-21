import { describe, expect, it } from 'vitest'
import type { Manifest } from '../../shared/manifest.ts'
import type { Build } from '../../shared/manifest.ts'
import { coBuilders, countBuilds, countLabel, findPlayer, formatSize } from './manifest.ts'

const manifest: Manifest = {
  generatedAt: '',
  players: [{ username: 'jeb_', displayName: 'jeb_', skin: '', slim: false, builds: [] }],
}

describe('manifest helpers', () => {
  it('finds a player whatever the case of the URL', () => {
    expect(findPlayer(manifest, 'JEB_')?.username).toBe('jeb_')
    expect(findPlayer(manifest, 'nobody')).toBeUndefined()
  })

  it('formats a build size in blocks', () => {
    expect(formatSize([17, 12, 15])).toBe('17 × 12 × 15 blocks')
  })

  it('pluralises counts', () => {
    expect(countLabel(1, 'build')).toBe('1 build')
    expect(countLabel(3, 'build')).toBe('3 builds')
  })

  it('counts a shared build once, and credits the other builders on each page', () => {
    const shared = { file: 'builds/Dsny/notredame.glb', builders: ['Dsny', 'jw01'] } as Build
    const solo = { file: 'builds/jw01/hut.glb', builders: ['jw01'] } as Build
    const dsny = { username: 'Dsny', displayName: 'Dsny', skin: '', slim: false, builds: [shared] }
    const jw = {
      username: 'jw01',
      displayName: 'jw01',
      skin: '',
      slim: false,
      builds: [solo, shared],
    }
    const both: Manifest = { generatedAt: '', players: [dsny, jw] }

    expect(countBuilds(both)).toBe(2)
    expect(coBuilders(both, shared, dsny).map((p) => p.username)).toEqual(['jw01'])
    expect(coBuilders(both, shared, jw).map((p) => p.username)).toEqual(['Dsny'])
    expect(coBuilders(both, solo, jw)).toEqual([])
  })
})
