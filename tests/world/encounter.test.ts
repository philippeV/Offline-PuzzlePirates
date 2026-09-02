import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BALANCE } from '../../packages/harness/src/index.ts';
import { createBattle } from '../../packages/sim/src/battle/state.ts';
import { PER_MILLE } from '../../packages/sim/src/puzzle/scoring.ts';
import { createShip, type ShipState } from '../../packages/sim/src/ship/state.ts';
import { createWorldState, type WorldState } from '../../packages/sim/src/state.ts';
import { cargoLotsMassKgOf } from '../../packages/sim/src/world/cargo.ts';
import {
  COMMODITY_IDS,
  commodityOf,
  type CommodityId,
} from '../../packages/sim/src/world/commodities.ts';
import { applyWorldCommand } from '../../packages/sim/src/world/dispatch.ts';
import {
  encounterChanceOf,
  materialisePlunder,
  rollEncounter,
} from '../../packages/sim/src/world/encounter.ts';
import {
  LEAGUE_POINT_IDS,
  islandPointOf,
  leaguePointOf,
  type LeaguePointId,
} from '../../packages/sim/src/world/leaguePoints.ts';
import { stepWorld } from '../../packages/sim/src/world/session.ts';
import { VOYAGE_TYPES, type VoyageType } from '../../packages/sim/src/world/state.ts';
import { chartVoyage } from '../../packages/sim/src/world/voyage.ts';

const SEED = 20260902;
const SPAWN_SEEDS = 400;
const PLUNDER_SEEDS = 60;
const DIFFICULTIES_PER_MILLE = [0, 125, 250, 375, 500, 625, 750, 875, 1000];
const GRAMS_PER_KG = 1000;
const MID_DIFFICULTY_POINT: LeaguePointId = 16;
const BOOTY_CARGO_UNITS = BALANCE.booty.brigandCargoUnitsBase;

function sailingState(seed: number, voyageType: VoyageType): WorldState {
  const state = createWorldState(seed, BALANCE);
  state.pirate = { poe: BALANCE.world.startingPoe, atIslandId: 'alkaid' };
  const ship = createShip(state, { shipClass: 'sloop', allegiance: 'player' });
  ship.speedPerMille = PER_MILLE;
  state.ships.push(ship);
  const charted = chartVoyage(state, ship, 'mcguffins-isle', voyageType);
  assert.ok(typeof charted !== 'string', String(charted));
  state.voyage = charted;
  return state;
}

function spawnCountOf(voyageType: VoyageType, pointId: LeaguePointId): number {
  let spawned = 0;
  for (let seed = 1; seed <= SPAWN_SEEDS; seed += 1) {
    const state = sailingState(seed * 7919, voyageType);
    if (rollEncounter(state, pointId).some((event) => event.type === 'encounter.spawned')) {
      spawned += 1;
    }
  }
  return spawned;
}

function plunderedShipOf(seed: number, bootyCargoUnits: number): [WorldState, ShipState] {
  const state = createWorldState(seed, BALANCE);
  const ship = createShip(state, { shipClass: 'sloop', allegiance: 'player' });
  ship.bootyCargoUnits = bootyCargoUnits;
  state.ships.push(ship);
  return [state, ship];
}

test('an evade voyage never spawns anything, whatever the difficulty', () => {
  for (const difficultyPerMille of DIFFICULTIES_PER_MILLE) {
    assert.equal(encounterChanceOf(difficultyPerMille, 'evade', BALANCE.world), 0);
  }
  assert.equal(spawnCountOf('evade', MID_DIFFICULTY_POINT), 0);
  assert.equal(spawnCountOf('evade', islandPointOf('mcguffins-isle')), 0);
});

test('the spawn chance rises with the difficulty of the water', () => {
  for (const voyageType of ['pillage', 'trade'] as VoyageType[]) {
    const chances = DIFFICULTIES_PER_MILLE.map((difficultyPerMille) =>
      encounterChanceOf(difficultyPerMille, voyageType, BALANCE.world),
    );
    for (let index = 1; index < chances.length; index += 1) {
      assert.ok((chances[index] ?? 0) >= (chances[index - 1] ?? 0), voyageType);
    }
    assert.ok((chances[chances.length - 1] ?? 0) > (chances[0] ?? 0), voyageType);
  }
});

