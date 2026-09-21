// Test fixture: writes Mineways-style exports for two made-up-content players (Notch, jeb_)
// into SOURCES_DIR. Only the e2e sandbox runs it (see playwright.config.ts); there is on
// purpose no npm script, so sample players can never land on the real site.
import { access, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SOURCES_DIR } from '../lib/paths.ts'
import { drawAtlas } from './atlas.ts'
import { SAMPLE_BUILDS } from './builds.ts'
import { voxelsToObj } from './voxel-obj.ts'

const ROOT = SOURCES_DIR
// marks folders this script owns, so it never overwrites a real export
const MARKER = '.sample'

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  )
}

const atlas = drawAtlas()

for (const sample of SAMPLE_BUILDS) {
  const dir = join(ROOT, sample.username, sample.folder)
  if ((await exists(dir)) && !(await exists(join(dir, MARKER)))) {
    console.warn(`skipped ${dir}: folder exists and was not made by this script`)
    continue
  }

  const name = sample.folder
  const { obj, mtl, faceCount } = voxelsToObj(sample.build(), name)
  const { title, description, builtOn, builders, view } = sample

  await mkdir(dir, { recursive: true })
  await Promise.all([
    writeFile(join(dir, MARKER), ''),
    writeFile(join(dir, `${name}.obj`), obj),
    writeFile(join(dir, `${name}.mtl`), mtl),
    writeFile(join(dir, `${name}-RGBA.png`), atlas.rgba),
    writeFile(join(dir, `${name}-RGB.png`), atlas.rgb),
    writeFile(join(dir, `${name}-Alpha.png`), atlas.alpha),
    writeFile(
      join(dir, 'build.json'),
      JSON.stringify({ title, description, builtOn, builders, view }, null, 2),
    ),
  ])
  console.log(`wrote ${dir} (${faceCount} faces)`)
}
