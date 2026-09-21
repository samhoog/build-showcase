import { describe, expect, it } from 'vitest'
import { isValidUsername, titleFromSlug, toSlug } from './slug.ts'

describe('isValidUsername', () => {
  it('accepts real usernames', () => {
    expect(isValidUsername('jeb_')).toBe(true)
    expect(isValidUsername('Notch')).toBe(true)
  })

  it('rejects names that are too short, too long or have other characters', () => {
    expect(isValidUsername('ab')).toBe(false)
    expect(isValidUsername('a'.repeat(17))).toBe(false)
    expect(isValidUsername('my builds')).toBe(false)
  })
})

describe('toSlug', () => {
  it('lowercases and hyphenates', () => {
    expect(toSlug('Harbour Lighthouse v2')).toBe('harbour-lighthouse-v2')
  })

  it('trims stray separators', () => {
    expect(toSlug('  (castle)  ')).toBe('castle')
  })
})

describe('titleFromSlug', () => {
  it('turns a folder name into a sentence-case title', () => {
    expect(titleFromSlug('harbour-lighthouse')).toBe('Harbour lighthouse')
    expect(titleFromSlug('oak_tree')).toBe('Oak tree')
  })
})
