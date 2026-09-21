import { MathUtils, type PerspectiveCamera, Vector3 } from 'three'

// three-quarter view from above, the angle a build is usually screenshotted from
const AZIMUTH = MathUtils.degToRad(35)
const ELEVATION = MathUtils.degToRad(24)
// breathing room around the build, as a fraction of the fitted distance
const MARGIN = 1.06
const UP = new Vector3(0, 1, 0)

// A build's extent as an upright cylinder. Unlike a box it looks the same from every
// side, so a fit stays right while the build turns; unlike a sphere it is tight.
export type Bounds = {
  center: Vector3
  // horizontal reach from the centre
  radius: number
  halfHeight: number
}

export function viewDirection(): Vector3 {
  return new Vector3(
    Math.sin(AZIMUTH) * Math.cos(ELEVATION),
    Math.sin(ELEVATION),
    Math.cos(AZIMUTH) * Math.cos(ELEVATION),
  )
}

// Closest the camera can be along `direction` with the whole cylinder inside the frustum
export function fitDistance(
  bounds: Bounds,
  fovDegrees: number,
  aspect: number,
  direction = viewDirection(),
): number {
  const towards = direction.clone().normalize()
  // looking straight down has no "right"; nudge it so the basis stays defined
  if (Math.abs(towards.y) > 0.999) towards.set(0.04, towards.y, 0).normalize()
  const right = new Vector3().crossVectors(UP, towards).normalize()
  const up = new Vector3().crossVectors(towards, right)
  const tanV = Math.tan(MathUtils.degToRad(fovDegrees) / 2)
  const tanH = tanV * aspect

  // every point on the rims must fit: its depth plus how far back its offset pushes the camera
  let distance = 0
  const point = new Vector3()
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2
    for (const y of [-bounds.halfHeight, bounds.halfHeight]) {
      point.set(Math.cos(angle) * bounds.radius, y, Math.sin(angle) * bounds.radius)
      const depth = point.dot(towards)
      const needed = Math.max(Math.abs(point.dot(up)) / tanV, Math.abs(point.dot(right)) / tanH)
      distance = Math.max(distance, depth + needed)
    }
  }
  return distance * MARGIN
}

// Points the camera at the build from `direction` (default: the three-quarter view)
export function frameBounds(
  camera: PerspectiveCamera,
  bounds: Bounds,
  direction = viewDirection(),
) {
  const distance = fitDistance(bounds, camera.fov, camera.aspect, direction)
  camera.position.copy(bounds.center).addScaledVector(direction.clone().normalize(), distance)
  camera.lookAt(bounds.center)
}
