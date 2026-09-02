import type { BattleState } from '../battle/state.ts';
import type { SimEvent } from '../events.ts';
import { findShip } from '../ship/state.ts';
import type { Allegiance, ShipState } from '../ship/state.ts';
import type { WorldState } from '../state.ts';
import { materialisePlunder } from './encounter.ts';
import { stepVoyage } from './voyage.ts';

export function stepWorld(state: WorldState): SimEvent[] {
  if (state.voyage === null) return [];

  const encounter = ownedEncounterOf(state);
  if (encounter === null) return stepVoyage(state);
  return settleEncounter(state, encounter);
}

export function settleOwnedEncounter(state: WorldState): SimEvent[] {
  const encounter = ownedEncounterOf(state);
  if (encounter === null) return [];
  return settleEncounter(state, encounter);
}

function ownedEncounterOf(state: WorldState): BattleState | null {
  const voyage = state.voyage;
  const battle = state.battle;
  if (voyage === null || battle === null || battle.outcome === 'running') return null;
  const sailed = battle.ships.some((berth) => berth.shipId === voyage.shipId);
  return sailed ? battle : null;
}

function settleEncounter(state: WorldState, battle: BattleState): SimEvent[] {
  const player = hullWith(state, battle, 'player');
  const brigand = hullWith(state, battle, 'brigand');
  const events =
    battle.outcome === 'player-won' && player !== undefined
      ? materialisePlunder(state, player)
      : [];
  if (brigand !== undefined) {
    state.ships = state.ships.filter((ship) => ship.id !== brigand.id);
  }
  state.battle = null;
  return events;
}

function hullWith(
  state: WorldState,
  battle: BattleState,
  allegiance: Allegiance,
): ShipState | undefined {
  for (const berth of battle.ships) {
    const hull = findShip(state.ships, berth.shipId);
    if (hull?.allegiance === allegiance) return hull;
  }
  return undefined;
}
