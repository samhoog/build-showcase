import { MathUtils, type PerspectiveCamera, type Sphere, Vector3 } from 'three'

// three-quarter view from above, the angle a build is usually screenshotted from
const AZIMUTH = MathUtils.degToRad(35)
const ELEVATION = MathUtils.degToRad(24)

// Distance at which a sphere of `radius` just fits the narrower of the two fields of view
export function fitDistance(radius: number, fovDegrees: number, aspect: number): number {
  const vertical = MathUtils.degToRad(fovDegrees) / 2
  const horizontal = Math.atan(Math.tan(vertical) * aspect)
  return radius / Math.sin(Math.min(vertical, horizontal))
}

export function viewDirection(): Vector3 {
  return new Vector3(
    Math.sin(AZIMUTH) * Math.cos(ELEVATION),
    Math.sin(ELEVATION),
    Math.cos(AZIMUTH) * Math.cos(ELEVATION),
  )
}

// Points the camera at the sphere from `direction` (default: the three-quarter view)
export function frameSphere(camera: PerspectiveCamera, sphere: Sphere, direction = viewDirection()) {
  const distance = fitDistance(sphere.radius, camera.fov, camera.aspect)
  camera.position.copy(sphere.center).addScaledVector(direction.normalize(), distance)
  camera.near = Math.max(distance / 100, 0.1)
  camera.far = distance + sphere.radius * 4
  camera.lookAt(sphere.center)
  camera.updateProjectionMatrix()
}
