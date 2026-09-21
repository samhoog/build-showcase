import { describe, expect, it } from 'vitest'
import { frameDelta, restUntil } from './frameDelta.ts'

describe('frameDelta', () => {
  it('is the time between two frames, in seconds', () => {
    expect(frameDelta(1016, 1000)).toBeCloseTo(0.016)
  })

  it('is zero on the first frame after waking', () => {
    expect(frameDelta(5000, null)).toBe(0)
  })

  it('never goes negative, even if timestamps arrive out of order', () => {
    expect(frameDelta(1000, 1060)).toBe(0)
  })

  it('caps the step after a long pause', () => {
    expect(frameDelta(60_000, 1000)).toBe(0.1)
  })
})

describe('restUntil', () => {
  const FRAME = 1000 / 60

  it('never costs a fast GPU a frame', () => {
    expect(restUntil(0, 3, false)).toBeLessThan(FRAME)
  })

  it('makes a slow device skip frames in proportion to what drawing costs', () => {
    // 100 ms to draw: next draw no sooner than 300 ms in, so at least 2/3 of the time is free
    expect(restUntil(0, 100, false)).toBe(300)
  })

  it('rests less in the fullscreen viewer', () => {
    expect(restUntil(0, 100, true)).toBeLessThan(restUntil(0, 100, false))
  })
})
