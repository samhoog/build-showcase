import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { assetUrl, type Build, formatSize, type Player } from '../data/manifest.ts'
import { Stage, type Viewport } from '../stage/Stage.ts'
import { useViewport } from '../stage/useViewport.ts'
import { acquireBuild, releaseBuild } from '../three/buildCache.ts'
import { BuildView } from '../three/buildView.ts'
import { BuiltWith } from './BuiltWith.tsx'
import styles from './BuildCard.module.css'

type Status = 'waiting' | 'loading' | 'ready' | 'error'
type Props = { player: Player; build: Build; coBuilders: Player[]; featured?: boolean }

// A build as a live 3D card. Mouse users can drag it round in place; a click or tap (or
// Enter on the title) opens it full screen. Nothing moves until someone moves it, so the
// "Open" badge is what says the picture is interactive.
export function BuildCard({ player, build, coBuilders, featured = false }: Props) {
  const cardRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<BuildView | null>(null)
  const pressedAt = useRef({ x: 0, y: 0 })
  const [near, setNear] = useState(false)
  const [status, setStatus] = useState<Status>('waiting')
  const [attempt, setAttempt] = useState(0)
  const navigate = useNavigate()

  const url = assetUrl(build.file, build.hash)
  const viewerPath = `/p/${player.username}/${build.slug}`

  useViewport(
    canvasRef,
    1.5,
    (viewport: Viewport) => {
      const view = new BuildView(viewport, { fullControls: false, allowTouch: false })
      viewRef.current = view
      return () => {
        view.dispose()
        viewRef.current = null
      }
    },
    [],
  )

  // "near" = within a screen of the viewport: load ahead of arrival, let go once well past
  useEffect(() => {
    const card = cardRef.current
    if (!card) return
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
      rootMargin: '100% 0px',
    })
    observer.observe(card)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!near || !view) return
    let cancelled = false
    setStatus('loading')

    acquireBuild(url).then(
      (model) => {
        if (cancelled) return
        view.show(model, build.view)
        setStatus('ready')
      },
      () => {
        if (!cancelled) setStatus('error')
      },
    )

    return () => {
      cancelled = true
      view.clear()
      releaseBuild(url)
    }
  }, [near, url, attempt, build.view])

  // a press that turned into a drag was an orbit, not a request to open the build
  const openIfClick = (event: React.MouseEvent) => {
    const moved = Math.hypot(
      event.clientX - pressedAt.current.x,
      event.clientY - pressedAt.current.y,
    )
    if (moved < 6) navigate(viewerPath, { state: { fromCard: true } })
  }

  return (
    <article ref={cardRef} className={`${styles.card} ${featured ? styles.featured : ''}`}>
      <div className={styles.view}>
        {Stage.get().supported ? (
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            aria-hidden="true"
            onPointerDown={(e) => (pressedAt.current = { x: e.clientX, y: e.clientY })}
            onClick={openIfClick}
          />
        ) : (
          <p className={styles.note}>This browser can't show 3D (WebGL is off).</p>
        )}
        {status === 'ready' && (
          // decorative: the title link below is the accessible way in, and clicks pass
          // through to the canvas
          <span className={styles.open} aria-hidden="true">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <path d="M8.5 1.5h4v4M12.5 1.5 8 6M5.5 12.5h-4v-4M1.5 12.5 6 8" />
            </svg>
            Open
          </span>
        )}
        {status === 'loading' && <p className={styles.note}>Loading {build.title}…</p>}
        {status === 'error' && (
          <p className={styles.note} role="alert">
            Couldn't load {build.file.split('/').pop()}.{' '}
            <button type="button" className={styles.retry} onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          </p>
        )}
      </div>
      <h2 className={styles.title}>
        <Link to={viewerPath} state={{ fromCard: true }}>
          {build.title}
        </Link>
      </h2>
      <p className={styles.size}>{formatSize(build.size)}</p>
      {coBuilders.length > 0 && (
        <p className={styles.credit}>
          <BuiltWith players={coBuilders} />
        </p>
      )}
      {build.description && <p className={styles.description}>{build.description}</p>}
    </article>
  )
}
