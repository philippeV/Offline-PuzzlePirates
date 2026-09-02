import type { Balance } from './balance.ts';
import { createClock } from './clock.ts';
import { canonicalJson } from './hash.ts';
import { FIRST_ENTITY_ID, type EntityId, type EntityIdCounter } from './ids.ts';
import type { BattleState } from './battle/state.ts';
import type { PuzzleState } from './puzzle/session.ts';
import type { ShipState } from './ship/state.ts';
import { createRngStreams, type RngStreams } from './rng.ts';
import type { IslandMarket, PirateState, VoyageState } from './world/state.ts';

export const SCHEMA_VERSION = 5;

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
  balance: Balance | null;
  puzzle: PuzzleState | null;
  ships: ShipState[];
  battle: BattleState | null;
  pirate: PirateState | null;
  voyage: VoyageState | null;
  markets: IslandMarket[];
}

export function createWorldState(seed: number, balance: Balance | null): WorldState {
  return {
    schemaVersion: SCHEMA_VERSION,
    seed: seed >>> 0,
    tick: createClock().tick,
    nextEntityId: FIRST_ENTITY_ID,
    rngStreams: createRngStreams(),
    markers: [],
    balance,
    puzzle: null,
    ships: [],
    battle: null,
    pirate: null,
    voyage: null,
    markets: [],
  };
}

export function cloneWorldState(state: WorldState): WorldState {
  return JSON.parse(canonicalJson(state)) as WorldState;
}
