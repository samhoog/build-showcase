import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { drawAtlas } from '../sample/atlas.ts'
import { VoxelGrid, voxelsToObj } from '../sample/voxel-obj.ts'
import { objToGlb } from './obj-to-glb.ts'
import { optimizeGlb } from './optimize.ts'

let dir: string

// a 3x2x4 stone slab with leaves and water on top
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'convert-'))
  const grid = new VoxelGrid()
  grid.fill(0, 0, 0, 2, 1, 3, 'stone')
  grid.set(0, 2, 0, 'leaves')
  grid.set(2, 2, 3, 'water')
  const { obj, mtl } = voxelsToObj(grid, 'slab')
  const atlas = drawAtlas()
  await Promise.all([
    writeFile(join(dir, 'slab.obj'), obj),
    writeFile(join(dir, 'slab.mtl'), mtl),
    writeFile(join(dir, 'slab-RGBA.png'), atlas.rgba),
    writeFile(join(dir, 'slab-RGB.png'), atlas.rgb),
    writeFile(join(dir, 'slab-Alpha.png'), atlas.alpha),
  ])
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('objToGlb + optimizeGlb', () => {
  it('produces a meshopt-compressed GLB with the right size and alpha modes', async () => {
    const raw = await objToGlb(join(dir, 'slab.obj'))
    const { glb, stats } = await optimizeGlb(raw)

    expect(stats.size).toEqual([3, 3, 4])
    // slab: 2*(3*4 + 3*2 + 4*2) = 52 faces, none hidden by the see-through blocks on top,
    // which each add 5 faces of their own
    expect(stats.triangles).toBe((52 + 5 + 5) * 2)

    const io = new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
    const document = await io.readBinary(glb)
    const root = document.getRoot()
    expect(root.listExtensionsUsed().map((e) => e.extensionName)).toContain(
      'EXT_meshopt_compression',
    )

    const modes = Object.fromEntries(
      root.listMaterials().map((m) => [m.getName(), m.getAlphaMode()]),
    )
    expect(modes).toMatchObject({ Stone: 'OPAQUE', Oak_Leaves: 'MASK', Water: 'BLEND' })
  })
})