test('the spawn chance stays inside nought and one thousand per mille', () => {
  for (const voyageType of VOYAGE_TYPES) {
    for (const difficultyPerMille of DIFFICULTIES_PER_MILLE) {
      const chance = encounterChanceOf(difficultyPerMille, voyageType, BALANCE.world);
      assert.ok(Number.isSafeInteger(chance), `${voyageType}/${difficultyPerMille}`);
      assert.ok(chance >= 0 && chance <= PER_MILLE, `${voyageType}/${difficultyPerMille}`);
    }
  }
});

test('a pillage voyage draws brigands more often than a trade voyage does', () => {
  const difficultyPerMille = leaguePointOf(MID_DIFFICULTY_POINT).difficultyPerMille;
  assert.ok(
    encounterChanceOf(difficultyPerMille, 'pillage', BALANCE.world) >
      encounterChanceOf(difficultyPerMille, 'trade', BALANCE.world),
  );

  const pillaged = spawnCountOf('pillage', MID_DIFFICULTY_POINT);
  const traded = spawnCountOf('trade', MID_DIFFICULTY_POINT);

  assert.ok(pillaged > traded, `pillage ${pillaged} vs trade ${traded}`);
});

test('a spawned brigand is a crewed sloop that opens a battle against the player', () => {
  for (let seed = 1; seed <= SPAWN_SEEDS; seed += 1) {
    const state = sailingState(seed * 7919, 'pillage');
    const events = rollEncounter(state, MID_DIFFICULTY_POINT);
    if (!events.some((event) => event.type === 'encounter.spawned')) continue;

    const spawned = events[0];
    assert.ok(spawned?.type === 'encounter.spawned');
    assert.equal(spawned.pointId, MID_DIFFICULTY_POINT);
    assert.equal(spawned.difficultyPerMille, leaguePointOf(MID_DIFFICULTY_POINT).difficultyPerMille);
    assert.equal(events[1]?.type, 'battle.started');

    const brigand = state.ships.find((ship) => ship.allegiance === 'brigand');
    assert.ok(brigand !== undefined);
    assert.equal(brigand.id, spawned.shipId);
    assert.equal(brigand.shipClass, 'sloop');
    assert.equal(brigand.crewCount, BALANCE.world.brigandCrewCount);
    assert.equal(brigand.cannonballs, BALANCE.battle.startingCannonballs);
    assert.equal(brigand.rum, BALANCE.battle.startingRum);
    assert.equal(brigand.cargoUnits, BOOTY_CARGO_UNITS);
    assert.equal(state.battle?.outcome, 'running');
    assert.equal(state.voyage?.encounters, 1);
    return;
  }
  assert.fail('no seed drew a brigand');
});

test('plunder becomes a booty chest lot of the same mass to within the floor', () => {
  const drawn = new Set<CommodityId>();
  for (let seed = 1; seed <= PLUNDER_SEEDS; seed += 1) {
    const [state, ship] = plunderedShipOf(seed * 7919, BOOTY_CARGO_UNITS);
    const events = materialisePlunder(state, ship);
    const plundered = events[0];

    assert.equal(events.length, 1);
    assert.ok(plundered?.type === 'cargo.plundered');
    assert.equal(plundered.shipId, ship.id);
    assert.equal(ship.bootyCargoUnits, 0);
    assert.ok(COMMODITY_IDS.includes(plundered.commodityId));
    assert.ok(Number.isSafeInteger(plundered.units), String(seed));
    drawn.add(plundered.commodityId);

    const massGramsPerUnit = commodityOf(plundered.commodityId).massGramsPerUnit;
    const grams = plundered.units * massGramsPerUnit;
    assert.ok(grams <= BOOTY_CARGO_UNITS * GRAMS_PER_KG, String(seed));
    assert.ok(BOOTY_CARGO_UNITS * GRAMS_PER_KG - grams < massGramsPerUnit, String(seed));
    assert.equal(cargoLotsMassKgOf(ship.bootyCargo), Math.floor(grams / GRAMS_PER_KG));
    assert.deepEqual(ship.cargo, [], 'plunder reached the hold instead of the chest');
  }
  assert.ok(drawn.size > 1, 'the plunder stream drew a single commodity');
});

