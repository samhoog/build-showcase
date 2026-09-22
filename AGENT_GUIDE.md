# build-showcase - Agent Reference Guide

A file index and pattern reference for AI agents working in this repository. For the layout,
commands and code style see `CLAUDE.md`; this guide covers what is not there.

This file is the convention source for the `implement-issue` skill (from the `crosscut-tools`
Claude Code plugin). Keep it accurate.

## Core Architectural Patterns

### One WebGL context: Stage and Viewport

Browsers cap live WebGL contexts (8-16, fewer on phones). **Nothing in this repo may create
its own `WebGLRenderer`.** Every 3D view is a `Viewport`: a normal `<canvas>` with a 2D
context, plus a scene and camera. The `Stage` singleton renders a viewport's scene with its
one offscreen renderer and `drawImage`s the result into the viewport's canvas.

```ts
// inside a component
useViewport(
  canvasRef,
  maxDpr,
  (viewport) => {
    // viewport.scene / viewport.camera: fill them
    // viewport.onFrame = (dt) => boolean   return true to be drawn again next frame
    // viewport.onResize = (aspect) => void
    // viewport.invalidate()                ask for a single redraw
    return () => {
      /* dispose what you created */
    }
  },
  deps,
)
```

- Rendering is on demand. A viewport is drawn when it is on screen and either `onFrame`
  returned true or it was invalidated. When nothing moves, the loop stops.
- `Stage.setExclusive(viewport)` pauses everything else (used by the fullscreen viewer).
- The render and the `drawImage` happen in the same task. Do not make them async: the
  drawing buffer is not preserved.
- Canvases are transparent; backgrounds (the sky gradient) are CSS on the parent.
- `e2e/showcase.spec.ts` asserts a whole visit creates exactly one WebGL context.

### React stays out of the frame loop

`src/three/` has no React. Components create a controller (`BuildView`, `PlayerFigure`)
inside `useViewport` and talk to it through refs. Per-frame values are never React state.

### Models are held through the cache

`acquireBuild(url)` / `releaseBuild(url)` in `src/three/buildCache.ts` are ref-counted over an
LRU. Always pair them. Put `model.object.clone()` in your scene, never the original: clones
share geometry and materials, so a card and the viewer can show one build at once. Only the
cache disposes GPU resources.

### Data flows one way

`players.json` (committed roster) + `models-src/` -> `npm run convert` -> `public/builds/manifest.json` + GLBs + skins -> the
site fetches the manifest once (`useManifest`). The site never talks to a third party at
runtime; skins are downloaded from Mojang at convert time.

## Module / File Reference

### Pipeline (`scripts/`)

| File                    | Purpose                                                                                                                                                                                     | Key exports                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `convert.ts`            | entry point for `npm run convert`; incremental, never fails on one bad build; adds an empty `build.json` where one is missing; removes models and skins of builds and players that are gone | -                                             |
| `save-view-endpoint.ts` | Vite plugin, `apply: 'serve'`: `POST /__save-view` for the camera readout's Save button. Dev server only                                                                                    | `saveViewEndpoint`                            |
| `lib/paths.ts`          | `SOURCES_DIR`, `PUBLIC_DIR`, `ROSTER_FILE`, overridable by env so e2e can sandbox itself                                                                                                    | -                                             |
| `lib/roster.ts`         | reads `players.json`                                                                                                                                                                        | `readRoster`                                  |
| `lib/scan.ts`           | merges the roster with `models-src/<username>/<build>/*.obj` folders, reads `build.json` / `player.json`; dates a build by its model files only                                             | `scanSources`                                 |
| `lib/slug.ts`           | username validation, folder name -> slug / title                                                                                                                                            | `isValidUsername`, `toSlug`, `titleFromSlug`  |
| `lib/obj-header.ts`     | a build's size in blocks, from Mineways' OBJ header (measuring the mesh is off by one)                                                                                                      | `readBlockDimensions`                         |
| `lib/obj-to-glb.ts`     | OBJ + MTL + PNG -> GLB via obj2gltf                                                                                                                                                         | `objToGlb`                                    |
| `lib/optimize.ts`       | alpha modes, dedup/join/weld, meshopt; reports triangles and measured size                                                                                                                  | `optimizeGlb`, `GlbStats`                     |
| `lib/skins.ts`          | username -> skin PNG from Mojang; real skins cached a week, 429s retried, fallbacks retried every run and never written over a real skin                                                    | `ensureSkin`, `fetchSkin`                     |
| `lib/manifest.ts`       | read the previous manifest, list shared builds under every builder, sort                                                                                                                    | `readManifest`, `shareBuilds`, `sortManifest` |
| `lib/save-view.ts`      | writes a `view` into a build's `build.json` and the manifest; finds the folder by scanning, never from request input                                                                        | `saveView`, `SaveViewError`                   |
| `sample/*`              | e2e fixture only: procedural voxel builds in Mineways' OBJ layout                                                                                                                           | `VoxelGrid`, `voxelsToObj`, `drawAtlas`       |

