import { useEffect, useState } from 'react'
import type { Build, Manifest, Player } from '../../shared/manifest.ts'

export type { Build, Manifest, Player }

export type ManifestState =
  | { status: 'loading' }
  | { status: 'ready'; manifest: Manifest }
  // no manifest, or one with no players: nothing has been converted yet
  | { status: 'empty' }
  | { status: 'error'; message: string }

// site-root-relative path from the manifest -> URL that respects the deploy base path
export function assetUrl(path: string, version?: string): string {
  return `${import.meta.env.BASE_URL}${path}${version ? `?v=${version}` : ''}`
}

async function fetchManifest(): Promise<ManifestState> {
  try {
    const res = await fetch(assetUrl('builds/manifest.json'), { cache: 'no-cache' })
    // dev servers and SPA hosts answer a missing file with index.html, so check the type too
    const isJson = res.headers.get('content-type')?.includes('json') ?? false
    if (res.status === 404 || (res.ok && !isJson)) return { status: 'empty' }
    if (!res.ok) return { status: 'error', message: `The build list answered ${res.status}.` }

    const manifest = (await res.json()) as Manifest
    return manifest.players.length > 0 ? { status: 'ready', manifest } : { status: 'empty' }
  } catch {
    return { status: 'error', message: 'The build list could not be downloaded.' }
  }
}

let request: Promise<ManifestState> | null = null

// one fetch shared by every component; reload() drops it so "Try again" refetches
export function useManifest(): { state: ManifestState; reload: () => void } {
  const [state, setState] = useState<ManifestState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    request ??= fetchManifest()
    request.then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const reload = () => {
    request = null
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  return { state, reload }
}

export function findPlayer(manifest: Manifest, username: string): Player | undefined {
  const wanted = username.toLowerCase()
  return manifest.players.find((p) => p.username.toLowerCase() === wanted)
}

export function findBuild(player: Player, slug: string): Build | undefined {
  return player.builds.find((b) => b.slug === slug)
}

// [17, 12, 15] -> '17 × 12 × 15 blocks'
export function formatSize(size: Build['size']): string {
  return `${size.join(' × ')} blocks`
}

export function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}
