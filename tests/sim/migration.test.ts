import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SCHEMA_VERSION, Sim, deserialise } from '../../packages/sim/src/index.ts';

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
