# build-showcase

Static web app that shows Minecraft builds as interactive 3D models, grouped by player.
Vite + React + TypeScript + three.js. No backend. See `AGENT_GUIDE.md` for patterns, the file
reference and gotchas; read it before changing anything under `src/stage` or `src/three`.

## Layout

- `scripts/` Node pipeline (TypeScript run natively by Node >= 22.18, so erasable syntax only
  and `.ts` import extensions). `convert.ts` turns Mineways OBJ exports into GLBs + manifest;
  `sample/` generates stand-in exports, as a fixture for the e2e sandbox only.
- `shared/manifest.ts` the manifest types, imported by both the pipeline and the site.
- `src/` the site. `stage/` shared WebGL renderer, `three/` scene code with no React,
  `components/` and `pages/` React, `data/` manifest loading, `styles/` tokens and base CSS.
- `e2e/` Playwright tests. Unit tests sit next to their source as `*.test.ts`.
- `models-src/`, `public/builds/`, `public/skins/` are gitignored. Never commit model files.

## Commands

- `npm run check` lint (oxlint) + type-check + unit tests (vitest). Run before every commit.
- `npm run test:e2e` Playwright, desktop and phone. Builds the site with sample data itself.
- `npm run format` Prettier. `npm run convert` builds local content from `models-src/`.

## Style

- Prettier: no semicolons, single quotes, 100 columns.
- Comments are short, lower-case-led, and say why, not what.
- CSS modules per component; colours, type and spacing only from `src/styles/tokens.css`.
- Commits: one small change each, short one-line lower-case message, pushed as you go.
- UI copy: plain, sentence case, says what happened and what to do next.
