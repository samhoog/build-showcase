import { useEffect, useRef, useState } from 'react'
import type { StartView } from '../../shared/manifest.ts'
import { assetUrl, type Build, formatSize, type Player } from '../data/manifest.ts'
import { saveView } from '../data/saveView.ts'
import { Stage } from '../stage/Stage.ts'
import { useViewport } from '../stage/useViewport.ts'
import { acquireBuild, releaseBuild } from '../three/buildCache.ts'
import { BuildView } from '../three/buildView.ts'
import { BuiltWith } from './BuiltWith.tsx'
import styles from './BuildViewer.module.css'

type Status = 'loading' | 'ready' | 'error'
type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; path: string }
  | { status: 'failed'; message: string }
type Props = {
  player: Player
  build: Build
  coBuilders: Player[]
  onClose: () => void
  // called after the camera readout saved a new starting view (dev server only)
  onViewSaved?: (view: StartView) => void
}

const STEP = Math.PI / 24

// One build, full screen: orbit, zoom and pan by mouse, touch or keyboard
export function BuildViewer({ player, build, coBuilders, onClose, onViewSaved }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<BuildView | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [attempt, setAttempt] = useState(0)
  const [touched, setTouched] = useState(false)
  // camera readout for setting a build's starting view: ?camera in the URL or the C key
  const [readout, setReadout] = useState(() => new URLSearchParams(location.search).has('camera'))
  const readoutRef = useRef(readout)
  const [camera, setCamera] = useState<StartView | null>(null)
  const [save, setSave] = useState<SaveState>({ status: 'idle' })
  const url = assetUrl(build.file, build.hash)

  useEffect(() => {
    readoutRef.current = readout
    if (readout) setCamera(viewRef.current?.describeView() ?? null)
  }, [readout])

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
      view.controls.addEventListener('change', () => {
        if (!readoutRef.current) return
        setCamera(view.describeView())
        // "saved" describes the view as it was saved; moving on makes it out of date
        setSave({ status: 'idle' })
      })
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
        view.show(model, build.view)
        setStatus('ready')
        if (readoutRef.current) setCamera(view.describeView())
      },
      () => {
        if (!cancelled) setStatus('error')
      },
    )

    return () => {
      cancelled = true
      releaseBuild(url)
    }
    // build.view is only where the camera starts: a view saved from here updates Reset
    // through setStart, and must not reload the model and move the camera
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, attempt])

  const saveCamera = async () => {
    // a Save straight after a drag should save where the camera comes to rest
    viewRef.current?.settle()
    const view = viewRef.current?.describeView()
    if (!view) return
    setSave({ status: 'saving' })
    try {
      const path = await saveView(build.file, view)
      viewRef.current?.setStart(view)
      onViewSaved?.(view)
      setSave({ status: 'saved', path })
    } catch (err) {
      setSave({ status: 'failed', message: (err as Error).message })
    }
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    const view = viewRef.current
    if (!view) return
    // the readout toggle works wherever focus is; it is no key a button would use
    if (event.key === 'c') return setReadout((on) => !on)
    // leave the rest alone while a button has focus, so Space and Enter still press it
    if ((event.target as HTMLElement).tagName === 'BUTTON') return
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

      {readout && camera && (
        <div className={styles.readout}>
          <p>
            Starting view for <code>build.json</code>:
          </p>
          <pre>{`"view": ${JSON.stringify(camera)}`}</pre>
          {import.meta.env.DEV && (
            <button
              type="button"
              className={styles.button}
              onClick={saveCamera}
              disabled={save.status === 'saving'}
            >
              Save to build.json
            </button>
          )}
          <button
            type="button"
            className={styles.button}
            onClick={() => navigator.clipboard?.writeText(`"view": ${JSON.stringify(camera)}`)}
          >
            Copy
          </button>
          <button type="button" className={styles.button} onClick={() => setReadout(false)}>
            Hide
          </button>
          {save.status === 'saved' && (
            <p role="status">
              Saved to <code>{save.path}</code>. Cards and Reset view start here now.
            </p>
          )}
          {save.status === 'failed' && <p role="alert">Couldn't save: {save.message}</p>}
        </div>
      )}

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
