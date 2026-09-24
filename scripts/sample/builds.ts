import type { StartView } from '../../shared/manifest.ts'
import type { BlockId } from './blocks.ts'
import { VoxelGrid } from './voxel-obj.ts'

export type SampleBuild = {
  username: string
  folder: string
  title: string
  description: string
  builtOn: string
  // other builders to credit, to exercise shared builds
  builders?: string[]
  // custom starting camera, to exercise build.json views
  view?: StartView
  // to exercise the featured flag: the oldest of jeb_'s builds, so it must beat the date order
  featured?: boolean
  build: () => VoxelGrid
}

// cheap deterministic hash, used wherever a build wants a bit of variation
function hash(x: number, y: number, z: number): number {
  const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453
  return h - Math.floor(h)
}

function disc(g: VoxelGrid, cx: number, y: number, cz: number, r: number, id: BlockId | null) {
  for (let x = -r; x <= r; x++)
    for (let z = -r; z <= r; z++) if (x * x + z * z <= r * r + r * 0.5) g.set(cx + x, y, cz + z, id)
}

function tree(g: VoxelGrid, x: number, y: number, z: number, height: number, crown: number) {
  for (let dx = -crown; dx <= crown; dx++)
    for (let dy = -crown; dy <= crown; dy++)
      for (let dz = -crown; dz <= crown; dz++) {
        const d = dx * dx + dy * dy * 1.6 + dz * dz
        const edge = d > (crown - 1) * (crown - 1)
        if (d <= crown * crown && !(edge && hash(x + dx, dy, z + dz) < 0.35))
          g.set(x + dx, y + height + dy, z + dz, 'leaves')
      }
  g.fill(x, y, z, x, y + height, z, 'log')
}

function cottage(): VoxelGrid {
  const g = new VoxelGrid()
  g.fill(0, -1, 0, 16, -1, 14, 'dirt')
  g.fill(0, 0, 0, 16, 0, 14, 'grass')

  // walls on a cobble footing, log posts at the corners
  g.fill(3, 1, 4, 11, 1, 10, 'cobble')
  g.fill(3, 2, 4, 11, 4, 10, 'planks')
  g.fill(4, 1, 5, 10, 4, 9, null)
  g.fill(4, 0, 5, 10, 0, 9, 'planks')
  for (const [x, z] of [
    [3, 4],
    [11, 4],
    [3, 10],
    [11, 10],
  ])
    g.fill(x, 1, z, x, 4, z, 'log')

  // door, windows, and a sand path out to the edge
  g.fill(7, 1, 10, 7, 2, 10, null)
  g.fill(7, 0, 11, 7, 0, 14, 'sand')
  for (const x of [5, 9]) g.set(x, 3, 10, 'glass')
  for (const z of [6, 8]) for (const x of [3, 11]) g.set(x, 3, z, 'glass')
  g.set(8, 3, 11, 'lantern')

  // pitched roof with plank gables
  for (let i = 0; i <= 4; i++) {
    g.fill(2, 5 + i, 3 + i, 12, 5 + i, 3 + i, 'roof')
    g.fill(2, 5 + i, 11 - i, 12, 5 + i, 11 - i, 'roof')
    if (i < 4) for (const x of [3, 11]) g.fill(x, 5 + i, 4 + i, x, 5 + i, 10 - i, 'planks')
  }

  tree(g, 14, 1, 3, 4, 2)
  return g
}

function greenhouse(): VoxelGrid {
  const g = new VoxelGrid()
  g.fill(0, 0, 0, 14, 0, 10, 'grass')

  // glass shell on a plank frame
  g.fill(1, 1, 1, 13, 5, 9, 'glass')
  g.fill(2, 1, 2, 12, 5, 8, null)
  for (const x of [1, 5, 9, 13]) for (const z of [1, 9]) g.fill(x, 1, z, x, 5, z, 'planks')
  g.fill(1, 6, 1, 13, 6, 9, 'planks')
  g.fill(2, 6, 2, 12, 6, 8, 'glass')
  g.fill(3, 7, 3, 11, 7, 7, 'glass')
  g.fill(7, 1, 9, 7, 2, 9, null)

  // planting beds either side of a water channel
  g.fill(2, 0, 5, 12, 0, 5, 'water')
  for (const z of [3, 7]) {
    g.fill(2, 1, z, 12, 1, z, 'dirt')
    for (let x = 2; x <= 12; x++) {
      const tall = hash(x, 0, z) > 0.5 ? 3 : 2
      if (x % 5 !== 0) g.fill(x, 2, z, x, tall, z, 'leaves')
      else g.set(x, 2, z, 'lantern')
    }
  }
  return g
}

