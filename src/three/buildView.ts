import { type Object3D, Vector3 } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { StartView } from '../../shared/manifest.ts'
import type { Viewport } from '../stage/Stage.ts'
import { type Bounds, fitDistance, frameBounds, viewAngles, viewDirection } from './framing.ts'
import { addDaylight } from './lighting.ts'
import type { PreparedModel } from './prepareModel.ts'

export type BuildViewOptions = {
  // cards orbit only; the fullscreen viewer can also zoom and pan
  fullControls: boolean
  // cards ignore touch so a finger on a card scrolls the page
  allowTouch: boolean
}

// Scene, camera and orbit controls for one build, shared by the card and the fullscreen viewer.
export class BuildView {
  readonly controls: OrbitControls
  private viewport: Viewport
  private model: Object3D | null = null
  private bounds: Bounds = { center: new Vector3(), radius: 1, halfHeight: 1 }
  private start: StartView | undefined
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
      canvas.style.cursor = ''
      // damping eases the camera to a stop over the next few frames
      viewport.invalidate()
    })
    this.controls.addEventListener('change', () => viewport.invalidate())

    viewport.onResize = () => this.reframe()
    viewport.onFrame = (dt) => this.update(dt)
  }

  show(model: PreparedModel, start?: StartView) {
    this.clear()
    // a clone shares geometry and materials, so card and viewer can show one build at once
    this.model = model.object.clone()
    this.bounds = model.bounds
    this.start = start
    this.viewport.scene.add(this.model)
    this.resetView()
  }

  // Removes the model but leaves the last frame on the canvas as a poster
  clear() {
    if (this.model) this.viewport.scene.remove(this.model)
    this.model = null
  }

  // Back to the starting view: the build's own if build.json has one, else the default
  resetView() {
    const { camera } = this.viewport
    const start = this.start
    const target = start?.target ? new Vector3(...start.target) : this.bounds.center
    const direction = viewDirection(start?.azimuth, start?.elevation)
    this.controls.target.copy(target)
    frameBounds(camera, { ...this.bounds, center: target }, direction)
    if (start?.zoom) {
      const fit = fitDistance(this.bounds, camera.fov, camera.aspect, direction)
      camera.position.copy(target).addScaledVector(direction, fit / start.zoom)
    }
    this.applyZoomLimits()
    this.controls.update()
    this.viewport.invalidate()
  }

  // The current camera as a StartView, for pasting into build.json. Target is left out
  // when it is still the centre of the build.
  describeView(): StartView {
    const { camera } = this.viewport
    const target = this.controls.target
    const offset = camera.position.clone().sub(target)
    const { azimuth, elevation } = viewAngles(offset)
    const fit = fitDistance(this.bounds, camera.fov, camera.aspect, offset.clone().normalize())
    const view: StartView = {
      azimuth: Math.round(azimuth),
      elevation: Math.round(elevation),
      zoom: Number((fit / offset.length()).toFixed(2)),
    }
    if (target.distanceTo(this.bounds.center) > 0.5) {
      view.target = target.toArray().map((v) => Number(v.toFixed(1))) as StartView['target']
    }
    return view
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

  // Nothing moves on its own: a build only turns while someone turns it. Big builds are
  // slow to draw, and a slow automatic turn reads as lag where a still model reads as a
  // picture. Keep ticking only while a drag is in progress or damping out.
  private update(dt: number): boolean {
    if (!this.model) return false
    const moved = this.controls.update(dt)
    return moved || this.dragging
  }
}
