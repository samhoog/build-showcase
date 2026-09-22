import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type Document, NodeIO, type Primitive } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, flatten, join as joinMeshes, weld } from '@gltf-transform/functions'
import { MeshoptDecoder } from 'meshoptimizer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { drawAtlas } from '../sample/atlas.ts'
import { VoxelGrid, voxelsToObj } from '../sample/voxel-obj.ts'
import { bakeLight, DEFAULT_LIGHT, lightKey, sunDirection } from './bake-light.ts'
import { objToGlb } from './obj-to-glb.ts'
import { optimizeGlb } from './optimize.ts'

// a 9x9 stone floor with a 1x3x3 pillar on it and a glass pane beside it, sun from +x at 45°
let dir: string
let raw: Uint8Array
const light = { ...DEFAULT_LIGHT, sun: sunDirection(90, 45) }
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'bake-'))
  const grid = new VoxelGrid()
  grid.fill(0, 0, 0, 8, 0, 8, 'stone')
  grid.fill(4, 1, 3, 4, 3, 5, 'stone')
  grid.fill(6, 1, 0, 8, 3, 0, 'glass')
  const { obj, mtl } = voxelsToObj(grid, 'pillar')
  const atlas = drawAtlas()
  await Promise.all([
    writeFile(join(dir, 'pillar.obj'), obj),
    writeFile(join(dir, 'pillar.mtl'), mtl),
    writeFile(join(dir, 'pillar-RGBA.png'), atlas.rgba),
    writeFile(join(dir, 'pillar-RGB.png'), atlas.rgb),
    writeFile(join(dir, 'pillar-Alpha.png'), atlas.alpha),
  ])
  raw = await objToGlb(join(dir, 'pillar.obj'))
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

// [sun, sky] (0..1) baked into the upward-facing vertex at (x, y, z)
function lightAt(document: Document, x: number, y: number, z: number): [number, number] {
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives() as Primitive[]) {
      const pos = prim.getAttribute('POSITION')!
      const nor = prim.getAttribute('NORMAL')!
      const lit = prim.getAttribute('_LIGHT')!
      for (let i = 0; i < pos.getCount(); i++) {
        const [px, py, pz] = pos.getElement(i, [] as number[])
        if (px === x && py === y && pz === z && nor.getElement(i, [] as number[])[1] > 0.9) {
          const [sun, sky] = lit.getElement(i, [] as number[])
          return [sun, sky]
        }
      }
    }
  }
  throw new Error(`no upward vertex at ${x},${y},${z}`)
}

describe('bakeLight', () => {
  it('shades by shadow, sun angle and how enclosed a surface is', async () => {
    const document = await io.readBinary(raw)
    await document.transform(dedup(), flatten(), joinMeshes(), weld())
    await bakeLight(document, light)

    // open floor on the sun side: fully lit, at the 45° sun's angle
    const [openSun, openSky] = lightAt(document, 7, 1, 7)
    expect(openSun).toBeCloseTo(Math.SQRT1_2, 1)
    // two blocks behind the pillar, away from the sun: in its shadow
    expect(lightAt(document, 2, 1, 4)[0]).toBe(0)
    // the corner where the floor meets the pillar is darker than open floor
    expect(lightAt(document, 5, 1, 4)[1]).toBeLessThan(openSky - 0.15)
    // the top of the pillar sees the whole sky
    expect(lightAt(document, 4, 4, 4)[1]).toBeGreaterThan(0.95)
    // glass lets the light through: the floor behind the pane stays lit
    expect(lightAt(document, 7, 1, 1)[0]).toBeCloseTo(Math.SQRT1_2, 1)
  })

  it('survives optimizing and compression as two normalized bytes per vertex', async () => {
    const { glb } = await optimizeGlb(raw, light)
    const document = await io.readBinary(glb)
    const attributes = document
      .getRoot()
      .listMeshes()
      .flatMap((m) => m.listPrimitives().map((p) => p.getAttribute('_LIGHT')))
    expect(attributes.length).toBeGreaterThan(0)
    for (const attribute of attributes) {
      expect(attribute?.getType()).toBe('VEC2')
      expect(attribute?.getArray()).toBeInstanceOf(Uint8Array)
      expect(attribute?.getNormalized()).toBe(true)
    }
  })

  it('is left out entirely when not asked for', async () => {
    const { glb } = await optimizeGlb(raw)
    const document = await io.readBinary(glb)
    const prims = document
      .getRoot()
      .listMeshes()
      .flatMap((m) => m.listPrimitives())
    expect(prims.every((p) => p.getAttribute('_LIGHT') === null)).toBe(true)
  })

  it('names each lighting setup, so a change to the sun rebakes every model', () => {
    expect(lightKey()).toBe(lightKey({ ...DEFAULT_LIGHT }))
    expect(lightKey()).not.toBe(lightKey({ ...DEFAULT_LIGHT, sun: sunDirection(0, 60) }))
    expect(lightKey()).toMatch(/^[0-9a-f]{8}$/)
  })
})
