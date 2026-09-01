import { createClock } from './clock.ts';
import { canonicalJson } from './hash.ts';
import { FIRST_ENTITY_ID, type EntityId, type EntityIdCounter } from './ids.ts';
import { createRngStreams, type RngStreams } from './rng.ts';

export const SCHEMA_VERSION = 2;

export interface Marker {
  id: EntityId;
  x: number;
  y: number;
}

export interface WorldState extends EntityIdCounter {
  schemaVersion: number;
  seed: number;
  tick: number;
  rngStreams: RngStreams;
  markers: Marker[];
}

export function createWorldState(seed: number): WorldState {
  return {
    schemaVersion: SCHEMA_VERSION,
    seed: seed >>> 0,
    tick: createClock().tick,
    nextEntityId: FIRST_ENTITY_ID,
    rngStreams: createRngStreams(),
    markers: [],
  };
}

export function cloneWorldState(state: WorldState): WorldState {
  return JSON.parse(canonicalJson(state)) as WorldState;
}
