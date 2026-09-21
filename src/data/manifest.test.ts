import { describe, expect, it } from 'vitest'
import type { Manifest } from '../../shared/manifest.ts'
import { countLabel, findPlayer, formatSize } from './manifest.ts'

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
})
