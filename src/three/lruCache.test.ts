import { describe, expect, it } from 'vitest'
import { LruCache } from './lruCache.ts'

function makeCache(capacity: number) {
  const destroyed: string[] = []
  const cache = new LruCache<string>(
    capacity,
    (key) => `value:${key}`,
    (value) => destroyed.push(value),
  )
  return { cache, destroyed }
}

describe('LruCache', () => {
  it('creates once and hands back the same value', () => {
    const { cache } = makeCache(2)
    expect(cache.acquire('a')).toBe('value:a')
    expect(cache.acquire('a')).toBe('value:a')
  })

  it('evicts the least recently used idle entry when over capacity', () => {
    const { cache, destroyed } = makeCache(2)
    for (const key of ['a', 'b']) {
      cache.acquire(key)
      cache.release(key)
    }
    cache.acquire('a')
    cache.release('a')
    cache.acquire('c')

    expect(destroyed).toEqual(['value:b'])
    expect(cache.has('a')).toBe(true)
  })

  it('never evicts an entry that is still in use', () => {
    const { cache, destroyed } = makeCache(1)
    cache.acquire('a')
    cache.acquire('b')
    expect(destroyed).toEqual([])

    cache.release('a')
    expect(destroyed).toEqual(['value:a'])
  })

  it('forgets an entry on demand so it is created again', () => {
    const { cache, destroyed } = makeCache(2)
    cache.acquire('a')
    cache.forget('a')
    expect(destroyed).toEqual(['value:a'])
    expect(cache.has('a')).toBe(false)
  })
})
