import type { CSSProperties } from 'react'
import styles from './Nametag.module.css'

// Username set the way the game floats it over a player's head. A username is never cut
// short: long ones shrink just enough to fit the space they are given.
export function Nametag({ name }: { name: string }) {
  return (
    <span className={styles.nametag} style={{ '--chars': name.length } as CSSProperties}>
      {name}
    </span>
  )
}
