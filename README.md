# build-showcase

A web app for showing off Minecraft builds as interactive 3D models, grouped by the player
who built them.

- **Home** is a lineup of every player as a live 3D figure in their own skin. Click one.
- **A player's page** shows each of their builds as a slowly turning 3D card.
- **Any build opens full screen** to spin, zoom and pan, and has its own shareable link.

It is a static site: no backend, no accounts. Models come from
[Mineways](https://www.realtimerendering.com/erich/minecraft/public/mineways/) and are
converted locally; **model files are never committed**.

## Quick start

Needs Node 22.18 or newer.

```sh
npm install
npm run convert    # models-src/ -> public/builds/*.glb, skins and manifest
npm run dev
```

## Adding a build

1. Export it from Mineways as OBJ into `models-src/<minecraft-username>/<build-name>/`
   (settings in [models-src/README.md](models-src/README.md)).
2. Optionally add a `build.json` with `title`, `description`, `builtOn`, and `builders` (the
   other players who worked on it; the build then appears on all of their pages).
3. `npm run convert`.

## Adding a player

Add their exact Minecraft username to `players.json` and run `npm run convert`. They appear
in the lineup straight away, with "No builds yet" until they have one. Their skin is
downloaded from Mojang; a name Mojang doesn't know gets a plain placeholder skin and a
warning, and is looked up again on every convert. (A username folder under `models-src/`
also counts as a player, but only `players.json` is committed.)

## Commands

| Command            | What it does                                                                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`      | dev server                                                                                                                                                                                    |
| `npm run build`    | type-check and build to `dist/`                                                                                                                                                               |
| `npm run convert`  | convert exports to GLB, fetch skins, write the manifest                                                                                                                                       |
| `npm run check`    | lint, type-check and unit tests                                                                                                                                                               |
| `npm run test:e2e` | Playwright tests on desktop and phone viewports, against a sandboxed sample site in `.e2e/` so your real players and builds are never touched (first time: `npx playwright install chromium`) |
| `npm run format`   | Prettier                                                                                                                                                                                      |

## Deploying

Not set up yet. Because the models are gitignored, the site has to be built on a machine
that has them: run `npm run convert && npm run build`, then upload `dist/` to any static
host. Set `BASE_PATH=/sub/path/` when building if it won't live at the domain root.

See [AGENT_GUIDE.md](AGENT_GUIDE.md) for how the code is organised.
