import { readFile } from 'node:fs/promises'
import type { Build, Manifest, Player } from '../../shared/manifest.ts'

export async function readManifest(path: string): Promise<Manifest | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Manifest
  } catch {
    return null
  }
}

export function findBuild(
  manifest: Manifest | null,
  username: string,
  slug: string,
): Build | undefined {
  return manifest?.players.find((p) => p.username === username)?.builds.find((b) => b.slug === slug)
}

// players with the most builds first, ties A-Z ignoring case;
// builds newest first, undated ones last, then by title
export function sortManifest(players: Player[]): Player[] {
  const byBuildCount = (a: Player, b: Player) =>
    b.builds.length - a.builds.length ||
    a.username.toLowerCase().localeCompare(b.username.toLowerCase())
  const byDate = (a: Build, b: Build) =>
    (b.builtOn ?? '').localeCompare(a.builtOn ?? '') || a.title.localeCompare(b.title)

  return players.map((p) => ({ ...p, builds: [...p.builds].sort(byDate) })).sort(byBuildCount)
}
