// npm run sample: writes Mineways-style exports into models-src/ so a fresh clone has
// something to convert and show. Real models are never committed.
import { access, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { drawAtlas } from './atlas.ts'
import { SAMPLE_BUILDS } from './builds.ts'
import { voxelsToObj } from './voxel-obj.ts'

const ROOT = 'models-src'
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
  const { title, description, builtOn } = sample

  await mkdir(dir, { recursive: true })
  await Promise.all([
    writeFile(join(dir, MARKER), ''),
    writeFile(join(dir, `${name}.obj`), obj),
    writeFile(join(dir, `${name}.mtl`), mtl),
    writeFile(join(dir, `${name}-RGBA.png`), atlas.rgba),
    writeFile(join(dir, `${name}-RGB.png`), atlas.rgb),
    writeFile(join(dir, `${name}-Alpha.png`), atlas.alpha),
    writeFile(join(dir, 'build.json'), JSON.stringify({ title, description, builtOn }, null, 2)),
  ])
  console.log(`wrote ${dir} (${faceCount} faces)`)
}
