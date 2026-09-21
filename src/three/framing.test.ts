import { PerspectiveCamera, Sphere, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { fitDistance, frameSphere } from './framing.ts'

describe('fitDistance', () => {
  it('fits the sphere to the vertical field of view on wide canvases', () => {
    // 90 degree fov: the sphere touches the frustum at radius / sin(45deg)
    expect(fitDistance(10, 90, 16 / 9)).toBeCloseTo(10 / Math.sin(Math.PI / 4))
  })

  it('backs away further on tall, narrow canvases', () => {
    expect(fitDistance(10, 35, 9 / 16)).toBeGreaterThan(fitDistance(10, 35, 16 / 9))
  })
})

describe('frameSphere', () => {
  it('looks at the centre from the fitted distance', () => {
    const camera = new PerspectiveCamera(35, 4 / 3)
    const sphere = new Sphere(new Vector3(5, 10, -3), 20)
    frameSphere(camera, sphere)

    expect(camera.position.distanceTo(sphere.center)).toBeCloseTo(fitDistance(20, 35, 4 / 3))
    expect(camera.position.y).toBeGreaterThan(sphere.center.y)
    expect(camera.far).toBeGreaterThan(camera.position.distanceTo(sphere.center) + 20)
  })
})
