import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PNG } from 'pngjs'

export type Skin = { png: Uint8Array; slim: boolean }

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

// seconds to wait before each retry when Mojang says we're asking too fast
const RETRY_AFTER = [3, 10]

async function getJson(url: string): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (res.status === 429 && attempt < RETRY_AFTER.length) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER[attempt] * 1000))
      continue
    }
    if (!res.ok) throw new Error(`${url} answered ${res.status}`)
    return res.json()
  }
}

// username -> uuid -> profile -> skin texture, all from Mojang's own API
export async function fetchSkin(username: string): Promise<Skin> {
  const { id } = (await getJson(`https://api.mojang.com/users/profiles/minecraft/${username}`)) as {
    id: string
  }
  const profile = (await getJson(
    `https://sessionserver.mojang.com/session/minecraft/profile/${id}`,
  )) as { properties: { name: string; value: string }[] }

  const encoded = profile.properties.find((p) => p.name === 'textures')?.value
  if (!encoded) throw new Error(`no textures in profile of ${username}`)
  const { textures } = JSON.parse(Buffer.from(encoded, 'base64').toString()) as {
    textures: { SKIN?: { url: string; metadata?: { model?: string } } }
  }
  if (!textures.SKIN) throw new Error(`${username} has no custom skin`)

  const res = await fetch(textures.SKIN.url.replace('http://', 'https://'))
  if (!res.ok) throw new Error(`skin download answered ${res.status}`)
  return {
    png: new Uint8Array(await res.arrayBuffer()),
    slim: textures.SKIN.metadata?.model === 'slim',
  }
}

// Plain 64x64 stand-in used when a skin can't be downloaded
export function fallbackSkin(): Skin {
  const png = new PNG({ width: 64, height: 64 })
  const paint = (x0: number, y0: number, w: number, h: number, rgb: number[]) => {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) png.data.set([...rgb, 255], (y * 64 + x) * 4)
  }
  const tone = [198, 150, 112]
  const shirt = [58, 140, 140]
  const legs = [62, 64, 140]
  paint(0, 0, 32, 16, tone) // head
  paint(16, 16, 24, 16, shirt) // body
  paint(40, 16, 16, 16, tone) // right arm
  paint(32, 48, 16, 16, tone) // left arm
  paint(0, 16, 16, 16, legs) // right leg
  paint(16, 48, 16, 16, legs) // left leg
  for (const x of [9, 10, 13, 14]) paint(x, 12, 1, 1, [40, 40, 60]) // eyes
  return { png: PNG.sync.write(png), slim: false }
}

type SkinInfo = { slim: boolean; fallback?: boolean }

// Writes <dir>/<username>.png and returns whether the model is slim. A real skin is
// refreshed at most once a week. A failed lookup never fails the convert and never
// replaces a real skin: the player keeps the old one, or gets the fallback, and the
// fallback is retried on every run until the real skin arrives.
export async function ensureSkin(username: string, dir: string): Promise<{ slim: boolean }> {
  const pngPath = join(dir, `${username}.png`)
  const infoPath = join(dir, `${username}.json`)

  let cached: SkinInfo | null = null
  try {
    cached = JSON.parse(await readFile(infoPath, 'utf8')) as SkinInfo
    const age = Date.now() - (await stat(pngPath)).mtimeMs
    if (!cached.fallback && age < WEEK_MS) return { slim: cached.slim }
  } catch {
    cached = null
  }

  let skin: Skin
  let fallback = false
  try {
    skin = await fetchSkin(username)
  } catch (err) {
    const reason = (err as Error).message
    if (cached && !cached.fallback) {
      console.warn(`  skin for ${username} not refreshed (${reason}), keeping the current one`)
      return { slim: cached.slim }
    }
    console.warn(`  skin for ${username} unavailable (${reason}), using fallback`)
    skin = fallbackSkin()
    fallback = true
  }

  await mkdir(dir, { recursive: true })
  await writeFile(pngPath, skin.png)
  const info: SkinInfo = fallback ? { slim: skin.slim, fallback } : { slim: skin.slim }
  await writeFile(infoPath, JSON.stringify(info))
  return { slim: skin.slim }
}
