import { tileRect } from './atlas.ts'
import { BLOCKS, type Block, type BlockId } from './blocks.ts'

export class VoxelGrid {
  private cells = new Map<string, BlockId>()

  set(x: number, y: number, z: number, id: BlockId | null) {
    if (id === null) this.cells.delete(`${x},${y},${z}`)
    else this.cells.set(`${x},${y},${z}`, id)
  }

  get(x: number, y: number, z: number): BlockId | undefined {
    return this.cells.get(`${x},${y},${z}`)
  }

  fill(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, id: BlockId | null) {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.set(x, y, z, id)
  }

  *[Symbol.iterator](): Generator<[number, number, number, BlockId]> {
    for (const [key, id] of this.cells) {
      const [x, y, z] = key.split(',').map(Number)
      yield [x, y, z, id]
    }
  }
}

type Face = {
  normal: [number, number, number]
  tile: (b: Block) => string
  // corners as seen from outside: bottom-left, bottom-right, top-right, top-left
  corners: [number, number, number][]
}

const side = (b: Block) => b.side

const FACES: Face[] = [
  { normal: [1, 0, 0], tile: side, corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { normal: [-1, 0, 0], tile: side, corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { normal: [0, 0, 1], tile: side, corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { normal: [0, 0, -1], tile: side, corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
  { normal: [0, 1, 0], tile: (b) => b.top, corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { normal: [0, -1, 0], tile: (b) => b.bottom, corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
]

// a face is hidden by an opaque neighbour, or by a neighbour of the same see-through type
function isHidden(self: BlockId, neighbour: BlockId | undefined): boolean {
  if (neighbour === undefined) return false
  if (!BLOCKS[neighbour].transparent) return true
  return neighbour === self
}

export type ObjExport = { obj: string; mtl: string; faceCount: number }

// Writes the grid the way Mineways does: Y up, one unit per block, one material per block type,
// opaque materials on the RGB texture and see-through ones on RGBA plus an alpha map.
export function voxelsToObj(grid: VoxelGrid, name: string): ObjExport {
  const v: string[] = []
  const vt: string[] = []
  const facesByBlock = new Map<BlockId, string[]>()

  for (const [x, y, z, id] of grid) {
    const block = BLOCKS[id]
    FACES.forEach((face, faceIndex) => {
      const [nx, ny, nz] = face.normal
      if (isHidden(id, grid.get(x + nx, y + ny, z + nz))) return

      const { u0, v0, u1, v1 } = tileRect(face.tile(block))
      const base = v.length + 1
      for (const [cx, cy, cz] of face.corners) v.push(`v ${x + cx} ${y + cy} ${z + cz}`)
      vt.push(`vt ${u0} ${v0}`, `vt ${u1} ${v0}`, `vt ${u1} ${v1}`, `vt ${u0} ${v1}`)

      const n = faceIndex + 1
      const corners = [0, 1, 2, 3].map((i) => `${base + i}/${base + i}/${n}`).join(' ')
      if (!facesByBlock.has(id)) facesByBlock.set(id, [])
      facesByBlock.get(id)!.push(`f ${corners}`)
    })
  }

  const vn = FACES.map((f) => `vn ${f.normal.join(' ')}`)
  const groups = [...facesByBlock].flatMap(([id, faces]) => [
    `g ${BLOCKS[id].name}`,
    `usemtl ${BLOCKS[id].name}`,
    ...faces,
  ])
  const obj = [`# Sample export in Mineways layout`, `mtllib ${name}.mtl`, ...v, ...vt, ...vn, ...groups]

  const mtl = [...facesByBlock.keys()].flatMap((id) => {
    const block = BLOCKS[id]
    const maps = block.transparent
      ? [`map_Kd ${name}-RGBA.png`, `map_d ${name}-Alpha.png`]
      : [`map_Kd ${name}-RGB.png`]
    return [`newmtl ${block.name}`, 'Kd 1 1 1', 'Ks 0 0 0', ...maps, '']
  })

  const faceCount = [...facesByBlock.values()].reduce((sum, faces) => sum + faces.length, 0)
  return { obj: obj.join('\n') + '\n', mtl: mtl.join('\n'), faceCount }
}
