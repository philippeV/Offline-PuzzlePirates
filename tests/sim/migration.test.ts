import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { SCHEMA_VERSION, Sim, deserialise } from '../../packages/sim/src/index.ts';

const COMMITTED_V2_SAVE = fileURLToPath(
  new URL('../../packages/fixtures/saves/marker-field-v2.json', import.meta.url),
);
const COMMITTED_V2_SEED = 0xc0ffee;
const COMMITTED_V2_TICK = 6;

function committedV2Save(): string {
  return readFileSync(COMMITTED_V2_SAVE, 'utf8');
}

function saveAtSchemaVersion(version: number): string {
  const sim = Sim.create({ seed: 0xc0ffee });
  sim.step(6);
  return JSON.stringify({ ...sim.state, schemaVersion: version });
}

test('an older save is migrated forward to the current schema version', () => {
  const migrated = deserialise(saveAtSchemaVersion(SCHEMA_VERSION - 1));

  assert.equal(migrated.schemaVersion, SCHEMA_VERSION);
  assert.equal(migrated.tick, 6);
});

test('the no-op migration preserves the hash of a current save', () => {
  const sim = Sim.create({ seed: 0xc0ffee });
  sim.step(6);
  const migrated = Sim.load(saveAtSchemaVersion(SCHEMA_VERSION - 1));

  assert.equal(migrated.hash(), sim.hash());
});

test('a save with no registered migration is refused', () => {
  assert.throws(() => deserialise(saveAtSchemaVersion(0)), /no migration registered/);
});

test('a save from a newer schema version is refused', () => {
  assert.throws(() => deserialise(saveAtSchemaVersion(SCHEMA_VERSION + 1)), /newer than/);
});

test('the committed schema version two save migrates forward to the current schema', () => {
  const saved = committedV2Save();
  const raw = JSON.parse(saved) as Record<string, unknown>;
  assert.equal(raw['schemaVersion'], SCHEMA_VERSION - 1);
  assert.equal('balance' in raw, false);
  assert.equal('puzzle' in raw, false);

  const migrated = deserialise(saved);

  assert.equal(migrated.schemaVersion, SCHEMA_VERSION);
  assert.equal(migrated.tick, COMMITTED_V2_TICK);
  assert.equal(migrated.balance, null);
  assert.equal(migrated.puzzle, null);
});

test('a migrated schema version two save hashes as the run it was taken from', () => {
  const sim = Sim.create({ seed: COMMITTED_V2_SEED });
  sim.step(COMMITTED_V2_TICK);

  const loaded = Sim.load(committedV2Save());

  assert.equal(loaded.hash(), sim.hash());
  assert.deepEqual(loaded.state, sim.state);
});
