import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FIELD_WIDTH, Sim } from '../../packages/sim/src/index.ts';

test('an accepted command mutates state without advancing the tick', () => {
  const sim = Sim.create({ seed: 7 });
  const before = sim.state.tick;
  const result = sim.dispatch({ op: 'marker.place', id: 1, x: 2, y: 4 });

  assert.equal(result.status, 'accepted');
  assert.equal(sim.state.tick, before);
  assert.deepEqual(sim.state.markers[0], { id: 1, x: 2, y: 4 });
});

test('a command leaving the field is rejected and changes nothing', () => {
  const sim = Sim.create({ seed: 7 });
  const before = sim.hash();
  const result = sim.dispatch({ op: 'marker.move', id: 1, dx: FIELD_WIDTH, dy: 0 });

  assert.deepEqual(result, { status: 'rejected', reason: 'destination-outside-field' });
  assert.equal(sim.hash(), before);
});

test('a command naming an unknown entity is rejected and changes nothing', () => {
  const sim = Sim.create({ seed: 7 });
  const before = sim.hash();
  const result = sim.dispatch({ op: 'marker.place', id: 99, x: 1, y: 1 });

  assert.deepEqual(result, { status: 'rejected', reason: 'unknown-marker' });
  assert.equal(sim.hash(), before);
});

test('a fractional coordinate is rejected and changes nothing', () => {
  const sim = Sim.create({ seed: 7 });
  const before = sim.hash();
  const result = sim.dispatch({ op: 'marker.move', id: 1, dx: 0.5, dy: 0 });

  assert.deepEqual(result, { status: 'rejected', reason: 'non-integer-coordinate' });
  assert.equal(sim.hash(), before);
});

test('a step emits one drift event per marker per tick', () => {
  const sim = Sim.create({ seed: 7 });
  const events = sim.step(3);

  assert.equal(events.length, 3);
  assert.deepEqual(
    events.map((event) => event.tick),
    [1, 2, 3],
  );
  assert.ok(events.every((event) => event.type === 'marker.drifted'));
});
