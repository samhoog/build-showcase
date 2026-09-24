import { DirectionalLight, HemisphereLight, type Scene } from 'three'

// Sky light plus one sun and no shadows. Tops come out brightest and the sides step darker,
// close to the game's own per-face shading, and it stays cheap on phones.
export function addDaylight(scene: Scene) {
  const sky = new HemisphereLight(0xffffff, 0x8a8f99, 1.9)
  const sun = new DirectionalLight(0xfff4e0, 2.2)
  sun.position.set(0.55, 1, 0.3)
  scene.add(sky, sun)
}
