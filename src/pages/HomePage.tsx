import { PlayerLineup } from '../components/PlayerLineup.tsx'
import { SiteHeader } from '../components/SiteHeader.tsx'
import { countBuilds, countLabel, type Manifest } from '../data/manifest.ts'
import styles from './HomePage.module.css'
import { useTitle } from './useTitle.ts'

export function HomePage({ manifest }: { manifest: Manifest }) {
  useTitle()
  const builds = countBuilds(manifest)
  const summary = `${countLabel(manifest.players.length, 'player')}, ${countLabel(builds, 'build')}`

  return (
    <div className="page">
      <SiteHeader summary={summary} />
      <main>
        <h1 className={styles.heading}>Who built what</h1>
        <p className={styles.intro}>Pick a player to walk around everything they've built.</p>
        <PlayerLineup players={manifest.players} />
      </main>
    </div>
  )
}
