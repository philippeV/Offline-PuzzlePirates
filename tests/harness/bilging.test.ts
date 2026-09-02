import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { BALANCE, BILGE_SCENARIO } from '../../packages/harness/src/index.ts';
import {
  PER_MILLE,
  ratingOf,
  type Board,
  type PuzzleState,
  type WorldState,
} from '../../packages/sim/src/index.ts';
import { clearingSwapOf } from '../puzzle/fixtures.ts';

import { resultOf, startHarness, type Harness } from './client.ts';

const SCENARIO_FIXTURE = fileURLToPath(
  new URL('../../packages/fixtures/scenarios/bilge-opening.json', import.meta.url),
);
const GOLDEN_FIXTURE = fileURLToPath(
  new URL('../../packages/fixtures/goldens/bilge-session-idle-minute.json', import.meta.url),
);

const SESSION_SEED = 0xb11ce;
const MOVES = 6;
const TICKS_PER_MOVE = 10;

interface ScenarioFixture {
  scenario: string;
  seed: number;
  starLevel: number;
  waterLineRow: number;
  board: Board;
  stateHash: string;
}

interface GoldenFixture {
  scenario: string;
  seed: number;
  ticks: number;
  stateHash: string;
  state: WorldState;
}

let harness: Harness;

function loadScenario(): ScenarioFixture {
  return JSON.parse(readFileSync(SCENARIO_FIXTURE, 'utf8')) as ScenarioFixture;
}

function loadGolden(): GoldenFixture {
  return JSON.parse(readFileSync(GOLDEN_FIXTURE, 'utf8')) as GoldenFixture;
}

async function openSession(seed: number, scenario: string): Promise<Record<string, unknown>> {
  return resultOf(await harness.call('session.new', { seed, scenario }));
}

async function valueAt(session: string, pointer: string): Promise<unknown> {
  return resultOf(await harness.call('state.get', { session, pointer }))['value'];
}

before(() => {
  harness = startHarness();
});

after(async () => {
  await harness.stop();
});

test('a bilging session played through the harness ends in a duty output', async () => {
  const opened = await openSession(SESSION_SEED, BILGE_SCENARIO);
  const session = opened['session'] as string;

  for (let move = 0; move < MOVES; move += 1) {
    const board = (await valueAt(session, '/puzzle/board')) as Board;
    const dispatched = resultOf(
      await harness.call('sim.dispatch', {
        session,
        commands: [{ op: 'bilge.swap', ...clearingSwapOf(board) }],
      }),
    );
    const results = dispatched['results'] as { status: string }[];
    assert.equal(results[0]?.status, 'accepted', `move ${move}`);
    await harness.call('sim.step', { session, ticks: TICKS_PER_MOVE });
  }

  const puzzle = (await valueAt(session, '/puzzle')) as PuzzleState;
  assert.equal(puzzle.moves, MOVES);
  assert.ok(puzzle.totalScore > 0);
  assert.ok(puzzle.dutyOutputPerMille >= PER_MILLE);
  assert.notEqual(ratingOf(puzzle.dutyOutputPerMille, BALANCE.bilging), 'booched');
});

test('the committed bilging scenario fixture reproduces its pinned opening board', async () => {
  const fixture = loadScenario();

  const opened = await openSession(fixture.seed, fixture.scenario);
  const session = opened['session'] as string;

  assert.equal(opened['stateHash'], fixture.stateHash);
  assert.deepEqual(await valueAt(session, '/puzzle/board'), fixture.board);
  assert.equal(await valueAt(session, '/puzzle/starLevel'), fixture.starLevel);
  assert.equal(await valueAt(session, '/puzzle/waterLineRow'), fixture.waterLineRow);
});

test('the blessed bilging golden still matches the state the harness produces', async () => {
  const golden = loadGolden();
  const opened = await openSession(golden.seed, golden.scenario);
  const session = opened['session'] as string;

  const stepped = resultOf(await harness.call('sim.step', { session, ticks: golden.ticks }));

  assert.equal(stepped['stateHash'], golden.stateHash);
  assert.deepEqual(await valueAt(session, ''), golden.state);
});

test('the blessed golden pins the tuning the balance file was loaded with', () => {
  const golden = loadGolden();

  assert.deepEqual(golden.state.balance, BALANCE);
  assert.equal(golden.state.puzzle?.starLevel, 1);
  assert.ok((golden.state.puzzle?.bilgePerMille ?? 0) > 0);
});
