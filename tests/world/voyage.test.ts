import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BALANCE } from '../../packages/harness/src/index.ts';
import { stepBattle } from '../../packages/sim/src/battle/session.ts';
import { createBattle } from '../../packages/sim/src/battle/state.ts';
import { TICKS_PER_SECOND } from '../../packages/sim/src/clock.ts';
import type { SimEvent } from '../../packages/sim/src/events.ts';
import { shipClassOf } from '../../packages/sim/src/ship/classes.ts';
import { createShip, type ShipState } from '../../packages/sim/src/ship/state.ts';
import { createWorldState, type WorldState } from '../../packages/sim/src/state.ts';
import type { IslandId } from '../../packages/sim/src/world/islands.ts';
import {
  DIAGONAL_LEAGUE_COST_PER_MILLE,
  HORIZONTAL_LEAGUE_COST_PER_MILLE,
  islandPointOf,
} from '../../packages/sim/src/world/leaguePoints.ts';
import { stepWorld } from '../../packages/sim/src/world/session.ts';
import type { VoyageState, VoyageType } from '../../packages/sim/src/world/state.ts';
import {
  chartVoyage,
  legTicksRequiredOf,
  stepVoyage,
} from '../../packages/sim/src/world/voyage.ts';

const SEED = 20260902;
const SPEEDS_PER_MILLE = [0, 250, 500, 750, 1000];
const HORIZONTAL_NUMERATOR = 7;
const HORIZONTAL_DENOMINATOR = 5;
const HORIZONTAL_LEG_TICKS = 5040;
const DIAGONAL_LEG_TICKS = 3600;
const DIAGONAL_ROUTE_ISLAND: IslandId = 'marlowe';
const MIXED_ROUTE_ISLAND: IslandId = 'doyle';
const PAUSED_TICKS = 100;
const LEG_TICK_BUDGET = 60000;
const DETERMINISM_TICKS = 60000;
const DIVERGENCE_TICKS = 12000;
const DIVERGENCE_SEEDS = 6;

function seaState(seed: number, atIslandId: IslandId = 'alkaid'): WorldState {
  const state = createWorldState(seed, BALANCE);
  state.pirate = { poe: BALANCE.world.startingPoe, atIslandId };
  return state;
}

function crewedSloop(state: WorldState, speedPerMille: number): ShipState {
  const ship = createShip(state, { shipClass: 'sloop', allegiance: 'player' });
  ship.speedPerMille = speedPerMille;
  state.ships.push(ship);
  return ship;
}

function chartedOf(
  state: WorldState,
  ship: ShipState,
  toIslandId: IslandId,
  voyageType: VoyageType,
): VoyageState {
  const charted = chartVoyage(state, ship, toIslandId, voyageType);
  assert.ok(typeof charted !== 'string', String(charted));
  return charted;
}

function ticksToFirstLeg(speedPerMille: number): number {
  const state = seaState(SEED);
  const ship = crewedSloop(state, speedPerMille);
  state.voyage = chartedOf(state, ship, 'doyle', 'evade');
  for (let tick = 1; tick <= LEG_TICK_BUDGET; tick += 1) {
    state.tick = tick;
    if (stepVoyage(state).length > 0) return tick;
  }
  return -1;
}

function legTicksSailedOf(toIslandId: IslandId): number[] {
  const state = seaState(SEED);
  const ship = crewedSloop(state, 1000);
  const voyage = chartedOf(state, ship, toIslandId, 'evade');
  state.voyage = voyage;
  const sailed: number[] = [];
  let legTicks = 0;
  for (let tick = 1; tick <= LEG_TICK_BUDGET; tick += 1) {
    state.tick = tick;
    legTicks += 1;
    if (stepVoyage(state).length === 0) continue;
    sailed.push(legTicks);
    legTicks = 0;
    if (voyage.legIndex >= voyage.route.length - 1) return sailed;
  }
  return sailed;
}

function sailedEventsOf(seed: number, ticks: number): SimEvent[] {
  const state = seaState(seed);
  const ship = crewedSloop(state, 1000);
  state.voyage = chartedOf(state, ship, 'mcguffins-isle', 'pillage');
  const events: SimEvent[] = [];
  for (let tick = 1; tick <= ticks; tick += 1) {
    state.tick = tick;
    events.push(...stepBattle(state));
    events.push(...stepWorld(state));
  }
  return events;
}

test('a league costs a whole number of ticks at every speed', () => {
  const state = seaState(SEED);
  const ship = crewedSloop(state, 0);
  for (const speedPerMille of SPEEDS_PER_MILLE) {
    ship.speedPerMille = speedPerMille;
    for (const cost of [DIAGONAL_LEAGUE_COST_PER_MILLE, HORIZONTAL_LEAGUE_COST_PER_MILLE]) {
      assert.ok(Number.isSafeInteger(legTicksRequiredOf(ship, cost)), `${speedPerMille}/${cost}`);
    }
  }
});

test('a horizontal league costs exactly forty per cent more than a diagonal one', () => {
  const state = seaState(SEED);
  const ship = crewedSloop(state, 0);
  for (const speedPerMille of SPEEDS_PER_MILLE) {
    ship.speedPerMille = speedPerMille;
    const diagonal = legTicksRequiredOf(ship, DIAGONAL_LEAGUE_COST_PER_MILLE);
    const horizontal = legTicksRequiredOf(ship, HORIZONTAL_LEAGUE_COST_PER_MILLE);
    assert.equal(
      horizontal * HORIZONTAL_DENOMINATOR,
      diagonal * HORIZONTAL_NUMERATOR,
      String(speedPerMille),
    );
  }
});

