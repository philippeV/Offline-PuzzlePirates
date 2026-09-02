import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import type { Replay } from '../../packages/harness/src/index.ts';
import { recordReplay, type ReplayPlan } from '../../tools/record-replay.ts';

import { resultOf, startHarness, type Harness } from './client.ts';

const FIXTURE = fileURLToPath(
  new URL('../../packages/fixtures/replays/marker-drift.json', import.meta.url),
);

const PLAN: ReplayPlan = {
  seed: 20260902,
  scenario: 'marker-field',
  commands: [
    { tick: 0, command: { op: 'marker.place', id: 1, x: 4, y: 9 } },
    { tick: 2, command: { op: 'marker.move', id: 1, dx: 1, dy: -1 } },
    { tick: 5, command: { op: 'marker.move', id: 1, dx: -2, dy: 0 } },
  ],
  lastTick: 6,
};

let harness: Harness;

function loadReplay(): Replay {
  return JSON.parse(readFileSync(FIXTURE, 'utf8')) as Replay;
}

async function verify(replay: Replay): Promise<Record<string, unknown>> {
  return resultOf(
    await harness.call('replay.verify', {
      seed: replay.seed,
      commands: replay.commands,
      hashTrail: replay.hashTrail,
      expectedHash: replay.finalHash,
    }),
  );
}

before(() => {
  harness = startHarness();
});

after(async () => {
  await harness.stop();
});

test('a trail recorded over the protocol verifies, command-carrying ticks included', async () => {
  const recorded = await recordReplay(harness, PLAN);

  const verified = await verify(recorded);

  assert.deepEqual(
    recorded.hashTrail.map((checkpoint) => checkpoint.tick),
    [0, 1, 2, 3, 4, 5, 6],
  );
  assert.equal(verified['ok'], true);
  assert.equal(verified['divergedAtTick'], null);
  assert.equal(verified['finalHash'], recorded.finalHash);
});

test('a corrupted checkpoint on a command-carrying tick is still caught', async () => {
  const recorded = await recordReplay(harness, PLAN);
  const corrupted = recorded.hashTrail[2];
  assert.ok(corrupted !== undefined);
  assert.equal(corrupted.tick, PLAN.commands[1]?.tick);
  corrupted.hash = '0000000000000000';

  const verified = await verify(recorded);

  assert.equal(verified['ok'], false);
  assert.equal(verified['divergedAtTick'], corrupted.tick);
});

test('replay.verify reproduces the recorded fixture exactly', async () => {
  const replay = loadReplay();

  const verified = await verify(replay);

  assert.equal(verified['ok'], true);
  assert.equal(verified['divergedAtTick'], null);
  assert.equal(verified['finalHash'], replay.finalHash);
  assert.equal(verified['tick'], replay.hashTrail.at(-1)?.tick);
});

test('replay.verify names the first tick whose recorded hash is wrong', async () => {
  const replay = loadReplay();
  const corrupted = replay.hashTrail[4];
  assert.ok(corrupted !== undefined);
  corrupted.hash = '0000000000000000';

  const verified = await verify(replay);

  assert.equal(verified['ok'], false);
  assert.equal(verified['divergedAtTick'], corrupted.tick);
});

test('replay.verify fails when the final hash does not match', async () => {
  const replay = loadReplay();
  replay.finalHash = '0000000000000000';

  const verified = await verify(replay);

  assert.equal(verified['ok'], false);
  assert.equal(verified['divergedAtTick'], null);
  assert.notEqual(verified['finalHash'], replay.finalHash);
});

test('replay.verify catches a command log that no longer reproduces the trail', async () => {
  const replay = loadReplay();
  const moved = replay.commands[1];
  assert.ok(moved !== undefined);
  moved.tick += 1;

  const verified = await verify(replay);

  assert.equal(verified['ok'], false);
  assert.equal(verified['divergedAtTick'], 3);
});
