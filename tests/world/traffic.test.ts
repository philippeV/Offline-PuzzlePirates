import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BALANCE } from '../../packages/harness/src/index.ts';
import { PER_MILLE } from '../../packages/sim/src/puzzle/scoring.ts';
import { rngStream } from '../../packages/sim/src/rng.ts';
import { createShip } from '../../packages/sim/src/ship/state.ts';
import { createWorldState, type WorldState } from '../../packages/sim/src/state.ts';
import { ENCOUNTER_STREAM } from '../../packages/sim/src/world/encounter.ts';
import {
  advanceTraffic,
  legProgressPerMilleOf,
  seedTraffic,
  trafficEnteringRange,
  trafficStillOnLeg,
  withinRange,
  type TrafficShip,
} from '../../packages/sim/src/world/traffic.ts';
import { chartVoyage } from '../../packages/sim/src/world/voyage.ts';
import { stepWorld } from '../../packages/sim/src/world/session.ts';
import type { SimEvent } from '../../packages/sim/src/events.ts';
import type { VoyageType } from '../../packages/sim/src/world/state.ts';

const SEED = 20260907;
const RANGE = BALANCE.world.encounterRangePerMille;
const VOYAGE_TICKS = 120000;
const VOYAGE_SEEDS = 20;
const EVADE_SEEDS = 8;
const EVADE_TICKS = 30000;
const SPAWN_SEEDS = 40;

function sailingState(seed: number, voyageType: VoyageType): WorldState {
  const state = createWorldState(seed, BALANCE);
  state.pirate = { poe: BALANCE.world.startingPoe, atIslandId: 'alkaid' };
  const ship = createShip(state, { shipClass: 'sloop', allegiance: 'player' });
  ship.speedPerMille = PER_MILLE;
  state.ships.push(ship);
  const charted = chartVoyage(state, ship, 'mcguffins-isle', voyageType);
  assert.ok(typeof charted !== 'string', String(charted));
  state.voyage = { ...charted, phase: 'under-way' };
  return state;
}

function trafficOf(progressPerMille: number, speed: number): TrafficShip {
  return {
    id: 1,
    fromPointId: 1,
    toPointId: 2,
    progressPerMille,
    progressAccumulator: 0,
    speedPerMillePerThousandTicks: speed,
  };
}

test('leg progress reads nothing at the start, everything at the end, and never overshoots', () => {
  assert.equal(legProgressPerMilleOf(0, 1000), 0);
  assert.equal(legProgressPerMilleOf(500, 1000), 500);
  assert.equal(legProgressPerMilleOf(1000, 1000), PER_MILLE);
  assert.equal(legProgressPerMilleOf(5000, 1000), PER_MILLE);
  assert.equal(legProgressPerMilleOf(7, 0), PER_MILLE);
});

test('range is symmetric and closed at the threshold', () => {
  assert.ok(withinRange(500, 500, RANGE));
  assert.ok(withinRange(500 + RANGE, 500, RANGE));
  assert.ok(withinRange(500 - RANGE, 500, RANGE));
  assert.ok(!withinRange(500 + RANGE + 1, 500, RANGE));
  assert.ok(!withinRange(500 - RANGE - 1, 500, RANGE));
});

test('traffic advances at its own rate and keeps every field a whole number', () => {
  const traffic = [trafficOf(0, 40)];
  for (let tick = 0; tick < 1000; tick += 1) advanceTraffic(traffic);

  const ship = traffic[0];
  assert.ok(ship !== undefined);
  assert.equal(ship.progressPerMille, 40);
  assert.ok(Number.isSafeInteger(ship.progressPerMille));
  assert.ok(Number.isSafeInteger(ship.progressAccumulator));
});

test('a faster ship overtakes a slower one rather than holding formation', () => {
  const slow = trafficOf(100, 25);
  const quick = trafficOf(0, 60);
  const traffic = [slow, quick];

  for (let tick = 0; tick < 4000; tick += 1) advanceTraffic(traffic);

  assert.ok(quick.progressPerMille > slow.progressPerMille);
});

test('a ship rolls when it crosses into range, not on every tick it stays there', () => {
  const closing = trafficOf(500 + RANGE - 10, 0);
  const traffic = [closing];
  const before = [closing.progressPerMille];

  const entering = trafficEnteringRange(traffic, before, 400, 500, RANGE);
  assert.equal(entering, closing);

  const stillThere = trafficEnteringRange(traffic, [closing.progressPerMille], 500, 500, RANGE);
  assert.equal(stillThere, undefined);
});

