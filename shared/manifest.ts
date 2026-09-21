// Shape of public/builds/manifest.json: written by scripts/convert.ts, read by the site.

// Where the camera starts for a build. Angles in degrees; zoom is relative to the distance
// at which the build just fits, so the same view works on a phone and a wide monitor.
// target is in model coordinates and defaults to the centre of the build.
export type StartView = {
  azimuth: number
  elevation: number
  zoom?: number
  target?: [number, number, number]
}

export type Build = {
  slug: string
  title: string
  description?: string
  // ISO date, e.g. 2026-08-01
  builtOn?: string
  // usernames of everyone who built it. A shared build is listed under each of them,
  // every copy pointing at the same file.
  builders: string[]
  // custom starting camera from build.json, else the default three-quarter view
  view?: StartView
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
