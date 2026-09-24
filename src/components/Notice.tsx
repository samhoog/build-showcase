import type { ReactNode } from 'react'
import styles from './Notice.module.css'

// Full-page message for empty, error and not-found states: what happened, then what to do
export function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.notice}>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.body}>{children}</div>
    </section>
  )
}
