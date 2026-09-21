import { PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import { frameDelta } from './frameDelta.ts'

// One WebGL context for the whole site.
//
// Browsers cap live WebGL contexts (8-16, fewer on phones), so no 3D view owns one. Each view
// is a Viewport: an ordinary <canvas> with a 2D context plus a scene and camera. The Stage
// renders a viewport's scene with its single offscreen renderer, then copies the pixels
// across. The 2D canvases scroll, clip and stack like any other element, and keep showing
// their last frame when their model is unloaded.

export class Viewport {
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(35, 1, 0.5, 4000)
  // called every frame while on screen; return true to be drawn again next frame
  onFrame: ((dt: number) => boolean) | null = null
  onResize: ((aspect: number) => void) | null = null
  visible = false
  dirty = true
  // size in CSS pixels
  width = 0
  height = 0

  readonly canvas: HTMLCanvasElement
  readonly maxDpr: number

  constructor(canvas: HTMLCanvasElement, maxDpr: number) {
    this.canvas = canvas
    this.maxDpr = maxDpr
  }

  get dpr(): number {
    return Math.min(window.devicePixelRatio || 1, this.maxDpr)
  }

  // ask for one redraw, e.g. after the camera moved or a model arrived
  invalidate() {
    this.dirty = true
    Stage.get().wake()
  }
}

export class Stage {
  private static instance: Stage | null = null

  static get(): Stage {
    return (Stage.instance ??= new Stage())
  }

  readonly supported: boolean
  private renderer: WebGLRenderer | null = null
  private viewports = new Set<Viewport>()
  private exclusive: Viewport | null = null
  private frame = 0
  // timestamp of the previous frame, null while the loop is asleep
  private lastFrame: number | null = null
  private bufferWidth = 0
  private bufferHeight = 0

  private intersections = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const viewport = this.find(entry.target)
        if (viewport) viewport.visible = entry.isIntersecting
      }
      this.wake()
      // count as visible slightly early, so a view is already drawn when it scrolls in
    },
    { rootMargin: '25% 0px' },
  )

  private resizes = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const viewport = this.find(entry.target)
      if (viewport) this.resize(viewport, entry.contentRect.width, entry.contentRect.height)
    }
  })

  private constructor() {
    try {
      this.renderer = new WebGLRenderer({ antialias: true, alpha: true })
      this.renderer.setPixelRatio(1)
      this.renderer.setClearColor(0x000000, 0)
      this.renderer.setScissorTest(true)
      const canvas = this.renderer.domElement
      canvas.addEventListener('webglcontextlost', (e) => e.preventDefault())
      canvas.addEventListener('webglcontextrestored', () => this.invalidateAll())
    } catch {
      // no WebGL: components fall back to text
    }
    this.supported = this.renderer !== null
  }

  add(viewport: Viewport) {
    this.viewports.add(viewport)
    this.intersections.observe(viewport.canvas)
    this.resizes.observe(viewport.canvas)
  }

  remove(viewport: Viewport) {
    this.viewports.delete(viewport)
    this.intersections.unobserve(viewport.canvas)
    this.resizes.unobserve(viewport.canvas)
    if (this.exclusive === viewport) this.setExclusive(null)
    // Let the buffer shrink to fit whatever is left. Copying out of a canvas costs by its
    // full size, so figures shouldn't keep paying for a card-sized buffer after a page change.
    this.bufferWidth = this.bufferHeight = 0
  }

  // While set, only this viewport is drawn (the fullscreen viewer), everything else pauses.
  setExclusive(viewport: Viewport | null) {
    this.exclusive = viewport
    if (viewport === null) {
      // let the buffer shrink back from fullscreen size to card size
      this.bufferWidth = this.bufferHeight = 0
      this.invalidateAll()
    }
    this.wake()
  }

  wake() {
    if (this.frame === 0 && this.renderer) this.frame = requestAnimationFrame(this.tick)
  }

  private find(canvas: Element): Viewport | undefined {
    for (const viewport of this.viewports) if (viewport.canvas === canvas) return viewport
  }

  private invalidateAll() {
    for (const viewport of this.viewports) viewport.dirty = true
    this.wake()
  }

  private resize(viewport: Viewport, width: number, height: number) {
    viewport.width = width
    viewport.height = height
    if (width === 0 || height === 0) return

    viewport.canvas.width = Math.round(width * viewport.dpr)
    viewport.canvas.height = Math.round(height * viewport.dpr)
    viewport.camera.aspect = width / height
    viewport.camera.updateProjectionMatrix()
    viewport.onResize?.(width / height)
    // resizing cleared the canvas; redraw before the browser paints so it never flashes empty
    if (viewport.visible && (this.exclusive === null || this.exclusive === viewport)) {
      this.draw(viewport)
    } else {
      viewport.dirty = true
    }
  }

  private tick = (now: number) => {
    this.frame = 0
    const dt = frameDelta(now, this.lastFrame)
    this.lastFrame = now

    let active = false
    const targets = this.exclusive ? [this.exclusive] : this.viewports
    for (const viewport of targets) {
      if (!viewport.visible || viewport.width === 0) continue
      const animating = viewport.onFrame?.(dt) ?? false
      if (animating || viewport.dirty) this.draw(viewport)
      active ||= animating
    }

    // sleep when nothing is moving; invalidate() or a visibility change wakes it again
    if (active) this.wake()
    else if (this.frame === 0) this.lastFrame = null
  }

  private draw(viewport: Viewport) {
    const renderer = this.renderer
    const context = viewport.canvas.getContext('2d')
    if (!renderer || !context) return
    const { width, height } = viewport.canvas

    // the shared buffer only ever grows, so alternating between cards doesn't reallocate it
    if (width > this.bufferWidth || height > this.bufferHeight) {
      this.bufferWidth = Math.max(width, this.bufferWidth)
      this.bufferHeight = Math.max(height, this.bufferHeight)
      renderer.setSize(this.bufferWidth, this.bufferHeight, false)
    }

    // render into the bottom-left corner of the buffer, then copy that corner out
    renderer.setViewport(0, 0, width, height)
    renderer.setScissor(0, 0, width, height)
    renderer.render(viewport.scene, viewport.camera)
    context.clearRect(0, 0, width, height)
    context.drawImage(
      renderer.domElement,
      0,
      this.bufferHeight - height,
      width,
      height,
      0,
      0,
      width,
      height,
    )
    viewport.dirty = false
  }
}