test('a stationary ship sails a league in five minutes and a flying one at its class best', () => {
  const state = seaState(SEED);
  const sloop = shipClassOf('sloop');
  const still = crewedSloop(state, 0);
  const flying = crewedSloop(state, 1000);

  assert.equal(
    legTicksRequiredOf(still, DIAGONAL_LEAGUE_COST_PER_MILLE),
    sloop.minSpeedSecondsPerLP * TICKS_PER_SECOND,
  );
  assert.equal(
    legTicksRequiredOf(flying, DIAGONAL_LEAGUE_COST_PER_MILLE),
    sloop.maxSpeedSecondsPerLP * TICKS_PER_SECOND,
  );
});

test('a faster ship reaches the next league point in fewer ticks', () => {
  const slow = ticksToFirstLeg(0);
  const quick = ticksToFirstLeg(500);
  const fast = ticksToFirstLeg(1000);

  assert.ok(slow > 0 && quick > 0 && fast > 0, `${slow}/${quick}/${fast}`);
  assert.ok(slow > quick, `${slow} > ${quick}`);
  assert.ok(quick > fast, `${quick} > ${fast}`);
});

test('a sailed leg is charged the cost of its own orientation', () => {
  assert.deepEqual(legTicksSailedOf(MIXED_ROUTE_ISLAND), [
    HORIZONTAL_LEG_TICKS,
    DIAGONAL_LEG_TICKS,
  ]);
  assert.deepEqual(legTicksSailedOf(DIAGONAL_ROUTE_ISLAND), [
    DIAGONAL_LEG_TICKS,
    DIAGONAL_LEG_TICKS,
  ]);
});

test('a charted voyage opens on the first leg of a route out of the pirate island', () => {
  const state = seaState(SEED);
  const ship = crewedSloop(state, 1000);
  const voyage = chartedOf(state, ship, 'doyle', 'trade');

  assert.equal(voyage.shipId, ship.id);
  assert.equal(voyage.type, 'trade');
  assert.equal(voyage.legIndex, 0);
  assert.equal(voyage.legTicks, 0);
  assert.equal(voyage.encounters, 0);
  assert.equal(voyage.route[0], islandPointOf('alkaid'));
  assert.equal(voyage.route[voyage.route.length - 1], islandPointOf('doyle'));
  assert.ok(voyage.legTicksRequired > 0);
});

test('charting leaves the world state untouched', () => {
  const state = seaState(SEED);
  const ship = crewedSloop(state, 1000);
  const before = JSON.stringify(state);
  chartVoyage(state, ship, 'doyle', 'pillage');

  assert.equal(JSON.stringify(state), before);
});

test('charting to an unknown island is refused as an unknown island', () => {
  const state = seaState(SEED);
  const ship = crewedSloop(state, 1000);

  assert.equal(chartVoyage(state, ship, 'sirius' as IslandId, 'trade'), 'unknown-island');
});

test('charting to the island the pirate is standing on is refused for want of a route', () => {
  const state = seaState(SEED);
  const ship = crewedSloop(state, 1000);

  assert.equal(chartVoyage(state, ship, 'alkaid', 'trade'), 'no-route');
});

test('charting from the open sea is refused because the pirate is at no island', () => {
  const state = seaState(SEED);
  const ship = crewedSloop(state, 1000);
  state.pirate = { poe: 0, atIslandId: null };

  assert.equal(chartVoyage(state, ship, 'doyle', 'trade'), 'not-at-island');
});

test('reaching a league point announces its id and its difficulty', () => {
  const state = seaState(SEED);
  const ship = crewedSloop(state, 1000);
  const voyage = chartedOf(state, ship, 'doyle', 'evade');
  state.voyage = voyage;
  voyage.legTicks = voyage.legTicksRequired - 1;
  const events = stepVoyage(state);
  const legReached = events[0];

  assert.ok(legReached?.type === 'voyage.legReached');
  assert.equal(legReached.legIndex, 1);
  assert.equal(legReached.pointId, voyage.route[1]);
  assert.equal(legReached.difficultyPerMille, 125);
});

test('a running battle pauses the voyage', () => {
  const state = seaState(SEED);
  const ship = crewedSloop(state, 1000);
  state.voyage = chartedOf(state, ship, 'doyle', 'evade');
  state.battle = createBattle([], false);

  for (let tick = 0; tick < PAUSED_TICKS; tick += 1) assert.deepEqual(stepVoyage(state), []);
  assert.equal(state.voyage.legTicks, 0);

  state.battle = null;
  stepVoyage(state);
  assert.equal(state.voyage.legTicks, 1);
});

test('a voyage that has run out of route waits in place rather than clearing itself', () => {
  const state = seaState(SEED);
  const ship = crewedSloop(state, 1000);
  const voyage = chartedOf(state, ship, 'doyle', 'evade');
  state.voyage = voyage;
  voyage.legIndex = voyage.route.length - 1;

  for (let tick = 0; tick < PAUSED_TICKS; tick += 1) assert.deepEqual(stepVoyage(state), []);
  assert.notEqual(state.voyage, null);
  assert.equal(voyage.legTicks, 0);
});

test('the same seed sails the same voyage and meets the same brigands', () => {
  const first = sailedEventsOf(SEED, DETERMINISM_TICKS);
  const second = sailedEventsOf(SEED, DETERMINISM_TICKS);

  assert.deepEqual(first, second);
  assert.ok(first.some((event) => event.type === 'encounter.spawned'));
});

test('different seeds do not all sail the same voyage', () => {
  const sailed = new Set<string>();
  for (let seed = 1; seed <= DIVERGENCE_SEEDS; seed += 1) {
    sailed.add(JSON.stringify(sailedEventsOf(seed * 7919, DIVERGENCE_TICKS)));
  }

  assert.ok(sailed.size > 1, `every seed sailed alike: ${String(sailed.size)}`);
});
