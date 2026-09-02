import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { SCHEMA_VERSION, Sim, deserialise, hashCanonical } from '../../packages/sim/src/index.ts';
import { BILGE_SCENARIO, createScenarioSim } from '../../packages/harness/src/scenarios.ts';

const COMMITTED_V2_SAVE = fileURLToPath(
  new URL('../../packages/fixtures/saves/marker-field-v2.json', import.meta.url),
);
const COMMITTED_V2_SEED = 0xc0ffee;
const COMMITTED_V2_TICK = 6;
const COMMITTED_V3_SAVE = fileURLToPath(
  new URL('../../packages/fixtures/saves/bilge-session-v3.json', import.meta.url),
);
const COMMITTED_V3_SEED = 20260902;
const COMMITTED_V3_TICK = 120;

function committedV2Save(): string {
  return readFileSync(COMMITTED_V2_SAVE, 'utf8');
}

function committedV3Save(): string {
  return readFileSync(COMMITTED_V3_SAVE, 'utf8');
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
  assert.equal(raw['schemaVersion'], 2);
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

test('the committed schema version three save migrates forward to the current schema', () => {
  const saved = committedV3Save();
  const raw = JSON.parse(saved) as Record<string, unknown>;
  assert.equal(raw['schemaVersion'], 3);
  assert.equal('ships' in raw, false);
  assert.equal('battle' in raw, false);

  const migrated = deserialise(saved);

  assert.equal(migrated.schemaVersion, SCHEMA_VERSION);
  assert.deepEqual(migrated.ships, []);
  assert.equal(migrated.battle, null);
});

test('migrating a schema version three save keeps everything it already carried', () => {
  const raw = JSON.parse(committedV3Save()) as Record<string, unknown>;

  const migrated = deserialise(committedV3Save());

  assert.equal(migrated.tick, raw['tick']);
  assert.equal(migrated.seed, raw['seed']);
  assert.notEqual(migrated.puzzle, null);
  assert.equal(migrated.balance, null);
  assert.deepEqual(migrated.rngStreams, raw['rngStreams']);
});

test('the committed schema version three save is a genuine schema version three artefact', () => {
  const raw = JSON.parse(committedV3Save()) as Record<string, unknown>;

  assert.equal(raw['seed'], COMMITTED_V3_SEED);
  assert.equal(raw['tick'], COMMITTED_V3_TICK);
  assert.deepEqual(Object.keys(raw['balance'] as object), ['bilging']);
});

test('a migrated schema version three save is the run it was taken from, minus its balance', () => {
  const sim = createScenarioSim(COMMITTED_V3_SEED, BILGE_SCENARIO);
  sim.step(COMMITTED_V3_TICK);
  const expected = { ...sim.state, balance: null };

  const loaded = Sim.load(committedV3Save());

  assert.equal(loaded.hash(), hashCanonical(expected));
  assert.deepEqual(loaded.state, expected);
});

test('a migrated schema version three save steps a commissioned ship without a torn tick', () => {
  const loaded = Sim.load(committedV3Save());
  const commissioned = loaded.dispatch({
    op: 'ship.commission',
    shipClass: 'sloop',
    allegiance: 'player',
  });
  assert.equal(commissioned.status, 'accepted');
  const beforeStep = structuredClone(loaded.state.ships);

  loaded.step(1);

  assert.equal(loaded.state.tick, COMMITTED_V3_TICK + 1);
  assert.deepEqual(loaded.state.ships, beforeStep);
});

test('a schema version two save migrates through every registered step to the current one', () => {
  const migrated = deserialise(committedV2Save());

  assert.equal(migrated.schemaVersion, SCHEMA_VERSION);
  assert.equal(migrated.balance, null);
  assert.equal(migrated.puzzle, null);
  assert.deepEqual(migrated.ships, []);
  assert.equal(migrated.battle, null);
});
