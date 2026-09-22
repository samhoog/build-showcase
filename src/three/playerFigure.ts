import { loadSkinToCanvas } from 'skinview-utils'
import { PlayerObject } from 'skinview3d'
import {
  AmbientLight,
  CanvasTexture,
  DirectionalLight,
  MathUtils,
  NearestFilter,
  type PerspectiveCamera,
  type Scene,
  SRGBColorSpace,
} from 'three'

// We use skinview3d for its player model only and draw it through the shared Stage.
// Its own SkinViewer would open a WebGL context per player.

export type FigureInput = {
  // where to look, -1..1 on each axis, or null to glance around idly
  look: { x: number; y: number } | null
  waving: boolean
  reducedMotion: boolean
}

export type PlayerFigure = {
  addTo: (scene: Scene) => void
  // returns true while something is still moving
  update: (dt: number, input: FigureInput) => boolean
  dispose: () => void
}

// model space is in skin pixels: PlayerObject stands with feet at y = -16 and head top at 16
const FEET_Y = -16
// leave headroom for an arm raised to wave
const TOP_Y = 21
const WIDTH = 22

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`could not load ${url}`))
    image.src = url
  })
}

// Level camera placed so the soles of the feet sit on the bottom edge of the canvas,
// which is where the page draws the ground
export function framePlayer(camera: PerspectiveCamera) {
  const vertical = Math.tan(MathUtils.degToRad(camera.fov) / 2)
  const halfHeight = (TOP_Y - FEET_Y) / 2
  const distance = Math.max(halfHeight / vertical, WIDTH / 2 / (vertical * camera.aspect))
  // the wider fit leaves spare height: spend it above the head, keep the feet on the edge
  const centreY = FEET_Y + distance * vertical
  camera.position.set(0, centreY, distance + 2)
  camera.lookAt(0, centreY, 0)
}

export async function createPlayerFigure(
  skinUrl: string,
  slim: boolean,
  phase: number,
): Promise<PlayerFigure> {
  // loadSkinToCanvas also upgrades legacy 64x32 skins to the modern layout
  const canvas = document.createElement('canvas')
  loadSkinToCanvas(canvas, await loadImage(skinUrl))
  const texture = new CanvasTexture(canvas)
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.colorSpace = SRGBColorSpace

  const player = new PlayerObject()
  player.skin.map = texture
  player.skin.modelType = slim ? 'slim' : 'default'
  player.cape.visible = false
  player.elytra.visible = false
  player.ears.visible = false

  const { head, leftArm, rightArm } = player.skin
  // where the right shoulder joint rests; the wave slides it outward a little
  const shoulderX = rightArm.position.x
  let time = phase
  let yaw = 0
  let pitch = 0
  let wave = 0
  let wavePhase = 0

  return {
    addTo(scene) {
      const sun = new DirectionalLight(0xffffff, 1.6)
      sun.position.set(-0.5, 1, 1.2)
      scene.add(new AmbientLight(0xffffff, 1.7), sun, player)
    },

    update(dt, { look, waving, reducedMotion }) {
      time += dt
      const idle = reducedMotion ? 0 : 1
      // whoever gets waved at gets looked at, which also keeps the head clear of the arm
      const target = waving
        ? { x: 0, y: 0 }
        : (look ?? { x: Math.sin(time * 0.5) * 0.35 * idle, y: 0 })
      // dt is never negative (see frameDelta), so this stays within 0..1 and always settles
      const ease = 1 - Math.exp(-dt * 9)
      const before = yaw + pitch + wave

      yaw += (MathUtils.clamp(target.x, -1, 1) * 0.95 - yaw) * ease
      pitch += (MathUtils.clamp(target.y, -1, 1) * 0.5 - pitch) * ease
      wave += ((waving ? 1 : 0) - wave) * ease
      // each wave starts from straight up: the phase only runs while the arm is up
      wavePhase = wave < 0.01 ? 0 : wavePhase + dt * 8

      head.rotation.set(pitch, yaw, 0)
      player.rotation.y = yaw * 0.3

      // arms breathe a little
      const breath = Math.sin(time * 1.7) * 0.025 * idle
      leftArm.rotation.set(Math.sin(time * 0.9) * 0.04 * idle, 0, 0.05 + breath)

      // The right arm lifts forwards, in front of the body, about x: that keeps it in its own
      // column beside the torso. Only then does it wave, outward only, between straight up
      // and up-and-out; tilting inward would put the hand through the head.
      const lift = -Math.PI * 0.95 * wave
      const out = -0.25 * (1 - Math.cos(wavePhase)) * wave * wave * idle
      const tilt = out - (0.05 + breath) * (1 - wave)
      rightArm.rotation.set(lift - Math.sin(time * 0.9) * 0.04 * idle * (1 - wave), 0, tilt)
      // Minecraft's shoulder joint sits 2px below the top of the arm and 1px in from its
      // inner edge, so tilting out swings that top corner (cos - 2 sin from the joint) into
      // the body. Slide the arm out by exactly the overlap.
      rightArm.position.x = shoulderX - Math.max(0, Math.cos(tilt) - 2 * Math.sin(tilt) - 1)

      const settling = Math.abs(yaw + pitch + wave - before) > 1e-4
      return !reducedMotion || settling
    },

    dispose() {
      texture.dispose()
      player.traverse((child) => {
        const mesh = child as { geometry?: { dispose(): void } }
        mesh.geometry?.dispose()
      })
    },
  }
}