test('traffic that has sailed past either end of the leg is dropped', () => {
  const kept = trafficOf(PER_MILLE, 0);
  const sailedOn = trafficOf(PER_MILLE + 1, 0);
  const fellBehind = trafficOf(-PER_MILLE - 1, 0);

  assert.deepEqual(trafficStillOnLeg([kept, sailedOn, fellBehind]), [kept]);
});

test('a leg opens with ships both ahead of the player and astern of it', () => {
  let ahead = 0;
  let astern = 0;
  for (let seed = 1; seed <= SPAWN_SEEDS; seed += 1) {
    const state = createWorldState(seed * 7919, BALANCE);
    const stream = rngStream(state.seed, state.rngStreams, ENCOUNTER_STREAM);
    for (const ship of seedTraffic(state, stream, BALANCE.world, 1, 2)) {
      if (ship.progressPerMille > 0) ahead += 1;
      if (ship.progressPerMille < 0) astern += 1;
    }
  }

  assert.ok(ahead > 0, 'no ship ever opened a leg ahead of the player');
  assert.ok(astern > 0, 'no ship ever opened a leg astern of the player');
});

test('a ship astern that sails faster runs the player down', () => {
  const chaser = trafficOf(-200, 60);
  const traffic = [chaser];
  const playerSpeedPerThousandTicks = 40;
  let playerProgress = 0;

  for (let step = 0; step < 20; step += 1) {
    for (let tick = 0; tick < 1000; tick += 1) advanceTraffic(traffic);
    playerProgress += playerSpeedPerThousandTicks;
  }

  assert.ok(
    chaser.progressPerMille > playerProgress,
    `the chaser never came up: ${String(chaser.progressPerMille)} against ${String(playerProgress)}`,
  );
});

test('seeded traffic never starts already in range', () => {
  for (let seed = 1; seed <= SPAWN_SEEDS; seed += 1) {
    const state = createWorldState(seed * 7919, BALANCE);
    const stream = rngStream(state.seed, state.rngStreams, ENCOUNTER_STREAM);
    for (const ship of seedTraffic(state, stream, BALANCE.world, 1, 2)) {
      assert.ok(
        !withinRange(ship.progressPerMille, 0, RANGE),
        `seeded in range at ${String(ship.progressPerMille)}`,
      );
    }
  }
});

test('the same seed seeds the same traffic', () => {
  const first = createWorldState(SEED, BALANCE);
  const second = createWorldState(SEED, BALANCE);

  assert.deepEqual(
    seedTraffic(first, rngStream(first.seed, first.rngStreams, ENCOUNTER_STREAM), BALANCE.world, 1, 2),
    seedTraffic(second, rngStream(second.seed, second.rngStreams, ENCOUNTER_STREAM), BALANCE.world, 1, 2),
  );
});

function sailUntilEncounter(seed: number, voyageType: VoyageType): SimEvent[] | null {
  const state = sailingState(seed, voyageType);
  for (let tick = 0; tick < VOYAGE_TICKS; tick += 1) {
    state.tick += 1;
    const events = stepWorld(state);
    if (events.some((event) => event.type === 'encounter.spawned')) return events;
    if (state.voyage === null) return null;
  }
  return null;
}

test('a battle begins in open water between league points, not on arrival at one', () => {
  const seedsThatFought: number[] = [];
  for (let seed = 1; seed <= VOYAGE_SEEDS; seed += 1) {
    const events = sailUntilEncounter(seed * 7919, 'pillage');
    if (events === null) continue;
    seedsThatFought.push(seed);
    assert.ok(
      !events.some((event) => event.type === 'voyage.legReached'),
      'the encounter still arrived with a league point',
    );
  }

  assert.ok(seedsThatFought.length > 0, 'no seed ever met a brigand');
});

test('an evade voyage carries traffic and still never meets a brigand', () => {
  let sawTraffic = false;
  for (let seed = 1; seed <= EVADE_SEEDS; seed += 1) {
    const state = sailingState(seed * 7919, 'evade');
    for (let tick = 0; tick < EVADE_TICKS; tick += 1) {
      state.tick += 1;
      const events = stepWorld(state);
      assert.ok(
        !events.some((event) => event.type === 'encounter.spawned'),
        'an evade voyage met a brigand',
      );
      if (state.traffic.length > 0) sawTraffic = true;
    }
  }

  assert.ok(sawTraffic, 'an evade passage was empty of other ships');
});

test('the same seed puts the same traffic in the same water', () => {
  const first = sailingState(SEED, 'pillage');
  const second = sailingState(SEED, 'pillage');

  for (let tick = 0; tick < 30000; tick += 1) {
    first.tick += 1;
    second.tick += 1;
    stepWorld(first);
    stepWorld(second);
  }

  assert.deepEqual(first.traffic, second.traffic);
});