test('plunder merges into the booty chest and leaves it sorted by commodity', () => {
  for (let seed = 1; seed <= PLUNDER_SEEDS; seed += 1) {
    const [state, ship] = plunderedShipOf(seed * 7919, BOOTY_CARGO_UNITS);
    ship.bootyCargo = [
      { commodityId: 'hemp', units: 3 },
      { commodityId: 'wood', units: 5 },
    ];
    const events = materialisePlunder(state, ship);
    const plundered = events[0];
    assert.ok(plundered?.type === 'cargo.plundered');

    const ids = ship.bootyCargo.map((lot) => lot.commodityId);
    assert.deepEqual(ids, [...ids].sort(), String(seed));
    assert.equal(new Set(ids).size, ids.length, String(seed));

    const held = ship.bootyCargo.find((lot) => lot.commodityId === plundered.commodityId);
    const carried = plundered.commodityId === 'hemp' ? 3 : plundered.commodityId === 'wood' ? 5 : 0;
    assert.equal(held?.units, plundered.units + carried, String(seed));
  }
});

test('a ship carrying no booty is left alone', () => {
  const [state, ship] = plunderedShipOf(SEED, 0);

  assert.deepEqual(materialisePlunder(state, ship), []);
  assert.deepEqual(ship.cargo, []);
  assert.deepEqual(ship.bootyCargo, []);
  assert.deepEqual(state.rngStreams, {});
});

test('a won battle is settled into the booty chest, the brigand struck off and the voyage resumed', () => {
  const state = sailingState(SEED, 'pillage');
  const player = state.ships[0];
  assert.ok(player !== undefined);
  const brigand = createShip(state, { shipClass: 'sloop', allegiance: 'brigand' });
  state.ships.push(brigand);
  player.bootyCargoUnits = BOOTY_CARGO_UNITS;
  state.battle = createBattle(
    [
      { shipId: player.id, x: 1, y: 1, facing: 'north' },
      { shipId: brigand.id, x: 1, y: 20, facing: 'south' },
    ],
    false,
  );
  state.battle.outcome = 'player-won';

  const events = stepWorld(state);

  assert.equal(events.length, 1);
  assert.equal(events[0]?.type, 'cargo.plundered');
  assert.equal(state.battle, null);
  assert.deepEqual(
    state.ships.map((ship) => ship.id),
    [player.id],
  );
  assert.equal(player.bootyCargoUnits, 0);
  assert.equal(player.bootyCargo.length, 1);
  assert.deepEqual(player.cargo, [], 'a won battle put plunder straight into the hold');

  stepWorld(state);
  assert.equal(state.voyage?.legTicks, 1);
});

test('a lost battle pays no cargo but still strikes the brigand off', () => {
  const state = sailingState(SEED, 'pillage');
  const player = state.ships[0];
  assert.ok(player !== undefined);
  const brigand = createShip(state, { shipClass: 'sloop', allegiance: 'brigand' });
  state.ships.push(brigand);
  player.bootyCargoUnits = BOOTY_CARGO_UNITS;
  state.battle = createBattle(
    [
      { shipId: player.id, x: 1, y: 1, facing: 'north' },
      { shipId: brigand.id, x: 1, y: 20, facing: 'south' },
    ],
    false,
  );
  state.battle.outcome = 'player-lost';

  assert.deepEqual(stepWorld(state), []);
  assert.equal(state.battle, null);
  assert.deepEqual(
    state.ships.map((ship) => ship.id),
    [player.id],
  );
  assert.deepEqual(player.cargo, []);
});

