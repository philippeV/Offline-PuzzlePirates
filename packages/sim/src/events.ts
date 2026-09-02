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

export type MarkerEvent = MarkerMovedEvent | MarkerDriftedEvent;

export type PuzzleEvent =
  | BilgeSwappedEvent
  | BilgePokedEvent
  | BilgeClearedEvent
  | BilgeWaterLineMovedEvent
  | PuzzleScoredEvent
  | PuzzleLevelChangedEvent;

export type SimEvent = MarkerEvent | PuzzleEvent;
