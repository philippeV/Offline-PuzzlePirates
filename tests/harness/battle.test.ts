import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import {
  BATTLE_BOARD_HEIGHT,
  BATTLE_BOARD_WIDTH,
  PHASES_PER_TURN,
  TICKS_PER_TURN,
  createRngStreams,
  damagePerMilleOf,
  findShip,
  idlePlan,
  planBrigandTurn,
  rngStream,
  type BattleEndedEvent,
  type BattlePhasePlan,
  type BattleShip,
  type RngStreams,
  type ShipState,
  type Sim,
  type SimEvent,
  type WorldState,
} from '@opp/sim';
import { BALANCE } from '../../packages/harness/src/balance.ts';
import { SEA_BATTLE_SCENARIO, createScenarioSim } from '../../packages/harness/src/scenarios.ts';

import { reasonOf, resultOf, startHarness, type Harness } from './client.ts';

const AGENT_PLAN_STREAM = 'agent.plan';
const MAXIMUM_TURNS = 120;
const OUTCOME_SEEDS = 24;
const SEED = 20260902;

let harness: Harness;

before(() => {
  harness = startHarness();
});

after(async () => {
  await harness.stop();
});

function shipOf(state: WorldState, allegiance: string): ShipState {
  const ship = state.ships.find((crewed) => crewed.allegiance === allegiance);
  assert.ok(ship !== undefined, `no ${allegiance} ship`);
  return ship;
}

function stationOf(state: WorldState, allegiance: string): BattleShip {
  const ships = state.battle?.ships ?? [];
  const ship = ships.find(
    (crewed) => findShip(state.ships, crewed.shipId)?.allegiance === allegiance,
  );
  assert.ok(ship !== undefined, `no ${allegiance} ship on the board`);
  return ship;
}

function agentPlanOf(state: WorldState, streams: RngStreams): BattlePhasePlan[] {
  const me = stationOf(state, 'player');
  const foe = stationOf(state, 'brigand');
  const hull = shipOf(state, 'player');
  return planBrigandTurn(
    state.battle?.board ?? { width: 0, height: 0, tiles: [] },
    {
      shipId: me.shipId,
      shipClass: hull.shipClass,
      x: me.x,
      y: me.y,
      facing: me.facing,
      tokens: me.tokens,
      cannonsLoaded: hull.cannonsLoaded,
      damagePerMille: damagePerMilleOf(hull),
    },
    { shipId: foe.shipId, x: foe.x, y: foe.y, facing: foe.facing },
    BALANCE.brigand,
    rngStream(state.seed, streams, AGENT_PLAN_STREAM),
  );
}

function isBattleEnded(event: SimEvent): event is BattleEndedEvent {
  return event.type === 'battle.ended';
}

function driveToEnd(sim: Sim): BattleEndedEvent | null {
  const streams = createRngStreams();
  for (let turn = 0; turn < MAXIMUM_TURNS; turn += 1) {
    const state = sim.state as WorldState;
    if (state.battle === null || state.battle.outcome !== 'running') break;
    const planned = sim.dispatch({
      op: 'battle.plan',
      shipId: stationOf(state, 'player').shipId,
      plan: agentPlanOf(state, streams),
    });
    assert.equal(planned.status, 'accepted');
    const ended = sim.step(TICKS_PER_TURN).find(isBattleEnded);
    if (ended !== undefined) return ended;
  }
  return null;
}

test('an agent drives a sloop against a brigand to both a win and a loss, headlessly', () => {
  const outcomes = new Map<string, number>();
  for (let seed = 1; seed <= OUTCOME_SEEDS; seed += 1) {
    const ended = driveToEnd(createScenarioSim(seed * 7919, SEA_BATTLE_SCENARIO));
    const outcome = ended === null ? 'unresolved' : ended.outcome;
    outcomes.set(outcome, (outcomes.get(outcome) ?? 0) + 1);
  }
  assert.ok((outcomes.get('player-won') ?? 0) > 0, `never won: ${JSON.stringify([...outcomes])}`);
  assert.ok((outcomes.get('player-lost') ?? 0) > 0, `never lost: ${JSON.stringify([...outcomes])}`);
  const unresolved = outcomes.get('unresolved') ?? 0;
  assert.equal(unresolved, 0, `unresolved battles: ${JSON.stringify([...outcomes])}`);
});

test('a won battle pays booty out of the hold the brigand was carrying', () => {
  for (let seed = 1; seed <= OUTCOME_SEEDS; seed += 1) {
    const sim = createScenarioSim(seed * 7919, SEA_BATTLE_SCENARIO);
    const ended = driveToEnd(sim);
    if (ended === null || ended.outcome !== 'player-won') continue;
    const state = sim.state as WorldState;
    const player = shipOf(state, 'player');
    const brigand = shipOf(state, 'brigand');
    assert.ok(ended.bootyPoe > 0);
    assert.equal(ended.bootyCargoUnits, BALANCE.booty.brigandCargoUnitsBase);
    assert.equal(brigand.cargoUnits, 0);
    assert.equal(player.bootyCargoUnits, ended.bootyCargoUnits);
    assert.equal(player.bootyPoe + player.poe, ended.bootyPoe);
    return;
  }
  assert.fail('no seed produced a win');
});

test('a lost battle pays no booty', () => {
  for (let seed = 1; seed <= OUTCOME_SEEDS; seed += 1) {
    const ended = driveToEnd(createScenarioSim(seed * 7919, SEA_BATTLE_SCENARIO));
    if (ended === null || ended.outcome !== 'player-lost') continue;
    assert.equal(ended.bootyPoe, 0);
    assert.equal(ended.bootyCargoUnits, 0);
    assert.equal(ended.chartDropped, false);
    return;
  }
  assert.fail('no seed produced a loss');
});

