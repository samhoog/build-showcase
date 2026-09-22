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
// builds: a featured one first (it gets the full-width slot), then newest first, undated
// ones last, then by title
export function sortManifest(players: Player[]): Player[] {
  const byBuildCount = (a: Player, b: Player) =>
    b.builds.length - a.builds.length ||
    a.username.toLowerCase().localeCompare(b.username.toLowerCase())
  const byOrder = (a: Build, b: Build) =>
    Number(b.featured === true) - Number(a.featured === true) ||
    (b.builtOn ?? '').localeCompare(a.builtOn ?? '') ||
    a.title.localeCompare(b.title)

  return players.map((p) => ({ ...p, builds: [...p.builds].sort(byOrder) })).sort(byBuildCount)
}

// Lists every shared build under each of its builders. Going in, a build sits only under
// the player whose folder holds the files, with `builders` as typed in build.json. Coming
// out, names are in their roster spelling and each builder has their own entry for the
// build, all pointing at the one converted file. Which folder held it no longer shows.
export function shareBuilds(players: Player[]): { players: Player[]; problems: string[] } {
  const problems: string[] = []
  const byName = new Map(players.map((p) => [p.username.toLowerCase(), p]))
  const shared = new Map(players.map((p) => [p.username, [...p.builds]]))

  for (const owner of players) {
    for (const build of owner.builds) {
      const where = `${owner.username}/${build.slug}`
      const builders = [owner.username]
      for (const name of build.builders) {
        const player = byName.get(name.toLowerCase())
        if (!player)
          problems.push(`${where}: builder "${name}" is not a player, add them to players.json`)
        else if (!builders.includes(player.username)) builders.push(player.username)
      }
      build.builders = builders

      for (const username of builders.slice(1)) {
        const theirs = shared.get(username)!
        if (theirs.some((b) => b.slug === build.slug)) {
          problems.push(
            `${where}: ${username} already has a build called "${build.slug}", not shared with them`,
          )
          build.builders = build.builders.filter((b) => b !== username)
        } else {
          theirs.push(build)
        }
      }
    }
  }

  return { players: players.map((p) => ({ ...p, builds: shared.get(p.username)! })), problems }
}

// Only one build per page gets the full-width slot. A player can end up with two featured
// builds, e.g. their own plus a shared one flagged in someone else's build.json.
export function featuredProblems(players: Player[]): string[] {
  return players.flatMap((player) => {
    const featured = player.builds.filter((b) => b.featured === true).map((b) => b.title)
    if (featured.length < 2) return []
    return [
      `${player.username} has ${featured.length} featured builds (${featured.join(', ')}): ` +
        `only ${featured[0]} gets the full-width slot, keep "featured" on one`,
    ]
  })
}
