import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  SCHEMA_VERSION,
  Sim,
  canonicalJson,
  type Command,
  type ShipClassId,
  type Snapshot,
  type WorldState,
} from '../../packages/sim/src/index.ts';
import { PILLAGE_LOOP_SCENARIO, createScenarioSim } from '../../packages/harness/src/scenarios.ts';

interface SpoiltSave {
  what: string;
  spoil: (state: WorldState) => void;
  message: string;
}

const VOYAGING_SEED = 20260903;
const PLAYER_SHIP_ID = 2;
const UNCREWED_SHIP_ID = 99;
const UNCHARTED_LEAGUE_POINT = 999;

const COMMITTED_SAVES = ['marker-field-v2', 'bilge-session-v3', 'bilge-session-v5'].map(
  committedSavePath,
);
const COMMITTED_BILGE_SAVE = committedSavePath('bilge-session-v3');

const SPOILT_SAVES: SpoiltSave[] = [
  {
    what: 'a puzzle carrying no scoring frame',
    spoil: (state) => {
      state.puzzle = without(state.puzzle!, 'frame');
    },
    message: 'save.puzzle.frame must hold an object',
  },
  {
    what: 'a board holding fewer cells than its width and height',
    spoil: (state) => {
      state.puzzle!.board.cells.pop();
    },
    message: 'save.puzzle.board.cells must hold width * height cells',
  },
  {
    what: 'a board holding fewer shapes than cells',
    spoil: (state) => {
      state.puzzle!.board.shapes.pop();
    },
    message: 'save.puzzle.board.shapes must hold one shape per cell',
  },
  {
    what: 'a board whose width is not a whole number',
    spoil: (state) => {
      state.puzzle!.board.width = 0.5;
    },
    message: 'save.puzzle.board.width must hold a safe integer',
  },
  {
    what: 'a balance carrying no bilging block',
    spoil: (state) => {
      state.balance = without(state.balance!, 'bilging');
    },
    message: 'save.balance.bilging must hold an object',
  },
  {
    what: 'a balance carrying no battle block',
    spoil: (state) => {
      state.balance = without(state.balance!, 'battle');
    },
    message: 'save.balance.battle must hold an object',
  },
  {
    what: 'a balance carrying no npc block',
    spoil: (state) => {
      state.balance = without(state.balance!, 'npc');
    },
    message: 'save.balance.npc must hold an object',
  },
  {
    what: 'a balance carrying no ship block',
    spoil: (state) => {
      state.balance = without(state.balance!, 'ship');
    },
    message: 'save.balance.ship must hold an object',
  },
  {
    what: 'a ship of no known class',
    spoil: (state) => {
      state.ships[1]!.shipClass = 'toString' as ShipClassId;
    },
    message: 'save.ships[1].shipClass must hold a known ship class',
  },
  {
    what: 'a voyage routed through an unknown league point',
    spoil: (state) => {
      state.voyage!.route[1] = UNCHARTED_LEAGUE_POINT;
    },
    message: 'save.voyage.route[1] must hold a known league point',
  },
  {
    what: 'a voyage sailed by a ship that is not aboard',
    spoil: (state) => {
      state.voyage!.shipId = UNCREWED_SHIP_ID;
    },
    message: 'save.voyage.shipId must hold the id of a ship in save.ships',
  },
  {
    what: 'a battle fought by a ship that is not aboard',
    spoil: (state) => {
      state.battle!.ships[1]!.shipId = UNCREWED_SHIP_ID;
    },
    message: 'save.battle.ships[1].shipId must hold the id of a ship in save.ships',
  },
];

function committedSavePath(name: string): string {
  return fileURLToPath(new URL(`../../packages/fixtures/saves/${name}.json`, import.meta.url));
}

function midStreamSim(): Sim {
  const sim = Sim.create({ seed: 0xc0ffee });
  sim.step(13);
  sim.dispatch({ op: 'marker.move', id: 1, dx: -1, dy: 2 });
  sim.step(9);
  return sim;
}

function voyagingSim(): Sim {
  const sim = createScenarioSim(VOYAGING_SEED, PILLAGE_LOOP_SCENARIO);
  drive(sim, [
    { op: 'ship.commission', shipClass: 'war-brig', allegiance: 'brigand' },
    { op: 'voyage.chart', shipId: PLAYER_SHIP_ID, toIslandId: 'doyle', voyageType: 'pillage' },
    { op: 'battle.start', sinkingContext: true },
  ]);
  sim.step(30);
  return sim;
}

