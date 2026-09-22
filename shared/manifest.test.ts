import { describe, expect, it } from 'vitest'
import { type Build, isStartView, type Manifest, setBuildView } from './manifest.ts'

describe('isStartView', () => {
  it('accepts what the camera readout produces', () => {
    expect(isStartView({ azimuth: 39, elevation: 15, zoom: 1.24, target: [-6, 41.4, 29.7] })).toBe(
      true,
    )
    expect(isStartView({ azimuth: 35, elevation: 24 })).toBe(true)
  })

  it.each([
    ['a missing angle', { azimuth: 10 }],
    ['a string for a number', { azimuth: '39', elevation: 15 }],
    ['an elevation past straight up', { azimuth: 0, elevation: 120 }],
    ['a zero or negative zoom', { azimuth: 0, elevation: 0, zoom: 0 }],
    ['a short target', { azimuth: 0, elevation: 0, target: [1, 2] }],
    ['an unknown key', { azimuth: 0, elevation: 0, fov: 50 }],
    ['not an object', [39, 15]],
  ])('rejects %s', (_name, value) => {
    expect(isStartView(value)).toBe(false)
  })
})

describe('setBuildView', () => {
  it('updates every entry of a shared build and nothing else', () => {
    const shared = () => ({ file: 'builds/Dsny/colosseum.glb' }) as Build
    const other = { file: 'builds/Dsny/colossus.glb' } as Build
    const manifest = {
      generatedAt: '',
      players: [
        { username: 'Dsny', builds: [shared(), other] },
        { username: 'TheRealJard', builds: [shared()] },
      ],
    } as Manifest
    const view = { azimuth: 57, elevation: 20 }

    expect(setBuildView(manifest, 'builds/Dsny/colosseum.glb', view)).toBe(2)
    expect(manifest.players[0].builds[0].view).toEqual(view)
    expect(manifest.players[1].builds[0].view).toEqual(view)
    expect(other.view).toBeUndefined()
  })
})
