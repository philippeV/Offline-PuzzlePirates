import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Sim, canonicalJson } from '../../packages/sim/src/index.ts';

function midStreamSim(): Sim {
  const sim = Sim.create({ seed: 0xc0ffee });
  sim.step(13);
  sim.dispatch({ op: 'marker.move', id: 1, dx: -1, dy: 2 });
  sim.step(9);
  return sim;
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
