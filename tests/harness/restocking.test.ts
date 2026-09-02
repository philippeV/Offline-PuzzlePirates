import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { TICKS_PER_TURN, createRngStreams, type WorldState } from '@opp/sim';
import { HOME_ISLAND, PILLAGE_LOOP_SCENARIO } from '../../packages/harness/src/scenarios.ts';

import { agentPlanOf, shipOf } from '../world/loop.ts';
import { resultOf, startHarness, type Harness } from './client.ts';

const SEED = 2026;
const DESTINATION = 'doyle';
const RESTOCKED_BALL = 'small-cannon-ball';
const OVERSIZED_BALL = 'large-cannon-ball';
const RESTOCKED_UNITS = 10;
const TICKS_PER_SAIL_SLICE = 600;
const MAX_VOYAGE_TICKS = 200000;

let harness: Harness;
let session: string;

before(async () => {
  harness = startHarness();
  const opened = resultOf(
    await harness.call('session.new', { seed: SEED, scenario: PILLAGE_LOOP_SCENARIO }),
  );
  session = opened['session'] as string;
});

after(async () => {
  await harness.stop();
});

async function read(pointer: string): Promise<unknown> {
  return resultOf(await harness.call('state.get', { session, pointer }))['value'];
}

async function readNumber(pointer: string): Promise<number> {
  return (await read(pointer)) as number;
}

async function dispatch(command: unknown): Promise<{ status: string; reason?: string }> {
  const dispatched = resultOf(await harness.call('sim.dispatch', { session, commands: [command] }));
  const [result] = dispatched['results'] as { status: string; reason?: string }[];
  assert.ok(result !== undefined, JSON.stringify(dispatched));
  return result;
}

async function step(ticks: number): Promise<void> {
  resultOf(await harness.call('sim.step', { session, ticks }));
}

async function pillageToDestination(): Promise<number> {
  const streams = createRngStreams();
  let ticks = 0;
  let battles = 0;
  let fighting = false;

  while (ticks < MAX_VOYAGE_TICKS) {
    const world = (await read('')) as WorldState;
    const voyage = world.voyage;
    if (voyage === null) return battles;

    if (world.battle !== null && world.battle.outcome === 'running') {
      if (!fighting) battles += 1;
      fighting = true;
      const planned = await dispatch({
        op: 'battle.plan',
        shipId: shipOf(world, 'player').id,
        plan: agentPlanOf(world, streams),
      });
      assert.equal(planned.status, 'accepted');
      await step(TICKS_PER_TURN);
      ticks += TICKS_PER_TURN;
      continue;
    }

    fighting = false;
    if (voyage.legIndex >= voyage.route.length - 1) return battles;
    await step(TICKS_PER_SAIL_SLICE);
    ticks += TICKS_PER_SAIL_SLICE;
  }

  assert.fail(`the voyage did not reach ${DESTINATION} within ${MAX_VOYAGE_TICKS} ticks`);
}

async function ballPriceAt(islandId: string): Promise<number> {
  const world = (await read('')) as WorldState;
  const dock = world.markets.find((market) => market.islandId === islandId);
  const stock = dock?.stocks.find((held) => held.commodityId === RESTOCKED_BALL);
  assert.ok(stock !== undefined, `${islandId} sells no ${RESTOCKED_BALL}`);
  return stock.sellPricePoe;
}

test('a ship that spends its magazine in a battle restocks at a dock and sails again', async () => {
  const shipId = await readNumber('/ships/0/id');
  const magazineAshore = await readNumber('/ships/0/cannonballs');

  const charted = await dispatch({
    op: 'voyage.chart',
    shipId,
    toIslandId: DESTINATION,
    voyageType: 'pillage',
  });
  assert.equal(charted.status, 'accepted');

  const battles = await pillageToDestination();
  const magazineSpent = await readNumber('/ships/0/cannonballs');

  assert.ok(battles > 0, 'the voyage met no brigand to spend the magazine on');
  assert.ok(
    magazineSpent < magazineAshore,
    `the magazine still holds ${magazineSpent} of its ${magazineAshore} balls`,
  );

  const ported = await dispatch({ op: 'voyage.port' });
  assert.equal(ported.status, 'accepted');
  assert.equal(await read('/pirate/atIslandId'), DESTINATION);

  const purseAshore = await readNumber('/pirate/poe');
  const priceEach = await ballPriceAt(DESTINATION);

  const bought = await dispatch({
    op: 'market.buy',
    shipId,
    commodityId: RESTOCKED_BALL,
    units: RESTOCKED_UNITS,
  });
  assert.equal(bought.status, 'accepted');
  assert.equal(await readNumber('/ships/0/cannonballs'), magazineSpent + RESTOCKED_UNITS);
  assert.equal(await readNumber('/pirate/poe'), purseAshore - RESTOCKED_UNITS * priceEach);

  const oversized = await dispatch({
    op: 'market.buy',
    shipId,
    commodityId: OVERSIZED_BALL,
    units: RESTOCKED_UNITS,
  });
  assert.deepEqual(oversized, { status: 'rejected', reason: 'wrong-cannon-ball-size' });

  const sailedAgain = await dispatch({
    op: 'voyage.chart',
    shipId,
    toIslandId: HOME_ISLAND,
    voyageType: 'pillage',
  });
  assert.equal(sailedAgain.status, 'accepted');
  assert.equal(await readNumber('/voyage/shipId'), shipId);
});
