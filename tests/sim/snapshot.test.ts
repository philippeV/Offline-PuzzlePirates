import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Sim } from '../../packages/sim/src/index.ts';

test('snapshot then diverge then restore returns the identical hash', () => {
  const sim = Sim.create({ seed: 0xdecafb });
  sim.step(5);

  const snapshot = sim.snapshot();
  const hashAtSnapshot = sim.hash();

  sim.dispatch({ op: 'marker.place', id: 1, x: 0, y: 0 });
  sim.step(40);
  assert.notEqual(sim.hash(), hashAtSnapshot);

  sim.restore(snapshot);
  assert.equal(sim.hash(), hashAtSnapshot);
});

test('a restored sim replays the same future as the branch it came from', () => {
  const sim = Sim.create({ seed: 0xdecafb });
  sim.step(5);

  const snapshot = sim.snapshot();
  sim.step(12);
  const branchHash = sim.hash();

  sim.restore(snapshot);
  sim.step(12);

  assert.equal(sim.hash(), branchHash);
});

test('a snapshot is detached from the state it was taken from', () => {
  const sim = Sim.create({ seed: 1 });
  const snapshot = sim.snapshot();
  sim.step(4);

  assert.equal(snapshot.tick, 0);
});
