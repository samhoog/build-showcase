import { parentPort, workerData } from 'node:worker_threads'
import { BufferAttribute, BufferGeometry } from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { bakeRange, type LightSettings } from './bake-light-core.ts'

// One slice of the bake. Geometry, BVH and output all live in shared memory, so every
// worker reads the same copy and writes its own range of the result.
type Job = {
  occluderPositions: Float32Array
  occluderIndex: Uint32Array
  bvh: ReturnType<typeof MeshBVH.serialize>
  positions: Float32Array
  normals: Float32Array
  out: Uint8Array
  start: number
  end: number
  settings: LightSettings
}

const job = workerData as Job
const geometry = new BufferGeometry()
geometry.setAttribute('position', new BufferAttribute(job.occluderPositions, 3))
geometry.setIndex(new BufferAttribute(job.occluderIndex, 1))
const bvh = MeshBVH.deserialize(job.bvh, geometry, { setIndex: false })
bakeRange(bvh, job.positions, job.normals, job.start, job.end, job.out, job.settings)
parentPort!.postMessage('done')
