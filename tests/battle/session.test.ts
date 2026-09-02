import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Sim, TICKS_PER_TURN, type WorldState } from '../../packages/sim/src/index.ts';
import {
  SEA_BATTLE_SCENARIO,
  createScenarioSim,
} from '../../packages/harness/src/scenarios.ts';

const SEED = 7919;
const TURNS = 12;

function hashesOf(turns: number): string[] {
  const sim = createScenarioSim(SEED, SEA_BATTLE_SCENARIO);
  const hashes: string[] = [];
  for (let turn = 0; turn < turns; turn += 1) {
    sim.step(TICKS_PER_TURN);
    hashes.push(sim.hash());
  }
  return hashes;
}

test('a sea battle stepped twice from the same seed hashes identically at every turn', () => {
  assert.deepEqual(hashesOf(TURNS), hashesOf(TURNS));
});

test('a battle in progress survives a save and reload unchanged', () => {
  const sim = createScenarioSim(SEED, SEA_BATTLE_SCENARIO);
  sim.step(TICKS_PER_TURN * 4);
  const reloaded = Sim.load(sim.save());
  assert.equal(reloaded.hash(), sim.hash());
  reloaded.step(TICKS_PER_TURN);
  sim.step(TICKS_PER_TURN);
  assert.equal(reloaded.hash(), sim.hash());
});

test('restoring a snapshot rewinds the battle to the turn it was taken on', () => {
  const sim = createScenarioSim(SEED, SEA_BATTLE_SCENARIO);
  sim.step(TICKS_PER_TURN * 4);
  const snapshot = sim.snapshot();
  const taken = sim.hash();
  sim.step(TICKS_PER_TURN * 3);
  assert.notEqual(sim.hash(), taken);
  sim.restore(snapshot);
  assert.equal(sim.hash(), taken);
});

test('the battle clock advances one turn every TICKS_PER_TURN ticks', () => {
  const sim = createScenarioSim(SEED, SEA_BATTLE_SCENARIO);
  const turnIndexOf = (): number => (sim.state as WorldState).battle?.turnIndex ?? -1;
  assert.equal(turnIndexOf(), 0);
  sim.step(TICKS_PER_TURN - 1);
  assert.equal(turnIndexOf(), 0);
  sim.step(1);
  assert.equal(turnIndexOf(), 1);
  sim.step(TICKS_PER_TURN * 2);
  assert.equal(turnIndexOf(), 3);
});