test('a concluded battle the voyage never sailed into is left where it stands', () => {
  const state = sailingState(SEED, 'evade');
  const sailing = state.ships[0];
  assert.ok(sailing !== undefined);
  const moored = createShip(state, { shipClass: 'sloop', allegiance: 'player' });
  const brigand = createShip(state, { shipClass: 'sloop', allegiance: 'brigand' });
  state.ships.push(moored, brigand);
  moored.bootyCargoUnits = BOOTY_CARGO_UNITS;
  state.battle = createBattle(
    [
      { shipId: moored.id, x: 1, y: 1, facing: 'north' },
      { shipId: brigand.id, x: 1, y: 20, facing: 'south' },
    ],
    false,
  );
  state.battle.outcome = 'player-won';

  assert.deepEqual(stepWorld(state), []);

  assert.equal(state.battle?.outcome, 'player-won');
  assert.deepEqual(
    state.ships.map((ship) => ship.id),
    [sailing.id, moored.id, brigand.id],
  );
  assert.equal(moored.bootyCargoUnits, BOOTY_CARGO_UNITS);
  assert.deepEqual(moored.bootyCargo, []);
  assert.equal(state.voyage?.legTicks, 1);
});

test('porting settles the battle the voyage disengaged from rather than sailing on without it', () => {
  const state = sailingState(SEED, 'pillage');
  const player = state.ships[0];
  assert.ok(player !== undefined);
  const brigand = createShip(state, { shipClass: 'sloop', allegiance: 'brigand' });
  state.ships.push(brigand);
  state.battle = createBattle(
    [
      { shipId: player.id, x: 1, y: 1, facing: 'north' },
      { shipId: brigand.id, x: 1, y: 20, facing: 'south' },
    ],
    false,
  );
  state.battle.outcome = 'disengaged';

  const ported = applyWorldCommand(state, { op: 'voyage.port' });

  assert.equal(ported.status, 'accepted');
  assert.deepEqual(
    ported.status === 'accepted' ? ported.events.map((event) => event.type) : [],
    ['voyage.ported'],
  );
  assert.equal(state.battle, null);
  assert.deepEqual(
    state.ships.map((ship) => ship.id),
    [player.id],
  );
  assert.equal(state.voyage, null);
  assert.equal(state.pirate?.atIslandId, 'alkaid');
});

test('porting off a won battle takes the plunder into the chest on the way in', () => {
  const state = sailingState(SEED, 'pillage');
  const player = state.ships[0];
  assert.ok(player !== undefined);
  const brigand = createShip(state, { shipClass: 'sloop', allegiance: 'brigand' });
  state.ships.push(brigand);
  player.bootyCargoUnits = BOOTY_CARGO_UNITS;
  state.battle = createBattle(
    [
      { shipId: player.id, x: 1, y: 1, facing: 'north' },
      { shipId: brigand.id, x: 1, y: 20, facing: 'south' },
    ],
    false,
  );
  state.battle.outcome = 'player-won';

  const ported = applyWorldCommand(state, { op: 'voyage.port' });

  assert.deepEqual(
    ported.status === 'accepted' ? ported.events.map((event) => event.type) : [],
    ['cargo.plundered', 'voyage.ported'],
  );
  assert.equal(player.bootyCargoUnits, 0);
  assert.equal(player.bootyCargo.length, 1);
  assert.deepEqual(player.cargo, []);
});

test('every league point on the chart tells a pillage, a trade and an evade voyage apart', () => {
  const difficulties = LEAGUE_POINT_IDS.map((id) => leaguePointOf(id).difficultyPerMille);

  for (const difficulty of difficulties) {
    const pillage = encounterChanceOf(difficulty, 'pillage', BALANCE.world);
    const trade = encounterChanceOf(difficulty, 'trade', BALANCE.world);
    const evade = encounterChanceOf(difficulty, 'evade', BALANCE.world);

    assert.equal(evade, 0, `evade spawned at difficulty ${difficulty}`);
    assert.ok(trade > evade, `trade is an evade at difficulty ${difficulty}`);
    assert.ok(pillage > trade, `pillage is a trade at difficulty ${difficulty}`);
  }
});
