# models-src

Raw Mineways exports live here. Everything in this folder except this file is gitignored:
models never go in the repo.

## Layout

```
models-src/
  <minecraft-username>/        folder name must be the exact username (it is used to fetch the skin)
    player.json                optional: { "displayName": "Jens" }
    <build-name>/              one folder per build; the name becomes the URL (harbour-lighthouse)
      anything.obj             exactly one .obj per folder
      anything.mtl
      *.png                    whatever textures the .mtl points at
      build.json               optional: { "title": "...", "description": "...", "builtOn": "2026-08-01" }
```

Then run `npm run convert`. Only builds whose files changed are converted again.

## Exporting from Mineways

Select the build, then **File > Export for Rendering** and choose **Wavefront OBJ**. The
pipeline expects:

| Setting      | Value                                                                                        | Why                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Textures     | full colour texture patterns, exported as the three large images (`-RGB`, `-RGBA`, `-Alpha`) | one shared texture lets the whole build collapse into very few draw calls            |
| Up direction | Y up (leave "make Z the up direction" off)                                                   | matches three.js                                                                     |
| Scale        | 1 block = 1 unit (the default 1000 mm per block, in metres)                                  | the site reads a build's size in blocks straight off the model                       |
| Materials    | one per block type (the default)                                                             | material names such as `Water` or `Stained_Glass` decide what renders as translucent |

Option labels move around between Mineways versions; the values above are what matter.
Separate per-tile textures also convert, they just produce more draw calls.

## What is and isn't verified

The pipeline is tested against the generated sample exports (`npm run sample`), which copy
Mineways' layout: Y up, one unit per block, a material per block type, and the RGB / RGBA /
Alpha texture trio. It has not yet been run against a real Mineways export. If the first one
looks wrong, the two places to look are `TRANSLUCENT` in `scripts/lib/optimize.ts` (which
materials blend rather than cut out) and `toBlockMaterial` in `src/three/prepareModel.ts`
(texture filtering).
