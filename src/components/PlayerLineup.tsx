import { useState } from 'react'
import { Link } from 'react-router-dom'
import { countLabel, type Player } from '../data/manifest.ts'
import { Nametag } from './Nametag.tsx'
import { PlayerFigure } from './PlayerFigure.tsx'
import styles from './PlayerLineup.module.css'

// Everyone standing side by side on a strip of ground, like a server lobby
export function PlayerLineup({ players }: { players: Player[] }) {
  const [active, setActive] = useState<string | null>(null)

  return (
    <ul className={styles.lineup}>
      {players.map((player) => (
        <li key={player.username} className={styles.spot}>
          <Link
            to={`/p/${player.username}`}
            className={styles.link}
            onPointerEnter={() => setActive(player.username)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(player.username)}
            onBlur={() => setActive(null)}
          >
            <Nametag name={player.displayName} />
            <PlayerFigure player={player} waving={active === player.username} />
            <span className={styles.count}>
              {player.builds.length === 0
                ? 'No builds yet'
                : countLabel(player.builds.length, 'build')}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
