# models-src

Raw Mineways exports live here. Everything in this folder except this file is gitignored:
models never go in the repo.

## Layout

```
models-src/
  <minecraft-username>/        the username from players.json (case doesn't matter; players.json wins)
    player.json                optional: { "displayName": "Jens" }
    <build-name>/              one folder per build; the name becomes the URL (harbour-lighthouse)
      anything.obj             exactly one .obj per folder
      anything.mtl
      *.png                    whatever textures the .mtl points at
      build.json               optional: { "title": "...", "description": "...", "builtOn": "2026-08-01",
                                           "builders": ["mason31", "jw01"],
                                           "view": { "azimuth": 80, "elevation": 24, "zoom": 1.2 },
                                           "featured": true }
```

Then run `npm run convert`. Only builds whose files changed are converted again, and any build
without a `build.json` gets an empty one (`{}`) to fill in. An existing one is never touched.

## Order on a player's page

A build with `"featured": true` comes first and gets the full-width slot. The rest follow
newest first by `builtOn`, then undated ones alphabetically by title. Keep `featured` on one
build per player; convert warns if a player ends up with two. A featured shared build is
featured on every builder's page.

## Choosing where the camera starts

Run the site with `npm run dev`, open the build full screen and press `C` (or add `?camera`
to its URL). A panel shows the current camera as a `"view"` line that updates as you turn,
zoom and pan. When it looks right, press **Save to build.json**: the view is written into
that build's `build.json` (everything else in it is kept) and takes effect straight away,
no convert needed. The card and the viewer both start from it, and Reset view goes back to
it. Saving works from any builder's page of a shared build.

The Save button only exists under `npm run dev`; a built site has no server to write with,
so there the panel offers Copy instead, to paste into `build.json` by hand.

`azimuth` and `elevation` are degrees, `zoom` is relative to the distance at which the build
just fits (so the view holds on phones too), and `target` only appears if you panned away
from the centre.

## Builds with more than one builder

Keep the files once, under any one of the builders, and list the others in `build.json` as
`"builders"`. Never copy the files. The build shows on every builder's page crediting the
others, counts towards each of their totals, and is still one model that downloads once.
Which folder holds it is housekeeping only and does not show on the site. Builders must be
in `players.json`; convert warns about a name that isn't, or about a builder who already has
their own build with the same folder name.

## Exporting from Mineways

Select the build, then **File > Export for Rendering**, file type **Wavefront OBJ**. Save
straight into the build's folder; from Windows the repo is at
`\\wsl.localhost\Ubuntu\home\<you>\...\build-showcase\models-src\<username>\<build-name>\`.

Settings in the Export dialog, by its own labels:

| Setting                                                                                        | Value                | Why                                                                                           |
| ---------------------------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| Export all textures to three large, mosaic images                                              | **selected**         | one shared texture lets the whole build collapse into very few draw calls                     |
| Texture output: RGB / A / RGBA                                                                 | all checked          | the `.mtl` points at all three                                                                |
| Create files themselves                                                                        | checked (no ZIP)     | the pipeline reads the loose files                                                            |
| Export separate types                                                                          | checked              | one material per block type; names like `Water` or `Stained_Glass` decide what is translucent |
| Export individual blocks                                                                       | **unchecked**        | one object per block makes enormous files                                                     |
| Make Z the up direction instead of Y                                                           | **unchecked**        | three.js is Y up                                                                              |
| Make each block `1000` mm high, model's units `Meters`                                         | as shown             | 1 block = 1 unit, which is how the site reads a build's size in blocks                        |
| Create block faces at the borders                                                              | checked              | closes the cut sides and bottom of the selection, since builds are viewed from every angle    |
| Double all billboard faces                                                                     | **checked**          | flowers, grass and crops are single quads and would vanish when seen from behind              |
| Use biome in center of export area                                                             | checked              | grass, leaves and water get the colours of where the build actually is                        |
| Export lesser, detailed blocks                                                                 | checked              | stairs, slabs, fences, doors                                                                  |
| Center model around the origin                                                                 | checked              | harmless, keeps coordinates small                                                             |
| Tree leaves solid                                                                              | unchecked            | cutout leaves look right; check it only if a tree-heavy build is too slow on phones           |
| Fill air bubbles, Connect parts, Delete floating objects, Hollow out, Melt snow, Fatten, Debug | all unchecked        | 3D-printing features; they alter the build                                                    |
| Everything else                                                                                | leave at its default |                                                                                               |

For the selection box, set **Height Y min** a few blocks below the lowest part of the build
so it sits on a slab of ground instead of being sliced at floor level. A high Y max costs
nothing, air exports as nothing.

**Large builds:** the alternative is _Export individual textures_ plus _Simplify mesh_, which
merges flat runs of faces and can cut the triangle count several times over, at the cost of
one draw call per block type. It should convert, but it is untested here; try it if a big
build turns out too heavy.

## What is verified

Real Mineways 13.01 exports with the settings above convert and render correctly, the
largest so far being 2.4 million triangles (a 190 MB intermediate, a 28 MB GLB, a few
seconds to convert, 5 draw calls). Cutout leaves, stained glass and the block-size readout
all match. Not yet checked on a real phone: the site rests between expensive frames so a
slow device stays scrollable, but how smooth the largest builds feel there is unknown.

If something does look wrong, the two places to look are `TRANSLUCENT` in
`scripts/lib/optimize.ts` (which materials blend rather than cut out) and `toBlockMaterial`
in `src/three/prepareModel.ts` (texture filtering).
