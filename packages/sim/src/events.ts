import type { BattleOutcome } from './battle/state.ts';
import type { BeamSide, Facing } from './battle/geometry.ts';
import type { EntityId } from './ids.ts';
import type { CommodityId } from './world/commodities.ts';
import type { IslandId } from './world/islands.ts';
import type { LeaguePointId } from './world/leaguePoints.ts';

export interface MarkerMovedEvent {
  type: 'marker.moved';
  tick: number;
  id: EntityId;
  x: number;
  y: number;
}

export interface MarkerDriftedEvent {
  type: 'marker.drifted';
  tick: number;
  id: EntityId;
  x: number;
  y: number;
}

export interface BilgeSwappedEvent {
  type: 'bilge.swapped';
  tick: number;
  x: number;
  y: number;
}

export interface BilgePokedEvent {
  type: 'bilge.poked';
  tick: number;
  x: number;
  y: number;
}

export interface BilgeClearedEvent {
  type: 'bilge.cleared';
  tick: number;
  chain: number;
  cells: number[];
  crabs: number[];
  points: number;
  settleTicks: number;
}

export interface BilgeWaterLineMovedEvent {
  type: 'bilge.waterLineMoved';
  tick: number;
  waterLineRow: number;
  bilgePerMille: number;
}

export interface PuzzleScoredEvent {
  type: 'puzzle.scored';
  tick: number;
  points: number;
  totalScore: number;
  moves: number;
}

export interface PuzzleLevelChangedEvent {
  type: 'puzzle.levelChanged';
  tick: number;
  starLevel: number;
}

export type ShipMeter = 'damage' | 'bilge' | 'speed';

export type DamageSource = 'shot' | 'ram' | 'obstacle';

export interface ShipMeterBandedEvent {
  type: 'ship.meterBanded';
  tick: number;
  id: EntityId;
  meter: ShipMeter;
  band: number;
  perMille: number;
}

export interface ShipDamagedEvent {
  type: 'ship.damaged';
  tick: number;
  id: EntityId;
  source: DamageSource;
  damageSmallMicro: number;
  damageTakenSmallMicro: number;
}

export interface BattleStartedEvent {
  type: 'battle.started';
  tick: number;
  ships: EntityId[];
}

export interface BattleMovedEvent {
  type: 'battle.moved';
  tick: number;
  id: EntityId;
  phase: number;
  x: number;
  y: number;
  facing: Facing;
}

export interface BattleCollidedEvent {
  type: 'battle.collided';
  tick: number;
  id: EntityId;
  phase: number;
  struckObstacle: boolean;
}

export interface BattleFiredEvent {
  type: 'battle.fired';
  tick: number;
  id: EntityId;
  phase: number;
  side: BeamSide;
  shots: number;
}

export interface BattleHitEvent {
  type: 'battle.hit';
  tick: number;
  id: EntityId;
  targetId: EntityId;
  phase: number;
  damageSmallMicro: number;
}

export interface BattleGrappledEvent {
  type: 'battle.grappled';
  tick: number;
  id: EntityId;
  phase: number;
}

export interface BattleTurnEndedEvent {
  type: 'battle.turnEnded';
  tick: number;
  turnIndex: number;
  expiredTokens: number;
}

export interface BattleEndedEvent {
  type: 'battle.ended';
  tick: number;
  outcome: BattleOutcome;
  bootyPoe: number;
  bootyCargoUnits: number;
  chartDropped: boolean;
}

export type TradeSide = 'buy' | 'sell';

export interface WorldStartedEvent {
  type: 'world.started';
  tick: number;
  islandId: IslandId;
}

export interface VoyageChartedEvent {
  type: 'voyage.charted';
  tick: number;
  shipId: EntityId;
  toIslandId: IslandId;
  legs: number;
}

export interface VoyageSailedEvent {
  type: 'voyage.sailed';
  tick: number;
  shipId: EntityId;
  toIslandId: IslandId;
}

export interface VoyageAbandonedEvent {
  type: 'voyage.abandoned';
  tick: number;
  islandId: IslandId;
}

export interface VoyageLegReachedEvent {
  type: 'voyage.legReached';
  tick: number;
  pointId: LeaguePointId;
  legIndex: number;
  difficultyPerMille: number;
}

export interface VoyagePortedEvent {
  type: 'voyage.ported';
  tick: number;
  islandId: IslandId;
}

export interface EncounterSpawnedEvent {
  type: 'encounter.spawned';
  tick: number;
  shipId: EntityId;
  pointId: LeaguePointId;
  difficultyPerMille: number;
}

export interface CargoPlunderedEvent {
  type: 'cargo.plundered';
  tick: number;
  shipId: EntityId;
  commodityId: CommodityId;
  units: number;
}

export interface MarketTradedEvent {
  type: 'market.traded';
  tick: number;
  islandId: IslandId;
  commodityId: CommodityId;
  side: TradeSide;
  units: number;
  poe: number;
}

export interface BootyDividedEvent {
  type: 'booty.divided';
  tick: number;
  shipId: EntityId;
  poe: number;
  crewCutPoe: number;
  pirateSharePoe: number;
}

export type MarkerEvent = MarkerMovedEvent | MarkerDriftedEvent;

export type ShipEvent = ShipMeterBandedEvent | ShipDamagedEvent;

export type BattleEvent =
  | BattleStartedEvent
  | BattleMovedEvent
  | BattleCollidedEvent
  | BattleFiredEvent
  | BattleHitEvent
  | BattleGrappledEvent
  | BattleTurnEndedEvent
  | BattleEndedEvent;

export type PuzzleEvent =
  | BilgeSwappedEvent
  | BilgePokedEvent
  | BilgeClearedEvent
  | BilgeWaterLineMovedEvent
  | PuzzleScoredEvent
  | PuzzleLevelChangedEvent;

export type WorldEvent =
  | WorldStartedEvent
  | VoyageChartedEvent
  | VoyageSailedEvent
  | VoyageAbandonedEvent
  | VoyageLegReachedEvent
  | VoyagePortedEvent
  | EncounterSpawnedEvent
  | CargoPlunderedEvent
  | MarketTradedEvent
  | BootyDividedEvent;

export type SimEvent = MarkerEvent | PuzzleEvent | ShipEvent | BattleEvent | WorldEvent;
