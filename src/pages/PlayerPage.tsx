import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { BuildCard } from '../components/BuildCard.tsx'
import { BuildViewer } from '../components/BuildViewer.tsx'
import { Nametag } from '../components/Nametag.tsx'
import { Notice } from '../components/Notice.tsx'
import { PlayerFigure } from '../components/PlayerFigure.tsx'
import { SiteHeader } from '../components/SiteHeader.tsx'
import { countLabel, findBuild, findPlayer, type Manifest } from '../data/manifest.ts'
import styles from './PlayerPage.module.css'
import { useTitle } from './useTitle.ts'

// /p/:username lists a player's builds; /p/:username/:build is the same page with one open
export function PlayerPage({ manifest }: { manifest: Manifest }) {
  const { username = '', build: slug } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const player = findPlayer(manifest, username)
  const open = player && slug ? findBuild(player, slug) : undefined
  useTitle(open ? `${open.title} by ${player?.displayName}` : player?.displayName)

  if (!player) {
    return (
      <div className="page">
        <SiteHeader />
        <Notice title={`No player called ${username}`}>
          <p>They may not have shared a build yet, or the link has a typo.</p>
          <Link to="/">See all players</Link>
        </Notice>
      </div>
    )
  }

  const playerPath = `/p/${player.username}`
  // opened from a card: go back, so Back doesn't reopen it. Opened from a link: replace.
  const closeViewer = () =>
    location.state?.fromCard ? navigate(-1) : navigate(playerPath, { replace: true })

  return (
    <div className="page">
      <SiteHeader />
      <main>
        <Link to="/" className={styles.back}>
          All players
        </Link>

        <div className={styles.intro}>
          <PlayerFigure player={player} className={styles.figure} />
          <div>
            <h1 className={styles.name}>
              <Nametag name={player.displayName} />
            </h1>
            <p className="muted">{countLabel(player.builds.length, 'build')}</p>
          </div>
        </div>

        {slug && !open && (
          <p className={styles.missing} role="alert">
            {player.displayName} has no build called "{slug}". Here is everything they've shared.
          </p>
        )}

        {player.builds.length === 0 ? (
          <p className="muted">{player.displayName} hasn't shared a build yet.</p>
        ) : (
          <div className={styles.builds}>
            {player.builds.map((build, index) => (
              <BuildCard key={build.slug} player={player} build={build} featured={index === 0} />
            ))}
          </div>
        )}
      </main>

      {open && <BuildViewer key={open.slug} player={player} build={open} onClose={closeViewer} />}
    </div>
  )
}
