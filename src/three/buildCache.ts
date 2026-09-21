import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { LruCache } from './lruCache.ts'
import { type PreparedModel, prepareModel } from './prepareModel.ts'

// phones get a tighter budget: these models can run to hundreds of thousands of triangles
const CAPACITY = window.matchMedia('(pointer: coarse)').matches ? 4 : 8

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)

async function load(url: string): Promise<PreparedModel> {
  const gltf = await loader.loadAsync(url)
  // 16 covers every GPU worth caring about; prepareModel clamps it further
  return prepareModel(gltf.scene, 16)
}

const cache = new LruCache<Promise<PreparedModel>>(CAPACITY, load, (loading) => {
  loading.then((model) => model.dispose()).catch(() => {})
})

// Hold a build's model. Pair every acquire with a release; the model is only unloaded once
// nobody holds it and newer builds have pushed it out.
export function acquireBuild(url: string): Promise<PreparedModel> {
  const loading = cache.acquire(url)
  // a failed download must not stay cached, or "Try again" would replay the failure
  loading.catch(() => cache.forget(url))
  return loading
}

export function releaseBuild(url: string) {
  cache.release(url)
}