function drive(sim: Sim, commands: Command[]): void {
  for (const command of commands) {
    assert.equal(sim.dispatch(command).status, 'accepted');
  }
}

function without<T extends object>(owner: T, field: keyof T): T {
  const remaining: Partial<T> = { ...owner };
  delete remaining[field];
  return remaining as T;
}

function spoiltSnapshot(spoil: (state: WorldState) => void): Snapshot {
  const snapshot = voyagingSim().snapshot();
  spoil(snapshot);
  return snapshot;
}

function spoiltSave(spoil: (state: WorldState) => void): string {
  const state = JSON.parse(voyagingSim().save()) as WorldState;
  spoil(state);
  return JSON.stringify(state);
}

test('save and load round-trip to an identical hash mid-stream', () => {
  const original = midStreamSim();
  const reloaded = Sim.load(original.save());

  assert.ok(original.state.rngStreams['marker.drift']!.draws > 0);
  assert.equal(reloaded.hash(), original.hash());
  assert.deepEqual(reloaded.state, original.state);
});

test('a reloaded sim continues the RNG streams identically', () => {
  const original = midStreamSim();
  const reloaded = Sim.load(original.save());

  original.step(20);
  reloaded.step(20);

  assert.equal(reloaded.hash(), original.hash());
});

test('canonical serialisation orders keys independently of insertion order', () => {
  assert.equal(canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 }));
});

test('canonical serialisation refuses a non-integer number', () => {
  assert.throws(() => canonicalJson({ rate: 0.5 }), TypeError);
});

test('a save missing a top-level field is refused by the field that is missing', () => {
  assert.throws(() => Sim.load('{"schemaVersion":6}'), {
    message: 'save.seed must hold a number',
  });
});

test('a save whose ships field is not an array is refused as an array', () => {
  assert.throws(() => Sim.load(spoiltSave((state) => (state.ships = null as never))), {
    message: 'save.ships must hold an array',
  });
});

test('a save that is not an object at all is refused before any field is read', () => {
  assert.throws(() => Sim.create({ seed: 1 }).restore(null as never), {
    message: 'save must hold an object',
  });
});

for (const { what, spoil, message } of SPOILT_SAVES) {
  test(`${what} is refused when it is loaded`, () => {
    assert.throws(() => Sim.load(spoiltSave(spoil)), { message });
  });
}

for (const { what, spoil, message } of SPOILT_SAVES) {
  test(`${what} is refused when it is restored`, () => {
    assert.throws(() => voyagingSim().restore(spoiltSnapshot(spoil)), { message });
  });
}

test('a refused restore leaves the running sim exactly where it was', () => {
  const sim = voyagingSim();
  const before = sim.hash();

  assert.throws(() => sim.restore(spoiltSnapshot((state) => state.puzzle!.board.cells.pop())));

  assert.equal(sim.hash(), before);
});

test('a genuine snapshot still restores through the deepened guard', () => {
  const sim = voyagingSim();
  const snapshot = sim.snapshot();
  sim.step(40);

  sim.restore(snapshot);

  assert.deepEqual(sim.state, snapshot);
});

test('a save of a voyage in battle round-trips unchanged through the deepened guard', () => {
  const original = voyagingSim();
  const saved = original.save();
  const reloaded = Sim.load(saved);

  assert.equal(reloaded.hash(), original.hash());
  assert.deepEqual(reloaded.state, original.state);
  assert.deepEqual(reloaded.state, JSON.parse(saved));
});

test('a reloaded voyage sails on identically', () => {
  const original = voyagingSim();
  const reloaded = Sim.load(original.save());

  original.step(120);
  reloaded.step(120);

  assert.equal(reloaded.hash(), original.hash());
});

test('the committed migration fixtures still load through the deepened guard', () => {
  for (const fixture of COMMITTED_SAVES) {
    const loaded = Sim.load(readFileSync(fixture, 'utf8'));

    assert.equal(loaded.state.schemaVersion, SCHEMA_VERSION);
  }
});

test('the guard normalises nothing the committed fixtures already carried', () => {
  const saved = readFileSync(COMMITTED_BILGE_SAVE, 'utf8');
  const raw = JSON.parse(saved) as WorldState;

  const loaded = Sim.load(saved).state;

  assert.deepEqual(loaded.puzzle!.board.cells, raw.puzzle!.board.cells);
  assert.deepEqual(loaded.puzzle!.frame, raw.puzzle!.frame);
  assert.deepEqual(loaded.markers, raw.markers);
  assert.deepEqual(loaded.rngStreams, raw.rngStreams);
});