test('the sea-battle scenario opens two sloops on a 24 by 24 board', async () => {
  const opened = resultOf(
    await harness.call('session.new', { seed: SEED, scenario: SEA_BATTLE_SCENARIO }),
  );
  const session = opened['session'];
  const board = resultOf(await harness.call('state.get', { session, pointer: '/battle/board' }))[
    'value'
  ] as { width: number; height: number; tiles: unknown[] };
  const ships = resultOf(await harness.call('state.get', { session, pointer: '/ships' }))[
    'value'
  ] as ShipState[];

  assert.equal(board.width, BATTLE_BOARD_WIDTH);
  assert.equal(board.height, BATTLE_BOARD_HEIGHT);
  assert.equal(board.tiles.length, BATTLE_BOARD_WIDTH * BATTLE_BOARD_HEIGHT);
  assert.deepEqual(
    ships.map((ship) => [ship.shipClass, ship.allegiance, ship.playerStation]),
    [
      ['sloop', 'player', 'bilging'],
      ['sloop', 'brigand', null],
    ],
  );
});

test('the board reserves the water each ship must sail through to leave its berth', async () => {
  for (let seed = 1; seed <= OUTCOME_SEEDS; seed += 1) {
    const sim = createScenarioSim(seed * 7919, SEA_BATTLE_SCENARIO);
    const state = sim.state as WorldState;
    const board = state.battle?.board;
    assert.ok(board !== undefined);
    for (const ship of state.battle?.ships ?? []) {
      const step = ship.facing === 'north' ? -1 : 1;
      for (const y of [ship.y, ship.y + step, ship.y + step * 2]) {
        assert.equal(board.tiles[y * board.width + ship.x]?.kind, 'open', `seed ${seed}`);
      }
    }
  }
});

test('a plan the ship cannot afford or the class cannot fly is refused', async () => {
  const opened = resultOf(
    await harness.call('session.new', { seed: SEED, scenario: SEA_BATTLE_SCENARIO }),
  );
  const session = opened['session'];
  const ships = resultOf(await harness.call('state.get', { session, pointer: '/ships' }))[
    'value'
  ] as ShipState[];
  const shipId = ships[0]?.id;

  const refusalOf = async (plan: BattlePhasePlan[]): Promise<string> => {
    const dispatched = resultOf(
      await harness.call('sim.dispatch', {
        session,
        commands: [{ op: 'battle.plan', shipId, plan }],
      }),
    );
    const results = dispatched['results'] as { status: string; reason?: string }[];
    return results[0]?.reason ?? results[0]?.status ?? 'missing';
  };

  assert.equal(await refusalOf(idlePlan().slice(1)), 'plan-wrong-length');
  assert.equal(await refusalOf(withMove({ kind: 'rest' })), 'plan-move-budget');
  assert.equal(
    await refusalOf(withFire({ kind: 'guns', side: 'port', count: 9 })),
    'too-many-shots',
  );
  assert.equal(
    await refusalOf(withMove({ kind: 'move', token: 'forward' })),
    'no-movement-token',
  );
  assert.equal(await refusalOf(idlePlan()), 'accepted');
});

test('a battle command outside a battle is refused, and an unknown ship with it', async () => {
  const opened = resultOf(await harness.call('session.new', { seed: SEED }));
  const session = opened['session'];
  const outside = await harness.call('sim.dispatch', {
    session,
    commands: [{ op: 'battle.plan', shipId: 1, plan: idlePlan() }],
  });
  const results = resultOf(outside)['results'] as { reason?: string }[];
  assert.equal(results[0]?.reason, 'no-battle-running');

  const battling = resultOf(
    await harness.call('session.new', { seed: SEED, scenario: SEA_BATTLE_SCENARIO }),
  );
  const unknown = resultOf(
    await harness.call('sim.dispatch', {
      session: battling['session'],
      commands: [{ op: 'battle.disengage', shipId: 999 }],
    }),
  );
  assert.equal((unknown['results'] as { reason?: string }[])[0]?.reason, 'unknown-ship');
});

test('disengaging is refused until the counter has run down', async () => {
  const opened = resultOf(
    await harness.call('session.new', { seed: SEED, scenario: SEA_BATTLE_SCENARIO }),
  );
  const session = opened['session'];
  const ships = resultOf(await harness.call('state.get', { session, pointer: '/ships' }))[
    'value'
  ] as ShipState[];
  const shipId = ships[0]?.id;

  const early = resultOf(
    await harness.call('sim.dispatch', {
      session,
      commands: [{ op: 'battle.disengage', shipId }],
    }),
  );
  assert.equal((early['results'] as { reason?: string }[])[0]?.reason, 'disengage-not-ready');
});

test('an unknown ship class cannot be commissioned', async () => {
  const opened = resultOf(await harness.call('session.new', { seed: SEED }));
  const refused = await harness.call('sim.dispatch', {
    session: opened['session'],
    commands: [{ op: 'ship.commission', shipClass: 'raft', allegiance: 'player' }],
  });
  assert.equal(reasonOf(refused), 'invalid-params');
});

function withFire(fire: BattlePhasePlan['fire']): BattlePhasePlan[] {
  const plan = idlePlan();
  const first = plan[0];
  if (first !== undefined) first.fire = fire;
  return plan;
}

function withMove(move: BattlePhasePlan['move']): BattlePhasePlan[] {
  const plan = idlePlan();
  const first = plan[0];
  if (first !== undefined) first.move = move;
  assert.equal(plan.length, PHASES_PER_TURN);
  return plan;
}
