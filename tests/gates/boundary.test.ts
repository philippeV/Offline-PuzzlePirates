import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const GATE = 'tools/check-view-boundary.ts';
const FIXTURES = 'tests/gates/fixtures/boundary';
const UPSTREAM_FIXTURES = 'tests/gates/fixtures/boundary/upstream';

interface GateRun {
  status: number | null;
  output: string;
}

function run(args: string[]): GateRun {
  const result = spawnSync(process.execPath, args, { cwd: REPO_ROOT, encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

test('the boundary gate rejects a view file that reaches past the client facade', () => {
  const gate = run([GATE, FIXTURES, UPSTREAM_FIXTURES]);

  assert.notEqual(gate.status, 0, `the gate accepted the fixture:\n${gate.output}`);
  assert.match(gate.output, /leaking\.ts reaches past the client facade to "@opp\/sim"/);
});

test('the boundary gate rejects the simulation importing the view', () => {
  const gate = run([GATE, FIXTURES, UPSTREAM_FIXTURES]);

  assert.match(gate.output, /reversed\.ts imports the view as "@opp\/view"/);
});

test('the boundary gate leaves the client facade alone', () => {
  const gate = run([GATE, FIXTURES, UPSTREAM_FIXTURES]);

  assert.doesNotMatch(gate.output, /facade\.ts/);
});

test('the boundary gate accepts the view as it stands', () => {
  const gate = run([GATE]);

  assert.equal(gate.status, 0, gate.output);
  assert.match(gate.output, /reaches the simulation only through its client facade/);
});
