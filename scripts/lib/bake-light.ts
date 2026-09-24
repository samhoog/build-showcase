import { createHash } from 'node:crypto'
import { availableParallelism } from 'node:os'
import { Worker } from 'node:worker_threads'
import { type Document, type Primitive } from '@gltf-transform/core'
import { BufferAttribute, BufferGeometry, Matrix3, Matrix4, Vector3 } from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import type { LightSettings } from './bake-light-core.ts'

export type { LightSettings }

// Late-afternoon sun from the right of the default camera: it rakes across the faces the
// camera sees, leaves the others in cool shade for contrast, and throws long shadows
// towards the front where they are in view
export const DEFAULT_LIGHT: LightSettings = {
  sun: sunDirection(120, 32),
  sunRays: 4,
  skyRays: 24,
  reach: 8,
}

// bump when the bake itself changes (not just its settings), so every model is rebaked
const BAKE_VERSION = 1

// Names the lighting a model was baked with. Convert stores it per build and rebakes any
// build whose key differs, so changing the sun or the bake rebakes everything once.
export function lightKey(settings: LightSettings = DEFAULT_LIGHT): string {
  const json = JSON.stringify({ v: BAKE_VERSION, ...settings })
  return createHash('sha1').update(json).digest('hex').slice(0, 8)
}

// degrees, measured the same way as a build's camera view
export function sunDirection(azimuth: number, elevation: number): [number, number, number] {
  const a = (azimuth * Math.PI) / 180
  const e = (elevation * Math.PI) / 180
  return [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)]
}

type Part = { primitive: Primitive; positions: Float32Array; normals: Float32Array }

function shared<T extends Float32Array | Uint32Array | Uint8Array>(
  Kind: { new (buffer: SharedArrayBuffer): T; BYTES_PER_ELEMENT: number },
  length: number,
): T {
  return new Kind(new SharedArrayBuffer(length * Kind.BYTES_PER_ELEMENT))
}

// world-space positions and normals of every primitive, with the node transforms applied
function collectParts(document: Document): Part[] {
  const parts: Part[] = []
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const world = new Matrix4().fromArray(node.getWorldMatrix())
    const normalMatrix = new Matrix3().getNormalMatrix(world)
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION')
      const normal = primitive.getAttribute('NORMAL')
      if (!position || !normal) continue
      const count = position.getCount()
      const positions = new Float32Array(count * 3)
      const normals = new Float32Array(count * 3)
      const v = new Vector3()
      const el: number[] = []
      for (let i = 0; i < count; i++) {
        v.fromArray(position.getElement(i, el))
          .applyMatrix4(world)
          .toArray(positions, i * 3)
        v.fromArray(normal.getElement(i, el))
          .applyMatrix3(normalMatrix)
          .normalize()
          .toArray(normals, i * 3)
      }
      parts.push({ primitive, positions, normals })
    }
  }
  return parts
}

// Only solid and cutout blocks cast shadows: light passes through glass and water
function castsShadow(primitive: Primitive): boolean {
  return primitive.getMaterial()?.getAlphaMode() !== 'BLEND'
}

function occluderGeometry(parts: Part[]) {
  const casters = parts.filter((p) => castsShadow(p.primitive))
  const vertexCount = casters.reduce((n, p) => n + p.positions.length / 3, 0)
  const indexCount = casters.reduce((n, p) => n + (p.primitive.getIndices()?.getCount() ?? 0), 0)
  const positions = shared(Float32Array, vertexCount * 3)
  const index = shared(Uint32Array, indexCount)
  let vertexBase = 0
  let indexBase = 0
  for (const part of casters) {
    positions.set(part.positions, vertexBase * 3)
    const indices = part.primitive.getIndices()!.getArray()!
    for (let i = 0; i < indices.length; i++) index[indexBase + i] = indices[i] + vertexBase
    vertexBase += part.positions.length / 3
    indexBase += indices.length
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setIndex(new BufferAttribute(index, 1))
  return { geometry, positions, index }
}

// Bakes sunlight and skylight into every vertex as `_LIGHT` (two normalized bytes: direct
// sun including shadows, and how open to the sky the surface is). Nothing is computed at
// view time: the site just reads these, which keeps shader-style lighting free on phones.
export async function bakeLight(document: Document, settings = DEFAULT_LIGHT): Promise<void> {
  const parts = collectParts(document)
  const { geometry, positions: occluderPositions, index: occluderIndex } = occluderGeometry(parts)
  if (occluderIndex.length === 0) return
  const bvh = new MeshBVH(geometry, { useSharedArrayBuffer: true, setBoundingBox: true })
  const serialized = MeshBVH.serialize(bvh, { cloneBuffers: false })

  // every receiving vertex, one after another in shared memory
  const total = parts.reduce((n, p) => n + p.positions.length / 3, 0)
  const positions = shared(Float32Array, total * 3)
  const normals = shared(Float32Array, total * 3)
  const out = shared(Uint8Array, total * 2)
  let base = 0
  for (const part of parts) {
    positions.set(part.positions, base * 3)
    normals.set(part.normals, base * 3)
    base += part.positions.length / 3
  }

  const workers = Math.max(1, Math.min(availableParallelism() - 1, Math.ceil(total / 5000)))
  const slice = Math.ceil(total / workers)
  await Promise.all(
    Array.from({ length: workers }, (_, w) => {
      const workerData = {
        occluderPositions,
        occluderIndex,
        bvh: serialized,
        positions,
        normals,
        out,
        start: w * slice,
        end: Math.min(total, (w + 1) * slice),
        settings,
      }
      return new Promise<void>((resolve, reject) => {
        const worker = new Worker(new URL('./bake-light-worker.ts', import.meta.url), {
          workerData,
        })
        worker.once('message', () => resolve())
        worker.once('error', reject)
      })
    }),
  )

  base = 0
  for (const part of parts) {
    const count = part.positions.length / 3
    const light = document
      .createAccessor()
      .setType('VEC2')
      .setArray(out.slice(base * 2, (base + count) * 2))
      .setNormalized(true)
      .setBuffer(document.getRoot().listBuffers()[0])
    part.primitive.setAttribute('_LIGHT', light)
    base += count
  }
}
