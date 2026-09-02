import type { BattleOutcome } from './battle/state.ts';
import type { BeamSide, Facing } from './battle/geometry.ts';
import type { EntityId } from './ids.ts';

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

export interface BilgeClearedEvent {
  type: 'bilge.cleared';
  tick: number;
  chain: number;
  cells: number[];
  points: number;
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

export type DamageSource = 'shot' | 'ram' | 'obstacle' | 'wear';

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
  | BilgeClearedEvent
  | BilgeWaterLineMovedEvent
  | PuzzleScoredEvent
  | PuzzleLevelChangedEvent;

export type SimEvent = MarkerEvent | PuzzleEvent | ShipEvent | BattleEvent;