### Shared (`shared/`)

| File          | Purpose                                                             | Key exports                                                               |
| ------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `manifest.ts` | manifest types for pipeline and site, view validation, view updates | `Manifest`, `Player`, `Build`, `StartView`, `isStartView`, `setBuildView` |

### Site (`src/`)

| File                                       | Purpose                                                                                                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stage/Stage.ts`                           | `Stage` singleton and `Viewport`; rests after expensive frames                                                                                        |
| `stage/frameDelta.ts`                      | frame deltas from rAF timestamps, and how long to rest after a frame                                                                                  |
| `stage/useViewport.ts`                     | React hook that registers a canvas with the Stage                                                                                                     |
| `three/buildView.ts`                       | `BuildView`: lights, OrbitControls, keyboard nudge, start view, reset, `describeView`, `settle`. No auto-rotate: nothing moves until someone moves it |
| `three/framing.ts`                         | `Bounds` (upright cylinder), `fitDistance`, `frameBounds`, `viewDirection` / `viewAngles` (degrees)                                                   |
| `three/prepareModel.ts`                    | GLTF scene -> Lambert materials with nearest-neighbour textures, bounds, dispose                                                                      |
| `three/buildCache.ts`, `three/lruCache.ts` | lazy GLB loading, ref-counted LRU                                                                                                                     |
| `three/playerFigure.ts`                    | skinview3d `PlayerObject` with idle, look-at and wave animation                                                                                       |
| `pointer.ts`                               | shared mouse position and the reduced-motion query                                                                                                    |
| `data/manifest.ts`                         | `useManifest`, `assetUrl`, `findPlayer`, `findBuild`, `coBuilders`, `countBuilds`, `formatSize`                                                       |
| `data/saveView.ts`                         | posts a view to the dev server's `/__save-view`; callers check `import.meta.env.DEV`                                                                  |
| `components/PlayerLineup.tsx`              | home page lineup; each figure is a real link                                                                                                          |
| `components/Nametag.tsx`                   | in-game style username; shrinks to fit, never truncates                                                                                               |
| `components/BuildCard.tsx`                 | live card with the Open badge; loads when near the viewport, releases when far                                                                        |
| `components/BuildViewer.tsx`               | fullscreen modal `<dialog>`, driven by the route; camera readout (`C` / `?camera`) with Copy, and Save under `npm run dev`                            |
| `components/BuiltWith.tsx`                 | "Built with …" credit line for shared builds                                                                                                          |
| `pages/ManifestGate.tsx`                   | loading / empty / error states for every page                                                                                                         |

## Data Model

`shared/manifest.ts` is the single definition. `file` and `skin` are site-root-relative and
must go through `assetUrl()` (it applies `BASE_PATH` and the cache-busting `hash`).
A shared build is one file listed under each of its `builders` (`shareBuilds` in
`scripts/lib/manifest.ts`), so count builds with `countBuilds()` (unique files), never by
summing players' lists, and treat every builder the same: there is no visible "owner".
`size` is whole blocks `[x, y, z]`, valid because Mineways exports one unit per block.

## Testing Patterns

- **Unit (vitest):** pure logic only, next to the source. Canonical example:
  `src/three/framing.test.ts`. Pipeline tests build real temp folders rather than mocking
  `fs` (`scripts/lib/scan.test.ts`); `scripts/lib/optimize.test.ts` runs a real conversion.
- **E2E (Playwright):** `e2e/showcase.spec.ts`, projects `desktop` and `phone` (Pixel 7),
  against a production build with sample data. The whole thing is sandboxed in `.e2e/` via
  `SOURCES_DIR` / `PUBLIC_DIR` / `OUT_DIR` / `ROSTER_FILE` (see `playwright.config.ts`), so the
  tests know exactly two players (Notch, jeb_) and never touch the real site. Keep it that way. Headless WebGL runs on SwiftShader (launch
  args in `playwright.config.ts`).
- Compare 3D output with `pixelsOf(canvas)` (the canvas's own pixels), not
  `locator.screenshot()`, which also captures captions and focus rings laid over the canvas.
- Assert "something rendered" with `expectDrawn`, never exact images.

## Common Patterns

- **Adding a 3D view:** controller class in `src/three/`, component that calls
  `useViewport`, CSS sets the canvas size. Decorative canvases get `aria-hidden`; the text
  around them carries the meaning.
- **Touch:** inline views must not steal scrolling (`touch-action: pan-y`, controls ignore
  touch). Only the fullscreen viewer takes over touch.
- **Motion:** builds never move on their own (a slow automatic turn reads as lag on big
  builds); the "Open" badge on a card is what signals interactivity. Player figures idle,
  and `reducedMotion.matches` must stop that.
- **States:** every fetch has loading, empty and error UI with a specific message and a
  "Try again" where retrying can help.

## External Services & Integrations

- Mojang API, convert time only: `api.mojang.com/users/profiles/minecraft/<name>` then
  `sessionserver.mojang.com/session/minecraft/profile/<uuid>`. Failure falls back to a flat
  skin and never fails the convert.

## Gotchas & Edge Cases

- `skinview3d` pins `three@^0.156`. `package.json` `overrides` forces it (and `@types/three`)
  onto our version. We only use its `PlayerObject`; never use its `SkinViewer` (own context).
- `PlayerObject` stands with feet at y = -16 and head top at y = 16, in skin pixels.
- `OrbitControls` sets `touch-action: none` on its element; `BuildView` puts `pan-y` back
  for cards, and gates touch with a `pointerdown` listener registered before the controls.
- The Stage rests after expensive frames (`restUntil()`): real builds run to millions of
  triangles, and drawing must never starve scrolling or taps. Animation still advances every
  frame; only drawing is skipped. Don't add render loops that bypass it.
- Frame deltas come from `frameDelta()` using consecutive rAF timestamps only. Mixing in
  `performance.now()` drops render time from the delta; on fast displays it went negative and
  every eased animation ran away (figures spinning wildly after a page change).
- A build's starting camera is `StartView` (angles + zoom relative to the fitted distance,
  never raw coordinates, so it holds across aspect ratios). `BuildView.describeView()` is
  the inverse of `resetView()`; the viewer's `C` / `?camera` readout prints it, and under
  `npm run dev` its Save button writes it through `/__save-view`. Anything that writes to
  disk must stay dev-only: `apply: 'serve'` on the server side and `import.meta.env.DEV`
  around the UI, so it is compiled out of the built site (the e2e suite checks the built
  site has no Save button). `isStartView` (shared/manifest.ts) validates every view, from
  a request or from a hand-edited build.json.
- Saving calls `BuildView.settle()` first: after a drag the camera is still gliding
  (damping), and the view to save is where it comes to rest.
- Usernames are identity: never truncate one. `Nametag` shrinks long names to fit instead.
- Never resize or lossy-compress textures in the pipeline: it is pixel art.
- Writing colours into a `Uint8Array` wraps above 255; clamp first (bit the sample atlas).
- Sample players (Notch, jeb_) are an e2e fixture only. There is deliberately no npm script
  for `scripts/sample/generate.ts`; never write samples into the real `models-src/`.
- Verified against real Mineways 13 exports up to 2.4M triangles: hundreds of materials
  collapse to 2-5 draw calls, conversion takes seconds. See `models-src/README.md`.
- `gh` installed as a snap cannot read `/tmp`; pipe bodies in on stdin (`--body-file -`).
- vitest only includes `src/` and `scripts/`; `e2e/*.spec.ts` belongs to Playwright.

## Verification Commands

```sh
npm run format
npm run check       # lint + type-check + unit tests
npm run test:e2e    # desktop + phone, builds the site with sample data first
```