function watchtower(): VoxelGrid {
  const g = new VoxelGrid()
  const c = 9
  disc(g, c, 0, c, 9, 'grass')

  // hollow shaft, mostly stone with patches of cobble, slit windows on four sides
  for (let y = 1; y <= 22; y++) {
    disc(g, c, y, c, 4, 'stone')
    disc(g, c, y, c, 3, null)
  }
  for (const [x, y, z, id] of [...g])
    if (id === 'stone' && hash(x, y, z) < 0.3) g.set(x, y, z, 'cobble')
  for (const y of [6, 12, 18])
    for (const [dx, dz] of [
      [4, 0],
      [-4, 0],
      [0, 4],
      [0, -4],
    ])
      g.fill(c + dx, y, c + dz, c + dx, y + 1, c + dz, 'glass')
  g.fill(c, 1, c + 4, c, 2, c + 4, null)

  // overhanging platform with crenellations and a beacon
  disc(g, c, 23, c, 6, 'planks')
  disc(g, c, 24, c, 6, 'cobble')
  disc(g, c, 24, c, 5, null)
  for (const [x, y, z] of [...g]) if (y === 24 && (x + z) % 2 === 0) g.set(x, 25, z, 'cobble')
  g.fill(c, 24, c, c, 27, c, 'log')
  g.set(c, 28, c, 'lantern')
  return g
}

function islandOak(): VoxelGrid {
  const g = new VoxelGrid()
  const c = 10

  // floating island: grass cap over dirt, tapering to a ragged stone point
  for (let y = 0; y >= -9; y--) {
    const r = Math.round(9 + y * 0.9 + hash(0, y, 0))
    disc(g, c, y, c, Math.max(r, 1), y === 0 ? 'grass' : y > -3 ? 'dirt' : 'stone')
  }

  // pond with a sand rim
  disc(g, c + 4, 0, c + 3, 3, 'sand')
  disc(g, c + 4, 0, c + 3, 2, 'water')

  tree(g, c - 2, 1, c - 2, 9, 5)
  g.fill(c - 1, 1, c - 2, c - 1, 6, c - 2, 'log')
  tree(g, c + 5, 1, c - 4, 3, 2)
  return g
}

function stoneBridge(): VoxelGrid {
  const g = new VoxelGrid()
  const length = 28

  // river between two banks
  g.fill(0, -1, 0, length, -1, 10, 'sand')
  g.fill(0, 0, 0, length, 0, 10, 'water')
  for (const x0 of [0, length - 5]) {
    g.fill(x0, 0, 0, x0 + 5, 1, 10, 'dirt')
    g.fill(x0, 2, 0, x0 + 5, 2, 10, 'grass')
  }

  // deck rides a shallow arch, solid cobble below it down to the arch line
  const mid = length / 2
  for (let x = 3; x <= length - 3; x++) {
    const t = (x - mid) / (mid - 3)
    const deck = Math.round(3 + 4 * (1 - t * t))
    const under = Math.round(1 + 5 * Math.sqrt(Math.max(0, 1 - t * t * 1.15)))
    for (let z = 3; z <= 7; z++) {
      g.fill(x, Math.min(under, deck), z, x, deck, z, hash(x, deck, z) < 0.3 ? 'stone' : 'cobble')
      g.set(x, deck, z, 'planks')
    }
    for (const z of [3, 7]) g.set(x, deck + 1, z, 'cobble')
    if (x % 6 === 2) for (const z of [3, 7]) g.set(x, deck + 2, z, 'lantern')
  }
  return g
}

export const SAMPLE_BUILDS: SampleBuild[] = [
  {
    username: 'Notch',
    folder: 'cottage',
    title: 'Oak cottage',
    description: 'First night shelter that got out of hand.',
    builtOn: '2026-06-14',
    build: cottage,
  },
  {
    username: 'Notch',
    folder: 'greenhouse',
    title: 'Greenhouse',
    description: 'Glass, water and leaves, to check see-through blocks.',
    builtOn: '2026-08-02',
    build: greenhouse,
  },
  {
    username: 'jeb_',
    folder: 'watchtower',
    title: 'Watchtower',
    description: 'Twenty-eight blocks of stone with a beacon on top.',
    builtOn: '2026-05-20',
    view: { azimuth: -60, elevation: 10, zoom: 1.3 },
    featured: true,
    build: watchtower,
  },
  {
    username: 'jeb_',
    folder: 'island-oak',
    title: 'Island oak',
    description: 'A floating island, one big tree and a pond.',
    builtOn: '2026-07-09',
    build: islandOak,
  },
  {
    username: 'jeb_',
    folder: 'stone-bridge',
    title: 'Stone bridge',
    description: 'Arched river crossing with lantern posts.',
    builtOn: '2026-09-01',
    builders: ['Notch'],
    build: stoneBridge,
  },
]
