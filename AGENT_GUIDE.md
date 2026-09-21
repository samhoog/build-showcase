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

`models-src/` -> `npm run convert` -> `public/builds/manifest.json` + GLBs + skins -> the
site fetches the manifest once (`useManifest`). The site never talks to a third party at
runtime; skins are downloaded from Mojang at convert time.

## Module / File Reference

### Pipeline (`scripts/`)

| File                | Purpose                                                                         | Key exports                                  |
| ------------------- | ------------------------------------------------------------------------------- | -------------------------------------------- |
| `convert.ts`        | entry point for `npm run convert`; incremental, never fails on one bad build    | -                                            |
| `lib/scan.ts`       | finds `models-src/<username>/<build>/*.obj`, reads `build.json` / `player.json` | `scanSources`                                |
| `lib/slug.ts`       | username validation, folder name -> slug / title                                | `isValidUsername`, `toSlug`, `titleFromSlug` |
| `lib/obj-to-glb.ts` | OBJ + MTL + PNG -> GLB via obj2gltf                                             | `objToGlb`                                   |
| `lib/optimize.ts`   | alpha modes, dedup/join/weld, meshopt; reports triangles and size in blocks     | `optimizeGlb`, `GlbStats`                    |
| `lib/skins.ts`      | username -> skin PNG from Mojang, cached a week, flat fallback                  | `ensureSkin`, `fetchSkin`                    |
| `lib/manifest.ts`   | read previous manifest, sort players and builds                                 | `readManifest`, `sortManifest`               |
| `sample/*`          | procedural voxel builds written in Mineways' OBJ layout                         | `VoxelGrid`, `voxelsToObj`, `drawAtlas`      |

### Site (`src/`)

| File                                       | Purpose                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `stage/Stage.ts`                           | `Stage` singleton and `Viewport`                                                 |
| `stage/useViewport.ts`                     | React hook that registers a canvas with the Stage                                |
| `three/buildView.ts`                       | `BuildView`: lights, OrbitControls, auto-rotate, keyboard nudge, reset           |
| `three/framing.ts`                         | `Bounds` (upright cylinder), `fitDistance`, `frameBounds`                        |
| `three/prepareModel.ts`                    | GLTF scene -> Lambert materials with nearest-neighbour textures, bounds, dispose |
| `three/buildCache.ts`, `three/lruCache.ts` | lazy GLB loading, ref-counted LRU                                                |
| `three/playerFigure.ts`                    | skinview3d `PlayerObject` with idle, look-at and wave animation                  |
| `pointer.ts`                               | shared mouse position and the reduced-motion query                               |
| `data/manifest.ts`                         | `useManifest`, `assetUrl`, `findPlayer`, `findBuild`, `formatSize`               |
| `components/PlayerLineup.tsx`              | home page lineup; each figure is a real link                                     |
| `components/BuildCard.tsx`                 | live card; loads when near the viewport, releases when far                       |
| `components/BuildViewer.tsx`               | fullscreen modal `<dialog>`, driven by the route                                 |
| `pages/ManifestGate.tsx`                   | loading / empty / error states for every page                                    |

## Data Model

`shared/manifest.ts` is the single definition. `file` and `skin` are site-root-relative and
must go through `assetUrl()` (it applies `BASE_PATH` and the cache-busting `hash`).
`size` is whole blocks `[x, y, z]`, valid because Mineways exports one unit per block.

## Testing Patterns

- **Unit (vitest):** pure logic only, next to the source. Canonical example:
  `src/three/framing.test.ts`. Pipeline tests build real temp folders rather than mocking
  `fs` (`scripts/lib/scan.test.ts`); `scripts/lib/optimize.test.ts` runs a real conversion.
- **E2E (Playwright):** `e2e/showcase.spec.ts`, projects `desktop` and `phone` (Pixel 7),
  against the production build with sample data. Headless WebGL runs on SwiftShader (launch
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
- **Motion:** only the 3D moves, and `reducedMotion.matches` must stop anything automatic.
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
- Never resize or lossy-compress textures in the pipeline: it is pixel art.
- Writing colours into a `Uint8Array` wraps above 255; clamp first (bit the sample atlas).
- The pipeline is verified against generated samples only, not yet a real Mineways export.
  See `models-src/README.md` for where to tune.
- `gh` installed as a snap cannot read `/tmp`; pipe bodies in on stdin (`--body-file -`).
- vitest only includes `src/` and `scripts/`; `e2e/*.spec.ts` belongs to Playwright.

## Verification Commands

```sh
npm run format
npm run check       # lint + type-check + unit tests
npm run test:e2e    # desktop + phone, builds the site with sample data first
```
