// Where the pipeline reads and writes. The defaults are the real site; the e2e tests point
// these at a sandbox (.e2e/) so running them never touches real players or builds.
export const SOURCES_DIR = process.env.SOURCES_DIR ?? 'models-src'
export const PUBLIC_DIR = process.env.PUBLIC_DIR ?? 'public'
export const ROSTER_FILE = process.env.ROSTER_FILE ?? 'players.json'
