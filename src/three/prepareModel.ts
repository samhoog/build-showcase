import {
  Box3,
  LinearMipmapLinearFilter,
  type Material,
  type Mesh,
  MeshLambertMaterial,
  type MeshStandardMaterial,
  NearestFilter,
  type Object3D,
  Vector3,
} from 'three'
import { bakedLightMaterial } from './bakedLightMaterial.ts'
import type { Bounds } from './framing.ts'

export type PreparedModel = {
  object: Object3D
  bounds: Bounds
  dispose: () => void
}

// Matte material with crisp pixel-art sampling. Lambert is much cheaper than the PBR
// material GLTFLoader creates, and blocks have no use for PBR anyway.
function toBlockMaterial(source: MeshStandardMaterial): MeshLambertMaterial {
  return new MeshLambertMaterial({
    name: source.name,
    map: source.map,
    color: source.color,
    side: source.side,
    vertexColors: source.vertexColors,
    // the pipeline marks cutouts (leaves, glass) as MASK and real translucency as BLEND
    alphaTest: source.alphaTest,
    transparent: source.transparent,
    depthWrite: !source.transparent,
  })
}

function crispTexture(source: MeshStandardMaterial, maxAnisotropy: number) {
  if (!source.map) return
  source.map.magFilter = NearestFilter
  source.map.minFilter = LinearMipmapLinearFilter
  source.map.anisotropy = Math.min(4, maxAnisotropy)
  source.map.needsUpdate = true
}

export function prepareModel(object: Object3D, maxAnisotropy: number): PreparedModel {
  // keyed by source material and whether the mesh carries baked light
  const converted = new Map<string, { source: Material; material: Material }>()
  const meshes: Mesh[] = []

  object.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    meshes.push(mesh)
    const source = mesh.material as MeshStandardMaterial
    // GLTFLoader lower-cases custom attributes: _LIGHT arrives as _light
    const baked = mesh.geometry.hasAttribute('_light')
    const key = `${source.uuid}:${baked}`
    if (!converted.has(key)) {
      crispTexture(source, maxAnisotropy)
      const material = baked ? bakedLightMaterial(source) : toBlockMaterial(source)
      converted.set(key, { source, material })
    }
    mesh.material = converted.get(key)!.material
    // translucent blocks draw after everything else
    if (source.transparent) mesh.renderOrder = 1
  })

  const box = new Box3().setFromObject(object)
  const size = box.getSize(new Vector3())
  const bounds: Bounds = {
    center: box.getCenter(new Vector3()),
    radius: Math.hypot(size.x, size.z) / 2,
    halfHeight: size.y / 2,
  }

  const dispose = () => {
    for (const mesh of meshes) mesh.geometry.dispose()
    for (const { source, material } of converted.values()) {
      ;(source as MeshStandardMaterial).map?.dispose()
      material.dispose()
      source.dispose()
    }
  }

  return { object, bounds, dispose }
}
