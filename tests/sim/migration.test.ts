import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { NO_SHAPE, SCHEMA_VERSION, Sim, deserialise } from '../../packages/sim/src/index.ts';

const COMMITTED_V2_SAVE = fileURLToPath(
  new URL('../../packages/fixtures/saves/marker-field-v2.json', import.meta.url),
);
const COMMITTED_V2_SCHEMA = 2;
const COMMITTED_V2_SEED = 0xc0ffee;
const COMMITTED_V2_TICK = 6;

const COMMITTED_V3_SAVE = fileURLToPath(
  new URL('../../packages/fixtures/saves/bilge-session-v3.json', import.meta.url),
);
const COMMITTED_V3_SCHEMA = 3;
const COMMITTED_V3_TICK = 28;
const COMMITTED_V3_MOVES = 4;
const COMMITTED_V3_CELLS = 144;

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
  assert.equal(raw['schemaVersion'], COMMITTED_V2_SCHEMA);
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

test('the committed schema version three save carries a puzzle with no shapes and no meter', () => {
  const raw = JSON.parse(committedV3Save()) as Record<string, unknown>;
  const puzzle = raw['puzzle'] as Record<string, unknown>;
  const board = puzzle['board'] as Record<string, unknown>;

  assert.equal(raw['schemaVersion'], COMMITTED_V3_SCHEMA);
  assert.equal((board['cells'] as unknown[]).length, COMMITTED_V3_CELLS);
  assert.equal('shapes' in board, false);
  assert.equal('maneuverBar' in puzzle, false);
});

test('the committed schema version three save gains a bare shape layer and an empty meter', () => {
  const migrated = deserialise(committedV3Save());
  const puzzle = migrated.puzzle;

  assert.equal(migrated.schemaVersion, SCHEMA_VERSION);
  assert.equal(migrated.tick, COMMITTED_V3_TICK);
  assert.notEqual(puzzle, null);
  assert.equal(puzzle?.moves, COMMITTED_V3_MOVES);
  assert.equal(puzzle?.maneuverBar, 0);
  assert.equal(puzzle?.board.shapes.length, puzzle?.board.cells.length);
  assert.deepEqual(
    puzzle?.board.shapes,
    new Array<number>(puzzle?.board.cells.length ?? 0).fill(NO_SHAPE),
  );
});

test('a migrated schema version three save round-trips through save and load unchanged', () => {
  const loaded = Sim.load(committedV3Save());
  const reloaded = Sim.load(loaded.save());

  assert.equal(reloaded.hash(), loaded.hash());
  assert.deepEqual(reloaded.state, loaded.state);
});

test('a schema version three save with no puzzle running migrates untouched', () => {
  const sim = Sim.create({ seed: COMMITTED_V2_SEED });
  sim.step(COMMITTED_V2_TICK);

  const migrated = deserialise(saveAtSchemaVersion(SCHEMA_VERSION - 1));

  assert.equal(migrated.puzzle, null);
  assert.deepEqual(migrated, sim.state);
});
