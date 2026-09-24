import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import type { Player } from '../data/manifest.ts'

// 'Built with mason31 and jw01', each name a link to that player. Renders nothing for a
// build with a single builder.
export function BuiltWith({ players, lead = 'Built with' }: { players: Player[]; lead?: string }) {
  if (players.length === 0) return null
  return (
    <>
      {lead}{' '}
      {players.map((player, index) => (
        <Fragment key={player.username}>
          {index > 0 && (index === players.length - 1 ? ' and ' : ', ')}
          <Link to={`/p/${player.username}`}>{player.displayName}</Link>
        </Fragment>
      ))}
    </>
  )
}
