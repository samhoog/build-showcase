import obj2gltf from 'obj2gltf'

// Mineways OBJ + MTL + PNGs -> one unoptimized GLB with textures embedded
export async function objToGlb(objPath: string): Promise<Uint8Array> {
  // checkTransparency reads the pixels, so an RGBA texture with no real alpha stays opaque
  return obj2gltf(objPath, { binary: true, checkTransparency: true })
}
