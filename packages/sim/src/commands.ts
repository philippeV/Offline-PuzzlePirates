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

export type Command = MoveMarkerCommand | PlaceMarkerCommand;

export type RejectionReason =
  | 'unknown-marker'
  | 'non-integer-coordinate'
  | 'destination-outside-field';

export interface AcceptedCommand {
  status: 'accepted';
  events: SimEvent[];
}

export interface RejectedCommand {
  status: 'rejected';
  reason: RejectionReason;
}

export type CommandResult = AcceptedCommand | RejectedCommand;
