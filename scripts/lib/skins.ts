import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PNG } from 'pngjs'

export type Skin = { png: Uint8Array; slim: boolean }

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return res.json()
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

// Writes <dir>/<username>.png and returns whether the model is slim. Downloads at most
// once a week, and never fails the convert: offline just means the fallback skin.
export async function ensureSkin(username: string, dir: string): Promise<{ slim: boolean }> {
  const pngPath = join(dir, `${username}.png`)
  const infoPath = join(dir, `${username}.json`)

  try {
    const age = Date.now() - (await stat(pngPath)).mtimeMs
    if (age < WEEK_MS) return JSON.parse(await readFile(infoPath, 'utf8')) as { slim: boolean }
  } catch {
    // not cached yet
  }

  let skin: Skin
  try {
    skin = await fetchSkin(username)
  } catch (err) {
    console.warn(`  skin for ${username} unavailable (${(err as Error).message}), using fallback`)
    skin = fallbackSkin()
  }

  await mkdir(dir, { recursive: true })
  await writeFile(pngPath, skin.png)
  await writeFile(infoPath, JSON.stringify({ slim: skin.slim }))
  return { slim: skin.slim }
}
