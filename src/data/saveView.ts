import type { StartView } from '../../shared/manifest.ts'

// Asks the dev server to write `view` into the build's build.json. Only `npm run dev` has
// the endpoint (scripts/save-view-endpoint.ts); callers check import.meta.env.DEV first.
// Resolves to the path it wrote.
export async function saveView(file: string, view: StartView): Promise<string> {
  const res = await fetch('/__save-view', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ file, view }),
  })
  const body = (await res.json().catch(() => ({}))) as { path?: string; error?: string }
  if (!res.ok || !body.path) throw new Error(body.error ?? `the dev server answered ${res.status}`)
  return body.path
}
