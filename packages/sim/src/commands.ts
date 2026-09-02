import type { BattlePhasePlan } from './battle/plan.ts';
import type { SimEvent } from './events.ts';
import type { EntityId } from './ids.ts';
import type { ShipClassId } from './ship/classes.ts';
import type { Allegiance, StationSlot } from './ship/state.ts';

export interface MoveMarkerCommand {
  op: 'marker.move';
  id: EntityId;
  dx: number;
  dy: number;
}

export interface PlaceMarkerCommand {
  op: 'marker.place';
  id: EntityId;
  x: number;
  y: number;
}

export interface StartPuzzleCommand {
  op: 'puzzle.start';
  puzzle: string;
}

export interface SwapBilgeCommand {
  op: 'bilge.swap';
  x: number;
  y: number;
}

export interface CommissionShipCommand {
  op: 'ship.commission';
  shipClass: ShipClassId;
  allegiance: Allegiance;
  playerStation?: StationSlot | null | undefined;
  crewCount?: number | undefined;
  cannonballs?: number | undefined;
  rum?: number | undefined;
  cargoUnits?: number | undefined;
  poe?: number | undefined;
}

export interface StartBattleCommand {
  op: 'battle.start';
  sinkingContext?: boolean | undefined;
}

export interface PlanBattleTurnCommand {
  op: 'battle.plan';
  shipId: EntityId;
  plan: BattlePhasePlan[];
}

export interface DisengageCommand {
  op: 'battle.disengage';
  shipId: EntityId;
}

export type MarkerCommand = MoveMarkerCommand | PlaceMarkerCommand;

export type PuzzleCommand = StartPuzzleCommand | SwapBilgeCommand;

export type ShipCommand = CommissionShipCommand;

export type BattleCommand = StartBattleCommand | PlanBattleTurnCommand | DisengageCommand;

export type Command = MarkerCommand | PuzzleCommand | ShipCommand | BattleCommand;

export type RejectionReason =
  | 'unknown-marker'
  | 'non-integer-coordinate'
  | 'destination-outside-field'
  | 'balance-missing'
  | 'unknown-puzzle'
  | 'puzzle-already-running'
  | 'no-puzzle-running'
  | 'swap-outside-board'
  | 'unknown-ship'
  | 'no-battle-running'
  | 'battle-already-running'
  | 'plan-wrong-length'
  | 'plan-move-budget'
  | 'too-many-shots'
  | 'no-movement-token'
  | 'no-gun-token'
  | 'disengage-not-ready';

export interface AcceptedCommand {
  status: 'accepted';
  events: SimEvent[];
}

export interface RejectedCommand {
  status: 'rejected';
  reason: RejectionReason;
}

export type CommandResult = AcceptedCommand | RejectedCommand;
