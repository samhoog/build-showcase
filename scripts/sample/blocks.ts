// Block palette for the sample builds. Tile names index into the atlas (see atlas.ts).
export type Block = {
  name: string
  top: string
  side: string
  bottom: string
  // see-through blocks never hide their neighbours' faces
  transparent?: boolean
}

function block(name: string, side: string, top = side, bottom = top, transparent = false): Block {
  return { name, top, side, bottom, transparent }
}

export const BLOCKS = {
  grass: block('Grass_Block', 'grass_side', 'grass_top', 'dirt'),
  dirt: block('Dirt', 'dirt'),
  stone: block('Stone', 'stone'),
  cobble: block('Cobblestone', 'cobble'),
  planks: block('Oak_Planks', 'planks'),
  log: block('Oak_Log', 'log_side', 'log_top'),
  roof: block('Dark_Oak_Planks', 'roof'),
  sand: block('Sand', 'sand'),
  lantern: block('Glowstone', 'lantern'),
  leaves: block('Oak_Leaves', 'leaves', 'leaves', 'leaves', true),
  glass: block('Glass', 'glass', 'glass', 'glass', true),
  water: block('Water', 'water', 'water', 'water', true),
} satisfies Record<string, Block>

export type BlockId = keyof typeof BLOCKS
