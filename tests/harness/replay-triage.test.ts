import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import type { Replay, ReplayCheckpoint } from '../../packages/harness/src/index.ts';

import { resultOf, startHarness, type Harness } from './client.ts';

const RECORDED = fileURLToPath(
  new URL('../../packages/fixtures/replays/marker-drift.json', import.meta.url),
);
const DIVERGED = fileURLToPath(
  new URL('../../packages/fixtures/replays/marker-drift-diverged-at-tick-5.json', import.meta.url),
);

const CORRUPTED_TICK = 5;
const CORRUPTED_HASH = 'deadbeefdeadbeef';

interface ReplayFixture extends Replay {
  scenario: string;
}

let harness: Harness;

function load(path: string): ReplayFixture {
  return JSON.parse(readFileSync(path, 'utf8')) as ReplayFixture;
}

function checkpointAt(replay: ReplayFixture, tick: number): ReplayCheckpoint | undefined {
  return replay.hashTrail.find((checkpoint) => checkpoint.tick === tick);
}

async function verify(replay: ReplayFixture): Promise<Record<string, unknown>> {
  return resultOf(
    await harness.call('replay.verify', {
      seed: replay.seed,
      scenario: replay.scenario,
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

test('the diverged fixture reports the tick pp-replay-triage says it reports', async () => {
  const replay = load(DIVERGED);

  const verified = await verify(replay);

  assert.equal(verified['ok'], false);
  assert.equal(verified['divergedAtTick'], CORRUPTED_TICK);
  assert.equal(verified['finalHash'], verified['expectedHash']);
});

test('the diverged fixture differs from the recorded one in exactly one checkpoint', () => {
  const recorded = load(RECORDED);
  const diverged = load(DIVERGED);

  assert.equal(checkpointAt(diverged, CORRUPTED_TICK)?.hash, CORRUPTED_HASH);
  assert.deepEqual(diverged.commands, recorded.commands);
  assert.equal(diverged.finalHash, recorded.finalHash);
  assert.deepEqual(
    diverged.hashTrail.filter((checkpoint) => checkpoint.tick !== CORRUPTED_TICK),
    recorded.hashTrail.filter((checkpoint) => checkpoint.tick !== CORRUPTED_TICK),
  );
});
