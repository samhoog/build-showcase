// Shape of public/builds/manifest.json: written by scripts/convert.ts, read by the site.

export type Build = {
  slug: string
  title: string
  description?: string
  // ISO date, e.g. 2026-08-01
  builtOn?: string
  // path relative to the site root
  file: string
  // content hash, appended to the URL so a re-converted build is never served stale
  hash: string
  bytes: number
  triangles: number
  // whole blocks along x, y, z
  size: [number, number, number]
}

export type Player = {
  username: string
  displayName: string
  // path relative to the site root
  skin: string
  // slim ("Alex") arms rather than classic ("Steve")
  slim: boolean
  builds: Build[]
}

export type Manifest = {
  generatedAt: string
  players: Player[]
}
