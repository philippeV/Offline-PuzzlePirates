import type { EntityId } from '../ids.ts';
import type { CommodityId } from './commodities.ts';
import type { IslandId } from './islands.ts';
import type { LeaguePointId } from './leaguePoints.ts';

export type VoyageType = 'pillage' | 'trade' | 'evade';

export const VOYAGE_TYPES: readonly VoyageType[] = ['pillage', 'trade', 'evade'];

export interface PirateState {
  poe: number;
  atIslandId: IslandId | null;
}

export interface CargoLot {
  commodityId: CommodityId;
  units: number;
}

export interface MarketStock {
  commodityId: CommodityId;
  units: number;
  buyPricePoe: number;
  sellPricePoe: number;
}

export interface IslandMarket {
  islandId: IslandId;
  stocks: MarketStock[];
}

export interface VoyageState {
  shipId: EntityId;
  type: VoyageType;
  route: LeaguePointId[];
  legIndex: number;
  legTicks: number;
  legTicksRequired: number;
  encounters: number;
}

export function isVoyageType(value: string): value is VoyageType {
  return VOYAGE_TYPES.includes(value as VoyageType);
}
