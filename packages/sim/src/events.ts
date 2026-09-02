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

export type SimEvent = MarkerMovedEvent | MarkerDriftedEvent;
