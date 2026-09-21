import { type Object3D, Vector3 } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { reducedMotion } from '../pointer.ts'
import type { Viewport } from '../stage/Stage.ts'
import { type Bounds, fitDistance, frameBounds, viewDirection } from './framing.ts'
import { addDaylight } from './lighting.ts'
import type { PreparedModel } from './prepareModel.ts'

// seconds of stillness after a drag before a build starts turning again
const RESUME_AFTER = 2

export type BuildViewOptions = {
  // cards orbit only; the fullscreen viewer can also zoom and pan
  fullControls: boolean
  // cards ignore touch so a finger on a card scrolls the page
  allowTouch: boolean
}

// Scene, camera and orbit controls for one build, shared by the card and the fullscreen viewer
export class BuildView {
  readonly controls: OrbitControls
  private viewport: Viewport
  private model: Object3D | null = null
  private bounds: Bounds = { center: new Vector3(), radius: 1, halfHeight: 1 }
  private idleFor = 0
  private rotating = !reducedMotion.matches
  private dragging = false
  private allowTouch: boolean

  // touch only drives the controls where the view owns the screen
  private gate = (event: PointerEvent) => {
    this.controls.enabled = this.allowTouch || event.pointerType !== 'touch'
  }

  constructor(viewport: Viewport, options: BuildViewOptions) {
    this.viewport = viewport
    const canvas = viewport.canvas
    addDaylight(viewport.scene)

    // registered before OrbitControls adds its own listener, so it decides first
    this.allowTouch = options.allowTouch
    canvas.addEventListener('pointerdown', this.gate)

    this.controls = new OrbitControls(viewport.camera, canvas)
    this.controls.enableDamping = true
    this.controls.enableZoom = options.fullControls
    this.controls.enablePan = options.fullControls
    this.controls.autoRotateSpeed = 1.4
    this.controls.maxPolarAngle = Math.PI * 0.55
    // OrbitControls claims every touch gesture; give vertical scrolling back on cards
    if (!options.allowTouch) canvas.style.touchAction = 'pan-y'
    // it also leaves an inline `cursor: auto` behind, which would beat the stylesheet's
    // pointer (cards) and grab (viewer) hands
    canvas.style.cursor = ''

    this.controls.addEventListener('start', () => {
      this.dragging = true
      canvas.style.cursor = 'grabbing'
    })
    this.controls.addEventListener('end', () => {
      this.dragging = false
      this.idleFor = 0
      canvas.style.cursor = ''
    })
    this.controls.addEventListener('change', () => viewport.invalidate())

    viewport.onResize = () => this.reframe()
    viewport.onFrame = (dt) => this.update(dt)
  }

  get isRotating(): boolean {
    return this.rotating
  }

  setRotating(rotating: boolean) {
    this.rotating = rotating
    this.idleFor = RESUME_AFTER
    this.viewport.invalidate()
  }

  show(model: PreparedModel) {
    this.clear()
    // a clone shares geometry and materials, so card and viewer can show one build at once
    this.model = model.object.clone()
    this.bounds = model.bounds
    this.viewport.scene.add(this.model)
    this.resetView()
  }

  // Removes the model but leaves the last frame on the canvas as a poster
  clear() {
    if (this.model) this.viewport.scene.remove(this.model)
    this.model = null
  }

  resetView() {
    this.controls.target.copy(this.bounds.center)
    frameBounds(this.viewport.camera, this.bounds)
    this.applyZoomLimits()
    this.controls.update()
    this.viewport.invalidate()
  }

  // Orbit by keyboard: angles in radians, zoom as a distance multiplier
  nudge(azimuth: number, polar: number, zoom = 1) {
    const { camera } = this.viewport
    const offset = camera.position.clone().sub(this.controls.target)
    const distance = offset.length() * zoom
    const theta = Math.atan2(offset.x, offset.z) + azimuth
    const phi = Math.min(
      Math.max(Math.acos(offset.y / offset.length()) + polar, 0.05),
      this.controls.maxPolarAngle,
    )
    const clamped = Math.min(
      Math.max(distance, this.controls.minDistance),
      this.controls.maxDistance,
    )
    offset.set(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta))
    camera.position.copy(this.controls.target).addScaledVector(offset, clamped)
    this.idleFor = 0
    this.controls.update()
    this.viewport.invalidate()
  }

  dispose() {
    this.clear()
    this.viewport.canvas.removeEventListener('pointerdown', this.gate)
    this.controls.dispose()
  }

  // keep the current viewing angle, refit the distance to the new shape of the canvas
  private reframe() {
    const { camera } = this.viewport
    const direction = camera.position.clone().sub(this.controls.target)
    const untouched = direction.lengthSq() === 0
    frameBounds(camera, this.bounds, untouched ? viewDirection() : direction)
    this.applyZoomLimits()
  }

  private applyZoomLimits() {
    const { camera } = this.viewport
    const fit = fitDistance(this.bounds, camera.fov, camera.aspect)
    const reach = Math.hypot(this.bounds.radius, this.bounds.halfHeight)
    this.controls.minDistance = reach * 0.4
    this.controls.maxDistance = fit * 2.5
    camera.near = Math.max(reach / 200, 0.05)
    camera.far = fit * 2.5 + reach * 2
    camera.updateProjectionMatrix()
  }

  private update(dt: number): boolean {
    if (!this.model) return false
    this.idleFor += dt
    const turn = this.rotating && !this.dragging && this.idleFor >= RESUME_AFTER
    this.controls.autoRotate = turn
    const moved = this.controls.update(dt)
    // keep ticking while turning, easing out of a drag, or counting down to resume
    return moved || turn || (this.rotating && !this.dragging)
  }
}
