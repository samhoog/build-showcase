import { type RefObject, useEffect } from 'react'
import { Stage, Viewport } from './Stage.ts'

// Registers a canvas with the shared Stage for the life of the component. `setup` fills the
// scene and may return a cleanup; it re-runs when `deps` change.
export function useViewport(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  maxDpr: number,
  setup: (viewport: Viewport) => void | (() => void),
  deps: unknown[],
) {
  useEffect(() => {
    const canvas = canvasRef.current
    const stage = Stage.get()
    if (!canvas || !stage.supported) return

    const viewport = new Viewport(canvas, maxDpr)
    const cleanup = setup(viewport)
    stage.add(viewport)
    return () => {
      stage.remove(viewport)
      cleanup?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
