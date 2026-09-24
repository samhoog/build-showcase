import { useEffect, useRef } from 'react'
import { assetUrl, type Player } from '../data/manifest.ts'
import { pointer, reducedMotion } from '../pointer.ts'
import { useViewport } from '../stage/useViewport.ts'
import { createPlayerFigure, framePlayer } from '../three/playerFigure.ts'
import styles from './PlayerFigure.module.css'

// stable per-player offset so a row of idle figures doesn't move in unison
function phaseOf(username: string): number {
  return [...username].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 13
}

type Props = { player: Player; waving?: boolean; className?: string }

// A live 3D figure wearing the player's skin. Decorative: the text around it names the player.
export function PlayerFigure({ player, waving = false, className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // read inside the frame loop, which outlives any single render
  const wavingRef = useRef(waving)
  useEffect(() => {
    wavingRef.current = waving
  }, [waving])

  useViewport(
    canvasRef,
    2,
    (viewport) => {
      let disposed = false
      let dispose = () => {}
      viewport.onResize = () => framePlayer(viewport.camera)

      createPlayerFigure(assetUrl(player.skin), player.slim, phaseOf(player.username)).then(
        (figure) => {
          if (disposed) return figure.dispose()
          dispose = figure.dispose
          figure.addTo(viewport.scene)

          viewport.onFrame = (dt) => {
            const rect = viewport.canvas.getBoundingClientRect()
            const at = pointer.position
            // look towards the cursor, measured from the figure's head
            const look = at && {
              x: (at.x - (rect.left + rect.width / 2)) / 400,
              y: (at.y - (rect.top + rect.height * 0.25)) / 400,
            }
            return figure.update(dt, {
              look,
              waving: wavingRef.current,
              reducedMotion: reducedMotion.matches,
            })
          }
          viewport.invalidate()
        },
        // a missing skin just leaves the figure out; the nametag still identifies the player
        () => {},
      )

      return () => {
        disposed = true
        dispose()
      }
    },
    [player.skin, player.slim, player.username],
  )

  return <canvas ref={canvasRef} className={`${styles.figure} ${className}`} aria-hidden="true" />
}
