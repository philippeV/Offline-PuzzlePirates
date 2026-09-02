import type { CommodityId } from './commodities.ts';

export type IslandSize = 'outpost' | 'medium' | 'large';

export type IslandId =
  | 'alkaid'
  | 'doyle'
  | 'edgars-choice'
  | 'isle-of-keris'
  | 'marlowe'
  | 'mcguffins-isle'
  | 'sayers-rock';

export interface Island {
  id: IslandId;
  name: string;
  size: IslandSize;
  isCapital: boolean;
  isColonized: boolean;
  spawnCommodities: CommodityId[];
}

const declaredIslands: Record<IslandId, Island> = {
  'alkaid': { id: 'alkaid', name: 'Alkaid Island', size: 'large', isCapital: true, isColonized: true, spawnCommodities: ['sincosite', 'sugar-cane'] },
  'doyle': { id: 'doyle', name: 'Doyle Island', size: 'medium', isCapital: false, isColonized: true, spawnCommodities: ['hemp', 'stone'] },
  'edgars-choice': { id: 'edgars-choice', name: "Edgar's Choice", size: 'large', isCapital: false, isColonized: false, spawnCommodities: ['sugar-cane', 'wood'] },
  'isle-of-keris': { id: 'isle-of-keris', name: 'Isle of Keris', size: 'large', isCapital: false, isColonized: false, spawnCommodities: ['iron', 'lily-of-the-valley', 'wood'] },
  'marlowe': { id: 'marlowe', name: 'Marlowe Island', size: 'outpost', isCapital: false, isColonized: true, spawnCommodities: ['chalcocite'] },
  'mcguffins-isle': { id: 'mcguffins-isle', name: "McGuffin's Isle", size: 'outpost', isCapital: false, isColonized: false, spawnCommodities: ['butterfly-weed', 'pokeweed-berries'] },
  'sayers-rock': { id: 'sayers-rock', name: 'Sayers Rock', size: 'large', isCapital: false, isColonized: true, spawnCommodities: ['iris-root', 'iron', 'stone'] },
};

export const ISLANDS: Record<IslandId, Island> = Object.assign(
  Object.create(null),
  declaredIslands,
);

export const ISLAND_IDS = Object.keys(ISLANDS) as IslandId[];

export function islandOf(id: IslandId): Island {
  const island = ISLANDS[id];
  if (island === undefined) throw new RangeError(`no island named "${id}"`);
  return island;
}
