import type { ReactNode } from 'react'
import { Notice } from '../components/Notice.tsx'
import { SiteHeader } from '../components/SiteHeader.tsx'
import { type Manifest, useManifest } from '../data/manifest.ts'

// Every page needs the manifest; this handles the states where there isn't one to show
export function ManifestGate({ children }: { children: (manifest: Manifest) => ReactNode }) {
  const { state, reload } = useManifest()
  if (state.status === 'ready') return children(state.manifest)

  return (
    <div className="page">
      <SiteHeader />
      {state.status === 'loading' && <p className="muted">Loading builds…</p>}
      {state.status === 'empty' && (
        <Notice title="No builds yet">
          <p>
            Export a build from Mineways into{' '}
            <code>models-src/&lt;username&gt;/&lt;build&gt;/</code>, then run{' '}
            <code>npm run convert</code>.
          </p>
        </Notice>
      )}
      {state.status === 'error' && (
        <Notice title="Couldn't load the builds">
          <p>{state.message} Check your connection.</p>
          <button type="button" onClick={reload}>
            Try again
          </button>
        </Notice>
      )}
    </div>
  )
}
