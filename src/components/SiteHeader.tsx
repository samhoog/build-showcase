import { Link } from 'react-router-dom'
import styles from './SiteHeader.module.css'

export function SiteHeader({ summary }: { summary?: string }) {
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.wordmark}>
        Build showcase
      </Link>
      {summary && <p className="muted">{summary}</p>}
    </header>
  )
}
