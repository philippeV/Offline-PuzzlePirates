import { Container, Graphics, type Renderer, type Texture } from 'pixi.js';

import { TILE_HEIGHT, TILE_WIDTH } from './projection.ts';

export type TileArt = 'sand' | 'grass' | 'water' | 'deck' | 'plank' | 'portal' | 'dock' | 'jetty';

export type PropArt =
  | 'palm'
  | 'hut'
  | 'market'
  | 'crate'
  | 'mast'
  | 'wheel'
  | 'cannon'
  | 'pump'
  | 'station'
  | 'sloop'
  | 'avatar'
  | 'crew';

export type ArtName = TileArt | PropArt;

export interface Atlas {
  texture(name: ArtName): Texture;
  destroy(): void;
}

interface Palette {
  fill: number;
  stroke: number;
}

const TILE_PALETTES: Record<TileArt, Palette> = {
  sand: { fill: 0xd8c48c, stroke: 0xb9a271 },
  grass: { fill: 0x6f9e58, stroke: 0x5a8146 },
  water: { fill: 0x2f6f9f, stroke: 0x27587c },
  deck: { fill: 0xa97f4f, stroke: 0x8a6740 },
  plank: { fill: 0xc09660, stroke: 0x9b7748 },
  portal: { fill: 0xe0c23a, stroke: 0xb69a24 },
  dock: { fill: 0x8f7048, stroke: 0x6f5636 },
  jetty: { fill: 0x7a5c3a, stroke: 0x5e462b },
};

const PROP_PALETTES: Record<PropArt, Palette> = {
  palm: { fill: 0x2f7d4f, stroke: 0x1f5636 },
  hut: { fill: 0xb35c3a, stroke: 0x7f3f28 },
  market: { fill: 0xd8b04a, stroke: 0x9c7c2c },
  crate: { fill: 0x9c7340, stroke: 0x6f512c },
  mast: { fill: 0x8a6740, stroke: 0x5f4729 },
  wheel: { fill: 0xcfa96a, stroke: 0x8d7040 },
  cannon: { fill: 0x4a4a52, stroke: 0x2c2c31 },
  pump: { fill: 0x53788f, stroke: 0x35505f },
  station: { fill: 0xe6e2d4, stroke: 0x9c9787 },
  sloop: { fill: 0x8a5a34, stroke: 0x54341c },
  avatar: { fill: 0xe8dcc0, stroke: 0x2a2118 },
  crew: { fill: 0xa8b6c4, stroke: 0x515f6b },
};

const PROP_HEIGHTS: Record<PropArt, number> = {
  palm: 56,
  hut: 44,
  market: 48,
  crate: 22,
  mast: 60,
  wheel: 26,
  cannon: 20,
  pump: 26,
  station: 18,
  sloop: 72,
  avatar: 34,
  crew: 30,
};

const NARROW_PROP_WIDTH = TILE_WIDTH / 2;
const BROAD_PROP_WIDTH = TILE_WIDTH;

const PROP_WIDTHS: Record<PropArt, number> = {
  palm: NARROW_PROP_WIDTH,
  hut: NARROW_PROP_WIDTH,
  market: BROAD_PROP_WIDTH,
  crate: NARROW_PROP_WIDTH,
  mast: NARROW_PROP_WIDTH,
  wheel: NARROW_PROP_WIDTH,
  cannon: NARROW_PROP_WIDTH,
  pump: NARROW_PROP_WIDTH,
  station: NARROW_PROP_WIDTH,
  sloop: BROAD_PROP_WIDTH,
  avatar: NARROW_PROP_WIDTH,
  crew: NARROW_PROP_WIDTH,
};

const TRUNK_COLOUR = 0x6b4a2a;
const SAILCLOTH_COLOUR = 0xf0ead6;

export function createAtlas(renderer: Renderer): Atlas {
  const textures = new Map<ArtName, Texture>();
  for (const name of Object.keys(TILE_PALETTES) as TileArt[]) {
    textures.set(name, renderer.generateTexture(tileShape(TILE_PALETTES[name])));
  }
  for (const name of Object.keys(PROP_PALETTES) as PropArt[]) {
    textures.set(name, renderer.generateTexture(propShape(name)));
  }
  return {
    texture(name: ArtName): Texture {
      const texture = textures.get(name);
      if (texture === undefined) throw new Error(`the atlas holds no art named "${name}"`);
      return texture;
    },
    destroy(): void {
      for (const texture of textures.values()) texture.destroy(true);
      textures.clear();
    },
  };
}

function tileShape(palette: Palette): Container {
  const half = { x: TILE_WIDTH / 2, y: TILE_HEIGHT / 2 };
  return new Graphics()
    .poly([half.x, 0, TILE_WIDTH, half.y, half.x, TILE_HEIGHT, 0, half.y])
    .fill({ color: palette.fill })
    .stroke({ width: 1, color: palette.stroke, alignment: 1 });
}

function propShape(name: PropArt): Container {
  const palette = PROP_PALETTES[name];
  const height = PROP_HEIGHTS[name];
  const width = PROP_WIDTHS[name];
  const shape = new Graphics();
  if (name === 'palm' || name === 'mast') {
    shape
      .rect(width / 2 - 3, height / 3, 6, (height * 2) / 3)
      .fill({ color: TRUNK_COLOUR })
      .circle(width / 2, height / 3, width / 2)
      .fill({ color: palette.fill })
      .stroke({ width: 2, color: palette.stroke });
    return shape;
  }
  if (name === 'sloop') {
    shape
      .poly([0, height / 2, width, height / 2, width - 8, height, 8, height])
      .fill({ color: palette.fill })
      .stroke({ width: 2, color: palette.stroke })
      .rect(width / 2 - 2, 0, 4, height / 2)
      .fill({ color: TRUNK_COLOUR })
      .poly([width / 2 + 3, 3, width - 6, height / 2 - 4, width / 2 + 3, height / 2 - 4])
      .fill({ color: SAILCLOTH_COLOUR })
      .stroke({ width: 1, color: palette.stroke });
    return shape;
  }
  if (name === 'avatar' || name === 'crew') {
    shape
      .rect(width / 2 - 5, height / 3, 10, (height * 2) / 3)
      .fill({ color: palette.fill })
      .stroke({ width: 2, color: palette.stroke })
      .circle(width / 2, height / 4, height / 5)
      .fill({ color: palette.fill })
      .stroke({ width: 2, color: palette.stroke });
    return shape;
  }
  shape
    .rect(2, height / 3, width - 4, (height * 2) / 3)
    .fill({ color: palette.fill })
    .stroke({ width: 2, color: palette.stroke })
    .poly([0, height / 3, width / 2, 0, width, height / 3])
    .fill({ color: palette.stroke });
  return shape;
}
