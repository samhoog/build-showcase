import { useEffect, useRef, useState } from 'react'
import { assetUrl, type Build, formatSize, type Player } from '../data/manifest.ts'
import { Stage } from '../stage/Stage.ts'
import { useViewport } from '../stage/useViewport.ts'
import { acquireBuild, releaseBuild } from '../three/buildCache.ts'
import { BuildView } from '../three/buildView.ts'
import { BuiltWith } from './BuiltWith.tsx'
import styles from './BuildViewer.module.css'

type Status = 'loading' | 'ready' | 'error'
type Props = { player: Player; build: Build; coBuilders: Player[]; onClose: () => void }

const STEP = Math.PI / 24

// One build, full screen: orbit, zoom and pan by mouse, touch or keyboard
export function BuildViewer({ player, build, coBuilders, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<BuildView | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [attempt, setAttempt] = useState(0)
  const [touched, setTouched] = useState(false)
  const url = assetUrl(build.file, build.hash)

  // a modal dialog brings the focus trap, Esc to close and an inert page behind for free
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    closeRef.current?.focus()
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = ''
    }
  }, [])

  useViewport(
    canvasRef,
    2,
    (viewport) => {
      const view = new BuildView(viewport, { fullControls: true, allowTouch: true })
      viewRef.current = view
      view.controls.addEventListener('start', () => setTouched(true))
      Stage.get().setExclusive(viewport)
      return () => {
        view.dispose()
        viewRef.current = null
      }
    },
    [],
  )

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    let cancelled = false
    setStatus('loading')

    acquireBuild(url).then(
      (model) => {
        if (cancelled) return
        view.show(model)
        setStatus('ready')
      },
      () => {
        if (!cancelled) setStatus('error')
      },
    )

    return () => {
      cancelled = true
      releaseBuild(url)
    }
  }, [url, attempt])

  const onKeyDown = (event: React.KeyboardEvent) => {
    const view = viewRef.current
    // leave keys alone while a button has focus, so Space and Enter still press it
    if (!view || (event.target as HTMLElement).tagName === 'BUTTON') return
    const moves: Record<string, () => void> = {
      ArrowLeft: () => view.nudge(-STEP, 0),
      ArrowRight: () => view.nudge(STEP, 0),
      ArrowUp: () => view.nudge(0, -STEP),
      ArrowDown: () => view.nudge(0, STEP),
      '+': () => view.nudge(0, 0, 0.9),
      '=': () => view.nudge(0, 0, 0.9),
      '-': () => view.nudge(0, 0, 1.1),
      r: () => view.resetView(),
    }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      setTouched(true)
      move()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.viewer}
      aria-labelledby="viewer-title"
      onClose={onClose}
      onKeyDown={onKeyDown}
    >
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        tabIndex={0}
        aria-label={`3D view of ${build.title}. Arrow keys turn it, plus and minus zoom, R resets the view.`}
      />

      <div className={styles.bar}>
        <button ref={closeRef} type="button" className={styles.button} onClick={onClose}>
          Close
        </button>
        <span className={styles.spacer} />
        <button
          type="button"
          className={styles.button}
          onClick={() => viewRef.current?.resetView()}
        >
          Reset view
        </button>
      </div>

      <div className={styles.caption}>
        <h2 id="viewer-title" className={styles.title}>
          {build.title}
        </h2>
        <p className={styles.meta}>
          {formatSize(build.size)}, by {player.displayName}
          <BuiltWith players={coBuilders} lead=" with" />
        </p>
        {status === 'loading' && <p>Loading…</p>}
        {status === 'error' && (
          <p role="alert">
            Couldn't load {build.file.split('/').pop()}.{' '}
            <button type="button" className={styles.link} onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          </p>
        )}
        {status === 'ready' && !touched && (
          <p className={styles.hint}>Drag to turn it. Scroll or pinch to zoom.</p>
        )}
      </div>
    </dialog>
  )
}
