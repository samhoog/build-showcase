import { open } from 'node:fs/promises'

// Mineways states a build's size in whole blocks in the comments at the top of its OBJ:
//   # block dimensions: X=173 by Y=169 (height) by Z=296 blocks
// That is the authority. Measuring the mesh instead is off by one here and there, because
// slabs and fences underfill the edge blocks while torches and signs poke out past them.
const DIMENSIONS = /^# block dimensions: X=(\d+) by Y=(\d+) \(height\) by Z=(\d+) blocks/m

export function parseBlockDimensions(header: string): [number, number, number] | null {
  const match = DIMENSIONS.exec(header)
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}

// reads just the start of the file: these exports run to hundreds of megabytes
export async function readBlockDimensions(
  objPath: string,
): Promise<[number, number, number] | null> {
  const file = await open(objPath, 'r')
  try {
    const { buffer, bytesRead } = await file.read(Buffer.alloc(8192), 0, 8192, 0)
    return parseBlockDimensions(buffer.toString('utf8', 0, bytesRead))
  } finally {
    await file.close()
  }
}
