import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { reasonOf, resultOf, startHarness, type Harness } from './client.ts';

const SEED = 0xc0ffee;

let harness: Harness;

async function openSession(): Promise<string> {
  const opened = resultOf(await harness.call('session.new', { seed: SEED }));
  return opened['session'] as string;
}

before(() => {
  harness = startHarness();
});

after(async () => {
  await harness.stop();
});

test('session.new opens a seeded session at tick zero', async () => {
  const opened = resultOf(await harness.call('session.new', { seed: SEED }));

  assert.equal(typeof opened['session'], 'string');
  assert.equal(opened['tick'], 0);
  assert.equal(opened['schemaVersion'], 2);
  assert.match(opened['stateHash'] as string, /^[0-9a-f]{16}$/);
});

test('session.new accepts the named default scenario and rejects an unknown one', async () => {
  const named = resultOf(
    await harness.call('session.new', { seed: SEED, scenario: 'marker-field' }),
  );
  assert.equal(named['tick'], 0);

  const unknown = await harness.call('session.new', { seed: SEED, scenario: 'no-such-scenario' });
  assert.equal(reasonOf(unknown), 'scenario-unknown');
});

test('sim.dispatch reports per-command results without stepping', async () => {
  const session = await openSession();

  const dispatched = resultOf(
    await harness.call('sim.dispatch', {
      session,
      commands: [
        { op: 'marker.place', id: 1, x: 4, y: 9 },
        { op: 'marker.place', id: 77, x: 0, y: 0 },
        { op: 'marker.place', id: 1, x: 99, y: 0 },
      ],
    }),
  );
  const results = dispatched['results'] as { status: string; reason?: string }[];

  assert.deepEqual(
    results.map((result) => [result.status, result.reason]),
    [
      ['accepted', undefined],
      ['rejected', 'unknown-marker'],
      ['rejected', 'destination-outside-field'],
    ],
  );
  assert.equal(dispatched['tick'], 0);
});

test('sim.step emits events and reports the resulting tick and hash', async () => {
  const session = await openSession();

  const stepped = resultOf(await harness.call('sim.step', { session, ticks: 3 }));

  assert.equal(stepped['tick'], 3);
  assert.equal((stepped['events'] as unknown[]).length, 3);
  assert.match(stepped['stateHash'] as string, /^[0-9a-f]{16}$/);
});

test('sim.runUntil steps until the pointer matches', async () => {
  const session = await openSession();

  const ran = resultOf(
    await harness.call('sim.runUntil', { session, pointer: '/tick', equals: 5, maxTicks: 50 }),
  );

  assert.equal(ran['matched'], true);
  assert.equal(ran['ticksStepped'], 5);
  assert.equal(ran['tick'], 5);
});

test('sim.runUntil reports the tick budget running out', async () => {
  const session = await openSession();

  const ran = resultOf(
    await harness.call('sim.runUntil', { session, pointer: '/tick', equals: 900, maxTicks: 4 }),
  );

  assert.equal(ran['matched'], false);
  assert.equal(ran['ticksStepped'], 4);
  assert.equal(ran['tick'], 4);
});

test('state.get reads a subtree by json pointer and truncates by depth', async () => {
  const session = await openSession();

  const marker = resultOf(await harness.call('state.get', { session, pointer: '/markers/0' }));
  assert.deepEqual(marker['value'], { id: 1, x: 8, y: 8 });

  const shallow = resultOf(await harness.call('state.get', { session, pointer: '', depth: 1 }));
  const fields = shallow['value'] as Record<string, unknown>;
  assert.equal(fields['tick'], 0);
  assert.equal(fields['markers'], '[1 items]');
});

test('state.diff returns a json patch from a snapshot to the current state', async () => {
  const session = await openSession();
  const taken = resultOf(await harness.call('snapshot.take', { session }));
  await harness.call('sim.dispatch', {
    session,
    commands: [{ op: 'marker.place', id: 1, x: 2, y: 3 }],
  });
  await harness.call('sim.step', { session, ticks: 2 });

  const diffed = resultOf(
    await harness.call('state.diff', { session, fromSnapshotId: taken['snapshotId'] }),
  );
  const patch = diffed['patch'] as { op: string; path: string; value?: unknown }[];

  assert.deepEqual(
    patch.filter((operation) => operation.path === '/tick'),
    [{ op: 'replace', path: '/tick', value: 2 }],
  );
  assert.ok(patch.some((operation) => operation.path === '/markers/0/y'));
  assert.ok(patch.some((operation) => operation.path.startsWith('/rngStreams/marker.drift')));
});

