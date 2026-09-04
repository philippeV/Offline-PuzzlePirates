import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  cargoLotsMassKgOf,
  isShipSupply,
  magazineMassKgOf,
  shipClassOf,
  type ShipState,
  type Sim,
  type WorldState,
} from '@opp/sim';

import {
  HOME_ISLAND,
  PILLAGE_LOOP_SCENARIO,
  createScenarioSim,
} from '../../packages/harness/src/index.ts';

import { sailToDestination, shipOf } from './loop.ts';

const SOAK_SEEDS = 12;
const SEED_STRIDE = 7919;
const DESTINATION = 'doyle';
const TRADED_COMMODITY = 'sugar-cane';
const TRADED_UNITS = 40;
const MAX_VOYAGE_TICKS = 4000000;

type VoyageOutcome = 'won' | 'lost' | 'no-encounter' | 'stuck';

interface SoakRun {
  seed: number;
  outcome: VoyageOutcome;
  battles: number;
  chestPoe: number;
  tradeProfitPoe: number;
  portedAt: string | null;
  battleRunning: boolean;
  breaches: string[];
  supplyLots: string[];
}

let soaked: SoakRun[] | null = null;

function soak(): SoakRun[] {
  soaked ??= seeds().map(runVoyage);
  return soaked;
}

function seeds(): number[] {
  return Array.from({ length: SOAK_SEEDS }, (_, index) => (index + 1) * SEED_STRIDE);
}

function stateOf(sim: Sim): WorldState {
  return sim.state as WorldState;
}

function purseOf(sim: Sim): number {
  return stateOf(sim).pirate?.poe ?? 0;
}

function runVoyage(seed: number): SoakRun {
  const sim = createScenarioSim(seed, PILLAGE_LOOP_SCENARIO);
  const ship = shipOf(stateOf(sim), 'player');
  assert.equal(stateOf(sim).pirate?.atIslandId, HOME_ISLAND);
  const openingPurse = purseOf(sim);

  assert.equal(
    sim.dispatch({
      op: 'market.buy',
      shipId: ship.id,
      commodityId: TRADED_COMMODITY,
      units: TRADED_UNITS,
    }).status,
    'accepted',
  );
  assert.equal(
    sim.dispatch({
      op: 'voyage.chart',
      shipId: ship.id,
      toIslandId: DESTINATION,
      voyageType: 'pillage',
    }).status,
    'accepted',
  );
  assert.equal(sim.dispatch({ op: 'voyage.sail' }).status, 'accepted');

  const sailed = sail(sim);
  if (sailed === null) {
    return {
      seed,
      outcome: 'stuck',
      battles: 0,
      chestPoe: 0,
      tradeProfitPoe: 0,
      portedAt: null,
      battleRunning: stateOf(sim).battle?.outcome === 'running',
      breaches: breachesOf(stateOf(sim), ship),
      supplyLots: supplyLotsOf(stateOf(sim)),
    };
  }

  assert.equal(sim.dispatch({ op: 'voyage.port' }).status, 'accepted');
  assert.equal(
    sim.dispatch({
      op: 'market.sell',
      shipId: ship.id,
      commodityId: TRADED_COMMODITY,
      units: TRADED_UNITS,
    }).status,
    'accepted',
  );

  const chestPoe = ship.bootyPoe;
  const tradeProfitPoe = purseOf(sim) - openingPurse;
  if (chestPoe > 0) {
    assert.equal(sim.dispatch({ op: 'booty.divide', shipId: ship.id }).status, 'accepted');
  }

  return {
    seed,
    outcome: outcomeOf(sailed, chestPoe),
    battles: sailed,
    chestPoe,
    tradeProfitPoe,
    portedAt: stateOf(sim).pirate?.atIslandId ?? null,
    battleRunning: stateOf(sim).battle?.outcome === 'running',
    breaches: breachesOf(stateOf(sim), ship),
    supplyLots: supplyLotsOf(stateOf(sim)),
  };
}

function sail(sim: Sim): number | null {
  try {
    return sailToDestination(sim, MAX_VOYAGE_TICKS).battles;
  } catch {
    return null;
  }
}

function outcomeOf(battles: number, chestPoe: number): VoyageOutcome {
  if (battles === 0) return 'no-encounter';
  return chestPoe > 0 ? 'won' : 'lost';
}

