import { type Document, Logger, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, flatten, getBounds, join, meshopt, prune, weld } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

export type GlbStats = {
  triangles: number
  // whole blocks along x, y, z (Mineways exports one unit per block)
  size: [number, number, number]
}

// Blocks that are genuinely see-through. Everything else with alpha (leaves, plain glass,
// flowers, fences) is a cutout, which renders without sorting artefacts.
const TRANSLUCENT = /stained|tinted|water|ice|slime|honey|portal/i

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
  'meshopt.decoder': MeshoptDecoder,
})

function fixMaterials(document: Document) {
  for (const material of document.getRoot().listMaterials()) {
    // Minecraft blocks are matte
    material.setMetallicFactor(0).setRoughnessFactor(1)
    if (material.getAlphaMode() === 'BLEND' && !TRANSLUCENT.test(material.getName())) {
      material.setAlphaMode('MASK').setAlphaCutoff(0.5)
    }
  }
}

function countTriangles(document: Document): number {
  let triangles = 0
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const count = prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION')?.getCount() ?? 0
      triangles += count / 3
    }
  }
  return triangles
}

export async function optimizeGlb(glb: Uint8Array): Promise<{ glb: Uint8Array; stats: GlbStats }> {
  await MeshoptEncoder.ready
  const document = await io.readBinary(glb)
  document.setLogger(new Logger(Logger.Verbosity.WARN))
  fixMaterials(document)

  // materials that now match collapse into one, so their meshes can be joined into one draw call
  await document.transform(dedup(), flatten(), join(), weld(), prune())

  const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0]
  const { min, max } = getBounds(scene)
  const stats: GlbStats = {
    triangles: countTriangles(document),
    size: [0, 1, 2].map((i) => Math.round(max[i] - min[i])) as GlbStats['size'],
  }

  // 16-bit UVs keep tile edges exact on large texture atlases; textures are never touched
  await document.transform(meshopt({ encoder: MeshoptEncoder, quantizeTexcoord: 16 }))
  return { glb: await io.writeBinary(document), stats }
}
