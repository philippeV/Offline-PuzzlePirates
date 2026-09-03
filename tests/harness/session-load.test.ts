import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { SCHEMA_VERSION, Sim } from '../../packages/sim/src/index.ts';

import { reasonOf, resultOf, startHarness, type Harness } from './client.ts';

const SESSION_SEED = 0x5a7e;
const PLAYED_TICKS = 12;

const UNLOADABLE_SAVES = ['{', '{}', '{"schemaVersion":5}', '{"schemaVersion":999}'];

let harness: Harness;

function playedSim(): Sim {
  const sim = Sim.create({ seed: SESSION_SEED });
  sim.step(PLAYED_TICKS);
  return sim;
}

async function load(save: string): Promise<Record<string, unknown>> {
  return resultOf(await harness.call('session.load', { save }));
}

before(() => {
  harness = startHarness();
});

after(async () => {
  await harness.stop();
});

test('a save loaded over the protocol carries the tick and hash it was taken at', async () => {
  const sim = playedSim();

  const loaded = await load(sim.save());

  assert.equal(loaded['schemaVersion'], SCHEMA_VERSION);
  assert.equal(loaded['tick'], sim.state.tick);
  assert.equal(loaded['stateHash'], sim.hash());
});

test('the same save loads into two independent sessions that agree on the hash', async () => {
  const save = playedSim().save();

  const first = await load(save);
  const second = await load(save);

  assert.notEqual(first['session'], second['session']);
  assert.equal(first['stateHash'], second['stateHash']);
});

test('a session loaded from a save keeps stepping from the tick it was saved at', async () => {
  const sim = playedSim();
  const loaded = await load(sim.save());

  const stepped = resultOf(
    await harness.call('sim.step', { session: loaded['session'], ticks: PLAYED_TICKS }),
  );
  sim.step(PLAYED_TICKS);

  assert.equal(stepped['tick'], sim.state.tick);
  assert.equal(stepped['stateHash'], sim.hash());
});

for (const save of UNLOADABLE_SAVES) {
  test(`the save ${save} is refused as invalid params`, async () => {
    assert.equal(reasonOf(await harness.call('session.load', { save })), 'invalid-params');
  });
}

test('a save of the wrong type is refused as invalid params', async () => {
  assert.equal(reasonOf(await harness.call('session.load', { save: 7 })), 'invalid-params');
  assert.equal(reasonOf(await harness.call('session.load', {})), 'invalid-params');
});

test('the harness still serves sessions after refusing every unloadable save', async () => {
  const opened = resultOf(await harness.call('session.new', { seed: SESSION_SEED }));

  assert.equal(typeof opened['session'], 'string');
  assert.equal(opened['tick'], 0);
});
