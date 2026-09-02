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
  'swill': { id: 'swill', name: 'Swill', class: 'refined', massGramsPerUnit: RUM_MASS_GRAMS_PER_UNIT },
  'grog': { id: 'grog', name: 'Grog', class: 'refined', massGramsPerUnit: RUM_MASS_GRAMS_PER_UNIT },
};

export const COMMODITIES: Record<CommodityId, Commodity> = Object.assign(
  Object.create(null),
  declaredCommodities,
);

export const COMMODITY_IDS = Object.keys(COMMODITIES) as CommodityId[];

export function commodityOf(id: CommodityId): Commodity {
  const commodity = COMMODITIES[id];
  if (commodity === undefined) throw new RangeError(`no commodity named "${id}"`);
  return commodity;
}