function breachesOf(state: WorldState, ship: ShipState): string[] {
  const breaches: string[] = [];
  const purse = state.pirate?.poe ?? 0;
  if (purse < 0) breaches.push(`purse ${purse}`);
  if (ship.poe < 0) breaches.push(`hold poe ${ship.poe}`);
  if (ship.bootyPoe < 0) breaches.push(`chest ${ship.bootyPoe}`);
  if (ship.cargoUnits < 0) breaches.push(`cargo units ${ship.cargoUnits}`);
  if (ship.bootyCargoUnits < 0) breaches.push(`booty cargo ${ship.bootyCargoUnits}`);
  for (const lot of ship.cargo) {
    if (lot.units < 0) breaches.push(`${lot.commodityId} lot ${lot.units}`);
  }
  for (const market of state.markets) {
    for (const stock of market.stocks) {
      if (stock.units < 0) {
        breaches.push(`${market.islandId} ${stock.commodityId} stock ${stock.units}`);
      }
    }
  }
  const laden = ladenKgOf(ship);
  const capacity = shipClassOf(ship.shipClass).holdMassKg;
  if (laden > capacity) breaches.push(`hold ${laden}kg over ${capacity}kg`);
  return breaches;
}

function supplyLotsOf(state: WorldState): string[] {
  const stowed: string[] = [];
  for (const ship of state.ships) {
    for (const lot of [...ship.cargo, ...ship.bootyCargo]) {
      if (isShipSupply(lot.commodityId)) stowed.push(`${ship.id} ${lot.commodityId}`);
    }
  }
  return stowed;
}

function ladenKgOf(ship: ShipState): number {
  return (
    ship.cargoUnits +
    ship.bootyCargoUnits +
    cargoLotsMassKgOf(ship.cargo) +
    cargoLotsMassKgOf(ship.bootyCargo) +
    magazineMassKgOf(ship)
  );
}

function tallyOf(runs: SoakRun[]): Map<VoyageOutcome, number> {
  const tally = new Map<VoyageOutcome, number>();
  for (const run of runs) tally.set(run.outcome, (tally.get(run.outcome) ?? 0) + 1);
  return tally;
}

test('the pillage loop is winnable but not a guaranteed payout across the soak seeds', () => {
  const runs = soak();

  const tally = tallyOf(runs);

  const printed = JSON.stringify([...tally]);
  assert.ok((tally.get('won') ?? 0) > 0, `no seed filled the booty chest: ${printed}`);
  assert.ok((tally.get('won') ?? 0) < runs.length, `every seed paid out: ${printed}`);
  assert.ok(
    runs.some((run) => run.outcome === 'won' && run.chestPoe > 0),
    `no won voyage carried booty home: ${printed}`,
  );
});

test('every soak voyage terminates with its battle resolved and its pirate in port', () => {
  const runs = soak();

  const stalled = runs.filter(
    (run) => run.outcome === 'stuck' || run.battleRunning || run.portedAt !== DESTINATION,
  );

  assert.deepEqual(
    stalled.map((run) => `${run.seed} ${run.outcome} at ${run.portedAt}`),
    [],
    `voyages that never resolved: ${JSON.stringify([...tallyOf(runs)])}`,
  );
});

test('carrying cargo from the home island to the destination pays on every soak seed', () => {
  const runs = soak();

  const unprofitable = runs.filter((run) => run.tradeProfitPoe <= 0);

  assert.deepEqual(
    unprofitable.map((run) => `${run.seed} ${run.tradeProfitPoe}`),
    [],
    `${TRADED_UNITS} ${TRADED_COMMODITY} carried ${HOME_ISLAND} to ${DESTINATION} paid nothing`,
  );
});

test('no soak run ends with negative poe, negative stock, negative cargo or an overfull hold', () => {
  const runs = soak();

  const broken = runs.filter((run) => run.breaches.length > 0);

  assert.deepEqual(
    broken.map((run) => `${run.seed}: ${run.breaches.join(', ')}`),
    [],
    `invariants broken across ${runs.length} seeds`,
  );
});

test('no soak run ends with a ship supply stowed as a cargo lot on any ship', () => {
  const runs = soak();

  const stowed = runs.filter((run) => run.supplyLots.length > 0);

  assert.deepEqual(
    stowed.map((run) => `${run.seed}: ${run.supplyLots.join(', ')}`),
    [],
    `ship supplies reached a hold or a chest across ${runs.length} seeds`,
  );
});
