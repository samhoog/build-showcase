import {
  Box3,
  LinearMipmapLinearFilter,
  type Material,
  type Mesh,
  MeshLambertMaterial,
  type MeshStandardMaterial,
  NearestFilter,
  type Object3D,
  Sphere,
} from 'three'

export type PreparedModel = {
  object: Object3D
  bounds: Sphere
  dispose: () => void
}

// Matte material with crisp pixel-art sampling. Lambert is much cheaper than the PBR
// material GLTFLoader creates, and blocks have no use for PBR anyway.
function toBlockMaterial(source: MeshStandardMaterial, maxAnisotropy: number): MeshLambertMaterial {
  if (source.map) {
    source.map.magFilter = NearestFilter
    source.map.minFilter = LinearMipmapLinearFilter
    source.map.anisotropy = Math.min(4, maxAnisotropy)
    source.map.needsUpdate = true
  }
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

export function prepareModel(object: Object3D, maxAnisotropy: number): PreparedModel {
  const converted = new Map<Material, MeshLambertMaterial>()
  const meshes: Mesh[] = []

  object.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    meshes.push(mesh)
    const source = mesh.material as MeshStandardMaterial
    if (!converted.has(source)) converted.set(source, toBlockMaterial(source, maxAnisotropy))
    mesh.material = converted.get(source)!
    // translucent blocks draw after everything else
    if (source.transparent) mesh.renderOrder = 1
  })

  const bounds = new Box3().setFromObject(object).getBoundingSphere(new Sphere())

  const dispose = () => {
    for (const mesh of meshes) mesh.geometry.dispose()
    for (const [source, material] of converted) {
      material.map?.dispose()
      material.dispose()
      source.dispose()
    }
  }

  return { object, bounds, dispose }
}
