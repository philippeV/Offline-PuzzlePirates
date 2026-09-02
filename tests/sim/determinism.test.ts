import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Sim, type Command } from '../../packages/sim/src/index.ts';

const SCRIPT: Command[] = [
  { op: 'marker.move', id: 1, dx: 1, dy: 0 },
  { op: 'marker.move', id: 1, dx: 0, dy: -2 },
  { op: 'marker.place', id: 1, x: 3, y: 11 },
];

function runScript(seed: number): Sim {
  const sim = Sim.create({ seed });
  for (const command of SCRIPT) {
    assert.equal(sim.dispatch(command).status, 'accepted');
    sim.step(7);
  }
  return sim;
}

test('the same seed and command sequence produce the same state hash', () => {
  assert.equal(runScript(0xc0ffee).hash(), runScript(0xc0ffee).hash());
});

test('a different seed produces a different state hash', () => {
  assert.notEqual(runScript(0xc0ffee).hash(), runScript(0xdecafb).hash());
});

test('stepping draws exactly one number per tick from the drift stream', () => {
  const sim = Sim.create({ seed: 1 });
  sim.step(25);
  assert.equal(sim.state.rngStreams['marker.drift']?.draws, 25);
});

test('an unused stream leaves no cursor in state', () => {
  const sim = Sim.create({ seed: 1 });
  assert.deepEqual(sim.state.rngStreams, {});
});
