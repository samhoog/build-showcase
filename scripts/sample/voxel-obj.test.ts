import { describe, expect, it } from 'vitest'
import { tileRect } from './atlas.ts'
import { VoxelGrid, voxelsToObj } from './voxel-obj.ts'

describe('voxelsToObj', () => {
  it('emits six faces for a lone block', () => {
    const grid = new VoxelGrid()
    grid.set(0, 0, 0, 'stone')
    expect(voxelsToObj(grid, 't').faceCount).toBe(6)
  })

  it('culls the faces two solid blocks share', () => {
    const grid = new VoxelGrid()
    grid.fill(0, 0, 0, 1, 0, 0, 'stone')
    expect(voxelsToObj(grid, 't').faceCount).toBe(10)
  })

  it('keeps a solid face that sits behind glass, but not the glass face against it', () => {
    const grid = new VoxelGrid()
    grid.set(0, 0, 0, 'stone')
    grid.set(1, 0, 0, 'glass')
    expect(voxelsToObj(grid, 't').faceCount).toBe(6 + 5)
  })

  it('culls faces between see-through blocks of the same type', () => {
    const grid = new VoxelGrid()
    grid.fill(0, 0, 0, 1, 0, 0, 'water')
    expect(voxelsToObj(grid, 't').faceCount).toBe(10)
  })

  it('keeps every UV inside the tile of its block', () => {
    const grid = new VoxelGrid()
    grid.set(0, 0, 0, 'stone')
    const { obj } = voxelsToObj(grid, 't')
    const rect = tileRect('stone')
    const uvs = obj.split('\n').filter((l) => l.startsWith('vt '))
    expect(uvs).toHaveLength(24)
    for (const line of uvs) {
      const [, u, v] = line.split(' ').map(Number)
      expect(u).toBeGreaterThanOrEqual(rect.u0)
      expect(u).toBeLessThanOrEqual(rect.u1)
      expect(v).toBeGreaterThanOrEqual(rect.v0)
      expect(v).toBeLessThanOrEqual(rect.v1)
    }
  })

  it('points see-through materials at the RGBA and alpha textures', () => {
    const grid = new VoxelGrid()
    grid.set(0, 0, 0, 'leaves')
    grid.set(0, 2, 0, 'stone')
    const { mtl } = voxelsToObj(grid, 'tree')
    expect(mtl).toMatch(/newmtl Oak_Leaves\n.*\n.*\nmap_Kd tree-RGBA\.png\nmap_d tree-Alpha\.png/)
    expect(mtl).toMatch(/newmtl Stone\n.*\n.*\nmap_Kd tree-RGB\.png/)
  })
})
