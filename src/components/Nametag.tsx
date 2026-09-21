import styles from './Nametag.module.css'

// Username set the way the game floats it over a player's head
export function Nametag({ name }: { name: string }) {
  return <span className={styles.nametag}>{name}</span>
}
