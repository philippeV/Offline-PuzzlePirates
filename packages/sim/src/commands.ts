import type { SimEvent } from './events.ts';
import type { EntityId } from './ids.ts';

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

export type MarkerCommand = MoveMarkerCommand | PlaceMarkerCommand;

export type PuzzleCommand = StartPuzzleCommand | SwapBilgeCommand;

export type Command = MarkerCommand | PuzzleCommand;

export type RejectionReason =
  | 'unknown-marker'
  | 'non-integer-coordinate'
  | 'destination-outside-field'
  | 'balance-missing'
  | 'unknown-puzzle'
  | 'puzzle-already-running'
  | 'no-puzzle-running'
  | 'swap-outside-board';

export interface AcceptedCommand {
  status: 'accepted';
  events: SimEvent[];
}

export interface RejectedCommand {
  status: 'rejected';
  reason: RejectionReason;
}

export type CommandResult = AcceptedCommand | RejectedCommand;
