import { DoubleSide, Ray, Vector3 } from 'three'
import type { MeshBVH } from 'three-mesh-bvh'

// Everything about the light that the bake needs, shared by the main thread and workers
export type LightSettings = {
  // unit vector pointing at the sun
  sun: [number, number, number]
  // rays per vertex towards the sun (jittered for soft edges) and over the sky
  sunRays: number
  skyRays: number
  // how far, in blocks, nearby geometry darkens a surface
  reach: number
}

// the sun is not a point: jitter within its apparent radius for slightly soft shadow edges
const SUN_RADIUS = 0.03
// start rays just off the surface so they don't hit the face they leave from
const OFFSET = 0.01

// cosine-weighted directions over the hemisphere around +z, spread by a spiral so a small
// number of rays covers it evenly
export function hemisphere(count: number): Float32Array {
  const dirs = new Float32Array(count * 3)
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const r = Math.sqrt((i + 0.5) / count)
    const a = i * golden
    dirs.set([r * Math.cos(a), r * Math.sin(a), Math.sqrt(1 - r * r)], i * 3)
  }
  return dirs
}

// cheap stable per-vertex random number, so every run bakes the same result
function hash(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

// Bakes vertices [start, end): out[2i] = direct sun (shadow and angle), out[2i+1] = sky
// (how open the surface is), both 0..255
export function bakeRange(
  bvh: MeshBVH,
  positions: Float32Array,
  normals: Float32Array,
  start: number,
  end: number,
  out: Uint8Array,
  settings: LightSettings,
) {
  const sky = hemisphere(settings.skyRays)
  const sun = new Vector3(...settings.sun)
  const ray = new Ray()
  const n = new Vector3()
  const t = new Vector3()
  const b = new Vector3()
  const d = new Vector3()

  for (let i = start; i < end; i++) {
    n.fromArray(normals, i * 3).normalize()
    ray.origin.fromArray(positions, i * 3).addScaledVector(n, OFFSET)
    // a basis around the normal, turned by a per-vertex angle to break up banding
    t.set(Math.abs(n.x) < 0.9 ? 1 : 0, Math.abs(n.x) < 0.9 ? 0 : 1, 0)
      .cross(n)
      .normalize()
    b.crossVectors(n, t)
    const turn = hash(i) * Math.PI * 2
    const [c, s] = [Math.cos(turn), Math.sin(turn)]

    let open = 0
    for (let k = 0; k < settings.skyRays; k++) {
      const [x, y, z] = [sky[k * 3], sky[k * 3 + 1], sky[k * 3 + 2]]
      const u = x * c - y * s
      const v = x * s + y * c
      ray.direction.set(0, 0, 0).addScaledVector(t, u).addScaledVector(b, v).addScaledVector(n, z)
      const hit = bvh.raycastFirst(ray, DoubleSide, 0, settings.reach)
      // blocks right up against the surface darken it most; further ones fade out
      open += hit ? (hit.distance / settings.reach) ** 2 : 1
    }

    let lit = 0
    const facing = n.dot(sun)
    if (facing > 0) {
      for (let k = 0; k < settings.sunRays; k++) {
        const a = (k / settings.sunRays + hash(i + 7)) * Math.PI * 2
        const r = SUN_RADIUS * Math.sqrt((k + 0.5) / settings.sunRays)
        d.copy(sun)
          .addScaledVector(t, Math.cos(a) * r)
          .addScaledVector(b, Math.sin(a) * r)
        ray.direction.copy(d).normalize()
        if (!bvh.raycastFirst(ray, DoubleSide, 0, Infinity)) lit++
      }
      lit = (lit / settings.sunRays) * facing
    }

    out[i * 2] = Math.round(lit * 255)
    out[i * 2 + 1] = Math.round((open / settings.skyRays) * 255)
  }
}
