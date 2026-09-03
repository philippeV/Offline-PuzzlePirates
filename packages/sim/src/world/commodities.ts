import type { CannonSize } from '../ship/classes.ts';

export type CommodityClass = 'raw' | 'refined';

export type CommodityId =
  | 'hemp'
  | 'iron'
  | 'stone'
  | 'sugar-cane'
  | 'wood'
  | 'sincosite'
  | 'lily-of-the-valley'
  | 'chalcocite'
  | 'butterfly-weed'
  | 'pokeweed-berries'
  | 'iris-root'
  | 'small-cannon-ball'
  | 'medium-cannon-ball'
  | 'large-cannon-ball'
  | 'swill'
  | 'grog';

export interface Commodity {
  id: CommodityId;
  name: string;
  class: CommodityClass;
  massGramsPerUnit: number;
}

export const UNPUBLISHED_RAW_MASS_GRAMS_PER_UNIT = 1000;
export const RUM_MASS_GRAMS_PER_UNIT = 1000;
export const SMALL_CANNON_BALL_MASS_GRAMS_PER_UNIT = 7100;
export const MEDIUM_CANNON_BALL_MASS_GRAMS_PER_UNIT = 14200;
export const LARGE_CANNON_BALL_MASS_GRAMS_PER_UNIT = 21300;

const declaredCommodities: Record<CommodityId, Commodity> = {
  'hemp': { id: 'hemp', name: 'Hemp', class: 'raw', massGramsPerUnit: UNPUBLISHED_RAW_MASS_GRAMS_PER_UNIT },
  'iron': { id: 'iron', name: 'Iron', class: 'raw', massGramsPerUnit: UNPUBLISHED_RAW_MASS_GRAMS_PER_UNIT },
  'stone': { id: 'stone', name: 'Stone', class: 'raw', massGramsPerUnit: UNPUBLISHED_RAW_MASS_GRAMS_PER_UNIT },
  'sugar-cane': { id: 'sugar-cane', name: 'Sugar cane', class: 'raw', massGramsPerUnit: UNPUBLISHED_RAW_MASS_GRAMS_PER_UNIT },
  'wood': { id: 'wood', name: 'Wood', class: 'raw', massGramsPerUnit: UNPUBLISHED_RAW_MASS_GRAMS_PER_UNIT },
  'sincosite': { id: 'sincosite', name: 'Sincosite', class: 'raw', massGramsPerUnit: UNPUBLISHED_RAW_MASS_GRAMS_PER_UNIT },
  'lily-of-the-valley': { id: 'lily-of-the-valley', name: 'Lily of the valley', class: 'raw', massGramsPerUnit: UNPUBLISHED_RAW_MASS_GRAMS_PER_UNIT },
  'chalcocite': { id: 'chalcocite', name: 'Chalcocite', class: 'raw', massGramsPerUnit: UNPUBLISHED_RAW_MASS_GRAMS_PER_UNIT },
  'butterfly-weed': { id: 'butterfly-weed', name: 'Butterfly weed', class: 'raw', massGramsPerUnit: UNPUBLISHED_RAW_MASS_GRAMS_PER_UNIT },
  'pokeweed-berries': { id: 'pokeweed-berries', name: 'Pokeweed berries', class: 'raw', massGramsPerUnit: UNPUBLISHED_RAW_MASS_GRAMS_PER_UNIT },
  'iris-root': { id: 'iris-root', name: 'Iris root', class: 'raw', massGramsPerUnit: UNPUBLISHED_RAW_MASS_GRAMS_PER_UNIT },
  'small-cannon-ball': { id: 'small-cannon-ball', name: 'Small cannon ball', class: 'refined', massGramsPerUnit: SMALL_CANNON_BALL_MASS_GRAMS_PER_UNIT },
  'medium-cannon-ball': { id: 'medium-cannon-ball', name: 'Medium cannon ball', class: 'refined', massGramsPerUnit: MEDIUM_CANNON_BALL_MASS_GRAMS_PER_UNIT },
  'large-cannon-ball': { id: 'large-cannon-ball', name: 'Large cannon ball', class: 'refined', massGramsPerUnit: LARGE_CANNON_BALL_MASS_GRAMS_PER_UNIT },
  'swill': { id: 'swill', name: 'Swill', class: 'refined', massGramsPerUnit: RUM_MASS_GRAMS_PER_UNIT },
  'grog': { id: 'grog', name: 'Grog', class: 'refined', massGramsPerUnit: RUM_MASS_GRAMS_PER_UNIT },
};

export const COMMODITIES: Record<CommodityId, Commodity> = Object.assign(
  Object.create(null),
  declaredCommodities,
);

export const COMMODITY_IDS = Object.keys(COMMODITIES) as CommodityId[];

const declaredCannonBalls: Record<CannonSize, CommodityId> = {
  small: 'small-cannon-ball',
  medium: 'medium-cannon-ball',
  large: 'large-cannon-ball',
};

const CANNON_BALLS: Record<CannonSize, CommodityId> = Object.assign(
  Object.create(null),
  declaredCannonBalls,
);

const CANNON_BALL_IDS = Object.values(CANNON_BALLS);

export function commodityOf(id: CommodityId): Commodity {
  const commodity = COMMODITIES[id];
  if (commodity === undefined) throw new RangeError(`no commodity named "${id}"`);
  return commodity;
}

export function cannonBallOf(size: CannonSize): CommodityId {
  const commodityId = CANNON_BALLS[size];
  if (commodityId === undefined) throw new RangeError(`no cannon size named "${size}"`);
  return commodityId;
}

export function isCannonBall(id: CommodityId): boolean {
  return CANNON_BALL_IDS.includes(id);
}

export function isRum(id: CommodityId): boolean {
  return id === 'swill' || id === 'grog';
}

export function isShipSupply(id: CommodityId): boolean {
  return isCannonBall(id) || isRum(id);
}

export const PLUNDERABLE_COMMODITY_IDS = COMMODITY_IDS.filter((id) => !isShipSupply(id));
