import { PNG } from 'pngjs'

export const TILE = 16
export const TILES_PER_ROW = 4

type Rgba = [number, number, number, number]
type Painter = (x: number, y: number, noise: number) => Rgba

// small deterministic PRNG so the sample textures are identical on every run
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// flat colour with per-pixel brightness noise
function speckle(r: number, g: number, b: number, amount: number, a = 255): Painter {
  return (_x, _y, n) => {
    // clamp: a byte would wrap a too-bright channel round to near zero
    const k = 1 + (n - 0.5) * amount
    return [Math.min(r * k, 255), Math.min(g * k, 255), Math.min(b * k, 255), a]
  }
}

const dirt = speckle(134, 96, 67, 0.35)
const grassTop = speckle(106, 170, 64, 0.3)

const PAINTERS: Record<string, Painter> = {
  grass_top: grassTop,
  // ragged strip of grass hanging over dirt
  grass_side: (x, y, n) => (y < 3 + ((x * 7) % 3) ? grassTop(x, y, n) : dirt(x, y, n)),
  dirt,
  stone: speckle(125, 125, 125, 0.18),
  cobble: (x, y, n) => {
    const mortar = (x + (y >> 2) * 3) % 5 === 0 || y % 4 === 0
    return mortar ? speckle(84, 84, 84, 0.2)(x, y, n) : speckle(136, 136, 136, 0.25)(x, y, n)
  },
  planks: (x, y, n) =>
    (y % 4 === 3 ? speckle(120, 94, 54, 0.1) : speckle(172, 138, 84, 0.12))(x, y, n),
  log_side: (x, y, n) =>
    (x % 4 === 0 ? speckle(74, 56, 32, 0.15) : speckle(104, 82, 50, 0.18))(x, y, n),
  log_top: (x, y, n) => {
    const ring = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5))
    if (ring > 6.5) return speckle(104, 82, 50, 0.15)(x, y, n)
    return (Math.floor(ring) % 2 ? speckle(150, 120, 72, 0.1) : speckle(184, 148, 94, 0.1))(x, y, n)
  },
  roof: (x, y, n) => (y % 4 === 3 ? speckle(44, 28, 14, 0.1) : speckle(72, 46, 24, 0.15))(x, y, n),
  sand: speckle(222, 209, 160, 0.12),
  lantern: speckle(248, 206, 112, 0.3),
  // cutout: roughly a third of the pixels are fully transparent
  leaves: (x, y, n) => (n < 0.32 ? [0, 0, 0, 0] : speckle(62, 128, 44, 0.45)(x, y, n)),
  // opaque frame, clear centre with a couple of glints
  glass: (x, y) => {
    const frame = x === 0 || y === 0 || x === TILE - 1 || y === TILE - 1
    const glint = (x === 3 && y > 2 && y < 7) || (x === 4 && y === 3)
    return frame ? [206, 228, 236, 255] : glint ? [255, 255, 255, 200] : [0, 0, 0, 0]
  },
  water: speckle(52, 96, 214, 0.2, 160),
}

export const TILE_NAMES = Object.keys(PAINTERS)

export type TileRect = { u0: number; v0: number; u1: number; v1: number }

// UV rectangle of a tile, with v measured from the bottom as OBJ expects
export function tileRect(name: string): TileRect {
  const index = TILE_NAMES.indexOf(name)
  if (index < 0) throw new Error(`unknown tile "${name}"`)
  const col = index % TILES_PER_ROW
  const row = Math.floor(index / TILES_PER_ROW)
  const step = 1 / TILES_PER_ROW
  return { u0: col * step, u1: (col + 1) * step, v0: 1 - (row + 1) * step, v1: 1 - row * step }
}

// Mineways writes three variants of its texture: RGBA, RGB (no alpha) and alpha-only
export function drawAtlas(): { rgba: Buffer; rgb: Buffer; alpha: Buffer } {
  const size = TILE * TILES_PER_ROW
  const rgba = new PNG({ width: size, height: size })
  const rgb = new PNG({ width: size, height: size })
  const alpha = new PNG({ width: size, height: size })
  const random = mulberry32(1)

  TILE_NAMES.forEach((name, index) => {
    const ox = (index % TILES_PER_ROW) * TILE
    const oy = Math.floor(index / TILES_PER_ROW) * TILE
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const [r, g, b, a] = PAINTERS[name](x, y, random())
        const i = ((oy + y) * size + ox + x) * 4
        rgba.data.set([r, g, b, a], i)
        rgb.data.set([r, g, b, 255], i)
        alpha.data.set([a, a, a, 255], i)
      }
    }
  })

  return {
    rgba: PNG.sync.write(rgba),
    rgb: PNG.sync.write(rgb, { colorType: 2 }),
    alpha: PNG.sync.write(alpha, { colorType: 0 }),
  }
}
