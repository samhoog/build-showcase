import { describe, expect, it } from 'vitest'
import { frameDelta } from './frameDelta.ts'

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
