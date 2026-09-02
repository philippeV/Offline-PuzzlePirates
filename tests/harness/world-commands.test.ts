import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import type { Command } from '../../packages/sim/src/index.ts';

import { reasonOf, resultOf, startHarness, type Harness } from './client.ts';

const SESSION_SEED = 0x0cea;
const COMMAND_STATUSES = ['accepted', 'rejected'];

const WELL_SHAPED: Command[] = [
  { op: 'world.start', islandId: 'alkaid' },
  { op: 'voyage.chart', shipId: 1, toIslandId: 'doyle', voyageType: 'trade' },
  { op: 'voyage.port' },
  { op: 'market.buy', shipId: 1, commodityId: 'wood', units: 3 },
  { op: 'market.sell', shipId: 1, commodityId: 'wood', units: 0 },
  { op: 'booty.divide', shipId: 1 },
];

const MALFORMED: Record<string, unknown>[] = [
  { op: 'world.start' },
  { op: 'world.start', islandId: 7 },
  { op: 'voyage.chart', shipId: 1, toIslandId: 'doyle' },
  { op: 'voyage.chart', shipId: '1', toIslandId: 'doyle', voyageType: 'trade' },
  { op: 'voyage.chart', shipId: 1, toIslandId: 'doyle', voyageType: null },
  { op: 'market.buy', shipId: 1, commodityId: 'wood', units: -1 },
  { op: 'market.buy', shipId: 1, commodityId: 'wood', units: 1.5 },
  { op: 'market.sell', shipId: 1, commodityId: 'wood' },
  { op: 'market.sell', shipId: 1, commodityId: 3, units: 1 },
  { op: 'booty.divide' },
];

let harness: Harness;
let session: string;

async function dispatch(command: unknown): Promise<Record<string, unknown>> {
  return resultOf(await harness.call('sim.dispatch', { session, commands: [command] }));
}

before(async () => {
  harness = startHarness();
  const opened = resultOf(await harness.call('session.new', { seed: SESSION_SEED }));
  session = opened['session'] as string;
});

after(async () => {
  await harness.stop();
});

for (const command of WELL_SHAPED) {
  test(`${command.op} reaches the simulation as a parsed command`, async () => {
    const dispatched = await dispatch(command);

    const results = dispatched['results'] as { status: string; reason?: string }[];
    assert.equal(results.length, 1);
    assert.ok(COMMAND_STATUSES.includes(results[0]?.status ?? ''), JSON.stringify(results[0]));
  });
}

for (const command of MALFORMED) {
  test(`the malformed command ${JSON.stringify(command)} is refused`, async () => {
    const response = await harness.call('sim.dispatch', { session, commands: [command] });

    assert.equal(reasonOf(response), 'invalid-params');
  });
}

test('a malformed command refuses the whole batch, leaving the session untouched', async () => {
  const hashBefore = resultOf(await harness.call('sim.dispatch', { session, commands: [] }));

  const response = await harness.call('sim.dispatch', {
    session,
    commands: [{ op: 'voyage.port' }, { op: 'booty.divide' }],
  });
  const hashAfter = resultOf(await harness.call('sim.dispatch', { session, commands: [] }));

  assert.equal(reasonOf(response), 'invalid-params');
  assert.equal(hashAfter['stateHash'], hashBefore['stateHash']);
});
