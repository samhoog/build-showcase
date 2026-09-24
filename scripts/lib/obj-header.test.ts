import { describe, expect, it } from 'vitest'
import { parseBlockDimensions } from './obj-header.ts'

describe('parseBlockDimensions', () => {
  it("reads the size from Mineways' header", () => {
    const header = [
      '# Wavefront OBJ file made by Mineways version 13.01, http://mineways.com',
      '# 1619214 vertices, 1211800 faces (2423600 triangles), 252476 blocks, 136073 billboards/bits',
      '# block dimensions: X=173 by Y=169 (height) by Z=296 blocks',
      '# Elevation shading: no',
    ].join('\n')
    expect(parseBlockDimensions(header)).toEqual([173, 169, 296])
  })

  it('is null for an OBJ from anywhere else', () => {
    expect(parseBlockDimensions('# Blender v3.6 OBJ File\nv 0 0 0\n')).toBeNull()
  })
})
