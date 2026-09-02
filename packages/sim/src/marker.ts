import type { CommandResult, MarkerCommand } from './commands.ts';
import type { MarkerEvent, SimEvent } from './events.ts';
import { takeEntityId, type EntityId } from './ids.ts';
import { rngStream, type RngStream } from './rng.ts';
import type { Marker, WorldState } from './state.ts';

export const FIELD_WIDTH = 16;
export const FIELD_HEIGHT = 16;
export const DRIFT_STREAM = 'marker.drift';

interface FieldPosition {
  x: number;
  y: number;
}

export function spawnMarker(state: WorldState): Marker {
  const marker: Marker = {
    id: takeEntityId(state),
    x: FIELD_WIDTH >> 1,
    y: FIELD_HEIGHT >> 1,
  };
  state.markers.push(marker);
  return marker;
}

export function findMarker(state: WorldState, id: EntityId): Marker | undefined {
  return state.markers.find((marker) => marker.id === id);
}

export function applyMarkerCommand(state: WorldState, command: MarkerCommand): CommandResult {
  const marker = findMarker(state, command.id);
  if (marker === undefined) return { status: 'rejected', reason: 'unknown-marker' };

  const destination = destinationOf(marker, command);
  if (!isIntegerPosition(destination)) {
    return { status: 'rejected', reason: 'non-integer-coordinate' };
  }
  if (!isInsideField(destination)) {
    return { status: 'rejected', reason: 'destination-outside-field' };
  }

  marker.x = destination.x;
  marker.y = destination.y;
  return { status: 'accepted', events: [markerEvent('marker.moved', state.tick, marker)] };
}

export function driftMarkers(state: WorldState): SimEvent[] {
  const stream = rngStream(state.seed, state.rngStreams, DRIFT_STREAM);
  return state.markers.map((marker) => driftMarker(state.tick, marker, stream));
}

function driftMarker(tick: number, marker: Marker, stream: RngStream): SimEvent {
  const step = stream.nextIntInRange(-1, 2);
  marker.x = clamp(marker.x + step, 0, FIELD_WIDTH - 1);
  return markerEvent('marker.drifted', tick, marker);
}

function destinationOf(marker: Marker, command: MarkerCommand): FieldPosition {
  switch (command.op) {
    case 'marker.move':
      return { x: marker.x + command.dx, y: marker.y + command.dy };
    case 'marker.place':
      return { x: command.x, y: command.y };
  }
}

function isIntegerPosition(position: FieldPosition): boolean {
  return Number.isSafeInteger(position.x) && Number.isSafeInteger(position.y);
}

function isInsideField(position: FieldPosition): boolean {
  return (
    position.x >= 0 && position.x < FIELD_WIDTH && position.y >= 0 && position.y < FIELD_HEIGHT
  );
}

function clamp(value: number, minInclusive: number, maxInclusive: number): number {
  return Math.min(Math.max(value, minInclusive), maxInclusive);
}

function markerEvent(type: MarkerEvent['type'], tick: number, marker: Marker): MarkerEvent {
  return { type, tick, id: marker.id, x: marker.x, y: marker.y };
}
