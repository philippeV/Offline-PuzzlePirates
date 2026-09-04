import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BALANCE } from '../../packages/harness/src/balance.ts';
import {
  PILLAGE_LOOP_SCENARIO,
  SEA_BATTLE_SCENARIO,
  createScenarioSim,
} from '../../packages/harness/src/scenarios.ts';
import { GameClient } from '../../packages/view/src/client/client.ts';

const SEED = 20260902;

const OTHER_SEED = 77777777;

test('the client opens on the same session the harness calls the pillage loop', () => {
  const client = GameClient.create({ seed: SEED, balance: BALANCE });
  const harnessed = createScenarioSim(SEED, PILLAGE_LOOP_SCENARIO);

  assert.equal(client.save(), harnessed.save());
});

test('the client and the harness stay identical while the world runs', () => {
  const client = GameClient.create({ seed: SEED, balance: BALANCE });
  const harnessed = createScenarioSim(SEED, PILLAGE_LOOP_SCENARIO);

  client.advance(5000);
  harnessed.step(5000);

  assert.equal(client.save(), harnessed.save());
});

test('the sea battle opening is the same session the harness calls the sea battle', () => {
  const client = GameClient.create({ seed: SEED, balance: BALANCE, opening: 'sea-battle' });
  const harnessed = createScenarioSim(SEED, SEA_BATTLE_SCENARIO);

  assert.equal(client.save(), harnessed.save());
  assert.equal(client.scene, 'battle');
  assert.ok(client.inBattle);
});

test('the opening session is in port with a commissioned sloop', () => {
  const client = GameClient.create({ seed: SEED, balance: BALANCE });
  const [ship] = client.state.ships;

  assert.equal(client.state.pirate?.atIslandId, 'alkaid');
  assert.equal(client.state.voyage, null);
  assert.equal(ship?.allegiance, 'player');
  assert.equal(ship?.playerStation, 'bilging');
  assert.equal(client.scene, 'port');
});

test('the opening log is empty so the player is not greeted by setup noise', () => {
  const client = GameClient.create({ seed: SEED, balance: BALANCE });

  assert.deepEqual(client.log, []);
});

test('a refused command reaches the player as a readable refusal', () => {
  const client = GameClient.create({ seed: SEED, balance: BALANCE });
  const result = client.dispatch({ op: 'voyage.port' });

  assert.equal(result.status, 'rejected');
  assert.equal(client.log.at(-1)?.channel, 'refused');
  assert.equal(client.log.at(-1)?.text, 'Ye be not at sea.');
});

test('a saved game restores through the client', () => {
  const client = GameClient.create({ seed: SEED, balance: BALANCE });
  client.advance(600);
  const save = client.save();

  const reloaded = GameClient.create({ seed: SEED, balance: BALANCE });
  reloaded.restore(save);

  assert.equal(reloaded.save(), save);
});

test('a refused save leaves the running game intact and still stepping', () => {
  const client = GameClient.create({ seed: SEED, balance: BALANCE });
  client.advance(600);
  const running = client.save();

  assert.throws(() => client.restore('{"schemaVersion":6}'));

  assert.equal(client.save(), running);
  client.advance(600);
  assert.equal(client.tick, 1200);
});

test('a load that fails after the sim is built leaves the running game intact', () => {
  const client = GameClient.create({ seed: SEED, balance: BALANCE });
  client.advance(600);
  const running = client.save();

  const incoming = GameClient.create({ seed: SEED, balance: BALANCE });
  incoming.advance(1200);

  const unsubscribe = client.subscribe(() => {
    throw new Error('the panel be broken');
  });
  assert.throws(() => client.restore(incoming.save()));
  unsubscribe();

  assert.equal(client.save(), running);
  client.advance(600);
  assert.equal(client.tick, 1200);
});

test('loading a save moves the world epoch so a mounted scene is rebuilt', () => {
  const client = GameClient.create({ seed: SEED, balance: BALANCE });
  client.advance(600);
  const before = client.epoch;

  const incoming = GameClient.create({ seed: OTHER_SEED, balance: BALANCE });
  incoming.advance(600);
  client.restore(incoming.save());

  assert.ok(client.epoch > before);
});

test('starting a new game moves the world epoch', () => {
  const client = GameClient.create({ seed: SEED, balance: BALANCE });
  const before = client.epoch;

  client.reset(OTHER_SEED);

  assert.ok(client.epoch > before);
});

test('a load that fails leaves the world epoch where it was', () => {
  const client = GameClient.create({ seed: SEED, balance: BALANCE });
  client.advance(600);
  const before = client.epoch;

  const incoming = GameClient.create({ seed: OTHER_SEED, balance: BALANCE });
  incoming.advance(1200);

  const unsubscribe = client.subscribe(() => {
    throw new Error('the panel be broken');
  });
  assert.throws(() => client.restore(incoming.save()));
  unsubscribe();

  assert.equal(client.epoch, before);
});
