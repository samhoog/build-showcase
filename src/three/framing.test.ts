import { PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { type Bounds, fitDistance, frameBounds } from './framing.ts'

const tower: Bounds = { center: new Vector3(5, 10, -3), radius: 6, halfHeight: 20 }
const slab: Bounds = { center: new Vector3(), radius: 20, halfHeight: 2 }

// every rim point, seen from the framed camera, must land inside the canvas
function fits(camera: PerspectiveCamera, bounds: Bounds): boolean {
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()
  for (let i = 0; i < 360; i += 5) {
    for (const y of [-bounds.halfHeight, bounds.halfHeight]) {
      const angle = (i * Math.PI) / 180
      const p = new Vector3(Math.cos(angle) * bounds.radius, y, Math.sin(angle) * bounds.radius)
        .add(bounds.center)
        .project(camera)
      if (Math.abs(p.x) > 1 || Math.abs(p.y) > 1) return false
    }
  }
  return true
}

describe('fitDistance', () => {
  it('backs away further on tall, narrow canvases', () => {
    expect(fitDistance(slab, 35, 9 / 16)).toBeGreaterThan(fitDistance(slab, 35, 16 / 9))
  })

  it('copes with looking straight down', () => {
    expect(fitDistance(slab, 35, 1, new Vector3(0, 1, 0))).toBeGreaterThan(0)
  })
})

describe('frameBounds', () => {
  it.each([
    ['a tower on a wide card', tower, 16 / 9],
    ['a tower on a phone', tower, 9 / 19],
    ['a slab on a wide card', slab, 16 / 9],
    ['a slab on a phone', slab, 9 / 19],
  ])('fits %s, and not loosely', (_name, bounds, aspect) => {
    const camera = new PerspectiveCamera(35, aspect)
    frameBounds(camera, bounds)
    expect(fits(camera, bounds)).toBe(true)

    // 15% closer and something must poke out, otherwise the fit is wasting the canvas
    const closer = camera.position.clone().sub(bounds.center).multiplyScalar(0.85)
    camera.position.copy(bounds.center).add(closer)
    expect(fits(camera, bounds)).toBe(false)
  })

  it('looks at the centre from above', () => {
    const camera = new PerspectiveCamera(35, 4 / 3)
    frameBounds(camera, tower)
    expect(camera.position.y).toBeGreaterThan(tower.center.y)
  })
})