test('snapshot.take then diverge then snapshot.restore returns the identical hash', async () => {
  const session = await openSession();
  await harness.call('sim.step', { session, ticks: 5 });
  const taken = resultOf(await harness.call('snapshot.take', { session }));

  await harness.call('sim.dispatch', {
    session,
    commands: [{ op: 'marker.place', id: 1, x: 0, y: 0 }],
  });
  const diverged = resultOf(await harness.call('sim.step', { session, ticks: 40 }));
  assert.notEqual(diverged['stateHash'], taken['stateHash']);

  const restored = resultOf(
    await harness.call('snapshot.restore', { session, snapshotId: taken['snapshotId'] }),
  );
  assert.equal(restored['stateHash'], taken['stateHash']);
  assert.equal(restored['tick'], taken['tick']);
});

test('rng.cursors reports one draw per stepped tick', async () => {
  const session = await openSession();
  await harness.call('sim.step', { session, ticks: 7 });

  const cursors = resultOf(await harness.call('rng.cursors', { session }));
  const drift = (cursors['cursors'] as Record<string, { draws: number }>)['marker.drift'];

  assert.equal(drift?.draws, 7);
});

test('an unknown session, method, pointer or snapshot each fail with a stable reason', async () => {
  const session = await openSession();

  const unknownSession = await harness.call('sim.step', { session: 'nope', ticks: 1 });
  const unknownMethod = await harness.call('no.such.method', {});
  const unknownPointer = await harness.call('state.get', { session, pointer: '/markers/9' });
  const unknownSnapshot = await harness.call('state.diff', { session, fromSnapshotId: 'snap9' });

  assert.equal(reasonOf(unknownSession), 'session-unknown');
  assert.equal(reasonOf(unknownMethod), 'method-unknown');
  assert.equal(reasonOf(unknownPointer), 'pointer-unknown');
  assert.equal(reasonOf(unknownSnapshot), 'snapshot-unknown');
});

test('malformed params fail with invalid-params rather than crashing', async () => {
  const session = await openSession();

  const badSeed = await harness.call('session.new', { seed: 'lots' });
  const missingTicks = await harness.call('sim.step', { session });
  const badPointer = await harness.call('state.get', { session, pointer: 'markers' });
  const badCommand = await harness.call('sim.dispatch', {
    session,
    commands: [{ op: 'marker.fly', id: 1 }],
  });
  const badParams = await harness.call('rng.cursors', 'not-an-object');

  assert.equal(reasonOf(badSeed), 'invalid-params');
  assert.equal(reasonOf(missingTicks), 'invalid-params');
  assert.equal(reasonOf(badPointer), 'invalid-params');
  assert.equal(reasonOf(badCommand), 'invalid-params');
  assert.equal(reasonOf(badParams), 'invalid-params');
});

test('an inherited Object.prototype name fails as an unknown method rather than being called', async () => {
  const constructorCall = await harness.call('constructor', {});
  const toStringCall = await harness.call('toString', {});

  assert.equal(reasonOf(constructorCall), 'method-unknown');
  assert.equal(reasonOf(toStringCall), 'method-unknown');
});

test('an inherited Object.prototype scenario name fails as unknown and opens no session', async () => {
  const constructorScenario = await harness.call('session.new', {
    seed: SEED,
    scenario: 'constructor',
  });

  assert.equal(reasonOf(constructorScenario), 'scenario-unknown');
  assert.equal(constructorScenario.result, undefined);
});

test('an inherited Object.prototype pointer token fails as an unknown pointer member', async () => {
  const session = await openSession();

  const constructorPointer = await harness.call('state.get', { session, pointer: '/constructor' });
  const toStringPointer = await harness.call('state.get', { session, pointer: '/toString' });
  const protoPointer = await harness.call('state.get', { session, pointer: '/__proto__' });

  assert.equal(reasonOf(constructorPointer), 'pointer-unknown');
  assert.equal(reasonOf(toStringPointer), 'pointer-unknown');
  assert.equal(reasonOf(protoPointer), 'pointer-unknown');
});

