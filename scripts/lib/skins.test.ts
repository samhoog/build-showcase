import { mkdtemp, readFile, rm, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureSkin } from './skins.ts'

let dir: string
const REAL = new Uint8Array([1, 2, 3])

// a Mojang that knows one player; `down` makes every request fail
function mockMojang({ down = false } = {}) {
  const textures = {
    textures: { SKIN: { url: 'https://textures/skin', metadata: { model: 'slim' } } },
  }
  const profile = {
    properties: [
      { name: 'textures', value: Buffer.from(JSON.stringify(textures)).toString('base64') },
    ],
  }
  const fetchMock = vi.fn(async (url: string) => {
    if (down) return new Response('', { status: 503 })
    if (url.includes('/users/profiles/')) return Response.json({ id: 'abc' })
    if (url.includes('/session/')) return Response.json(profile)
    return new Response(REAL)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const info = async (name: string) => JSON.parse(await readFile(join(dir, `${name}.json`), 'utf8'))

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'skins-'))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  await rm(dir, { recursive: true, force: true })
})

describe('ensureSkin', () => {
  it('downloads the skin and records the slim flag', async () => {
    mockMojang()
    expect(await ensureSkin('jw01', dir)).toEqual({ slim: true })
    expect(new Uint8Array(await readFile(join(dir, 'jw01.png')))).toEqual(REAL)
  })

  it('does not ask again while a real skin is fresh', async () => {
    mockMojang()
    await ensureSkin('jw01', dir)
    const second = mockMojang()
    await ensureSkin('jw01', dir)
    expect(second).not.toHaveBeenCalled()
  })

  it('falls back when the lookup fails, and retries the fallback on the next run', async () => {
    mockMojang({ down: true })
    expect(await ensureSkin('jw01', dir)).toEqual({ slim: false })
    expect(await info('jw01')).toEqual({ slim: false, fallback: true })

    mockMojang()
    expect(await ensureSkin('jw01', dir)).toEqual({ slim: true })
    expect(await info('jw01')).toEqual({ slim: true })
  })

  it('keeps a real skin when a refresh fails, rather than replacing it with the fallback', async () => {
    mockMojang()
    await ensureSkin('jw01', dir)
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    await utimes(join(dir, 'jw01.png'), old, old)

    mockMojang({ down: true })
    expect(await ensureSkin('jw01', dir)).toEqual({ slim: true })
    expect(new Uint8Array(await readFile(join(dir, 'jw01.png')))).toEqual(REAL)
  })

  it('waits and retries when Mojang rate-limits', async () => {
    // fake only setTimeout: the file I/O around it still needs the real event loop
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const working = mockMojang()
    let limited = true
    const fetchMock = vi.fn(async (url: string) => {
      if (limited && url.includes('/session/')) {
        limited = false
        return new Response('', { status: 429 })
      }
      return working(url)
    })
    vi.stubGlobal('fetch', fetchMock)

    let result: { slim: boolean } | undefined
    const pending = ensureSkin('jw01', dir).then((r) => (result = r))
    // the retry timer is set whenever the code gets there, so keep nudging the clock
    while (!result) {
      await vi.advanceTimersByTimeAsync(1000)
      await new Promise((resolve) => setImmediate(resolve))
    }
    await pending
    vi.useRealTimers()

    expect(result).toEqual({ slim: true })
    // profile lookup, rate-limited session call, its retry, then the texture
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})