test('the server survives a malformed line and keeps serving the next request', async () => {
  const broken = await harness.sendLine('{ this is not json');
  assert.equal(reasonOf(broken), 'parse-error');
  assert.equal(broken.id, null);

  const notARequest = await harness.sendLine('{"id":1,"method":"sim.step"}');
  assert.equal(reasonOf(notARequest), 'invalid-request');

  const session = await openSession();
  const stepped = resultOf(await harness.call('sim.step', { session, ticks: 1 }));
  assert.equal(stepped['tick'], 1);
});

test('an oversized tick count is refused and the harness keeps serving', async () => {
  const session = await openSession();

  const oversized = await harness.call('sim.step', { session, ticks: 9007199254740991 });
  assert.equal(reasonOf(oversized), 'limit-exceeded');

  const stepped = resultOf(await harness.call('sim.step', { session, ticks: 1 }));
  assert.equal(stepped['tick'], 1);
});

test('a tick count at the step cap is accepted and one over it is refused', async () => {
  const session = await openSession();

  const atCap = resultOf(await harness.call('sim.step', { session, ticks: 100000 }));
  assert.equal(atCap['tick'], 100000);
  assert.equal((atCap['events'] as unknown[]).length, 100000);

  const overCap = await harness.call('sim.step', { session, ticks: 100001 });
  assert.equal(reasonOf(overCap), 'limit-exceeded');
});

test('an oversized run budget is refused and the harness keeps serving', async () => {
  const session = await openSession();

  const oversized = await harness.call('sim.runUntil', {
    session,
    pointer: '/tick',
    equals: 900,
    maxTicks: 9007199254740991,
  });
  assert.equal(reasonOf(oversized), 'limit-exceeded');

  const ran = resultOf(
    await harness.call('sim.runUntil', { session, pointer: '/tick', equals: 3, maxTicks: 10 }),
  );
  assert.equal(ran['matched'], true);
  assert.equal(ran['ticksStepped'], 3);
});

test('a run budget at the run cap is accepted and one over it is refused', async () => {
  const session = await openSession();

  const atCap = resultOf(
    await harness.call('sim.runUntil', {
      session,
      pointer: '/tick',
      equals: 0,
      maxTicks: 1000000,
    }),
  );
  assert.equal(atCap['matched'], true);
  assert.equal(atCap['ticksStepped'], 0);

  const overCap = await harness.call('sim.runUntil', {
    session,
    pointer: '/tick',
    equals: 0,
    maxTicks: 1000001,
  });
  assert.equal(reasonOf(overCap), 'limit-exceeded');
});

test('an oversized replay tick is refused and the harness keeps serving', async () => {
  const oversized = await harness.call('replay.verify', {
    seed: SEED,
    commands: [
      { tick: 9007199254740991, command: { op: 'marker.place', id: 1, x: 1, y: 1 } },
    ],
    expectedHash: '0000000000000000',
  });
  assert.equal(reasonOf(oversized), 'limit-exceeded');

  const oversizedCheckpoint = await harness.call('replay.verify', {
    seed: SEED,
    commands: [],
    hashTrail: [{ tick: 1000001, hash: '0000000000000000' }],
    expectedHash: '0000000000000000',
  });
  assert.equal(reasonOf(oversizedCheckpoint), 'limit-exceeded');

  const session = await openSession();
  const stepped = resultOf(await harness.call('sim.step', { session, ticks: 1 }));
  assert.equal(stepped['tick'], 1);
});

test('a command count at the dispatch cap is accepted and one over it is refused', async () => {
  const session = await openSession();
  const command = { op: 'marker.place', id: 1, x: 4, y: 9 };

  const atCap = resultOf(
    await harness.call('sim.dispatch', {
      session,
      commands: new Array(100000).fill(command),
    }),
  );
  assert.equal((atCap['results'] as unknown[]).length, 100000);

  const overCap = await harness.call('sim.dispatch', {
    session,
    commands: new Array(100001).fill(command),
  });
  assert.equal(reasonOf(overCap), 'limit-exceeded');

  const stepped = resultOf(await harness.call('sim.step', { session, ticks: 1 }));
  assert.equal(stepped['tick'], 1);
});
