import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ESLINT = 'node_modules/eslint/bin/eslint.js';
const IMPORT_FIXTURES = 'tests/gates/fixtures/imports';
const DEPS_FIXTURE = 'tests/gates/fixtures/deps/package.json';

interface GateRun {
  status: number | null;
  output: string;
}

function run(args: string[]): GateRun {
  const result = spawnSync(process.execPath, args, { cwd: REPO_ROOT, encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

function lint(fixture: string): GateRun {
  return run([ESLINT, '--no-ignore', `tests/gates/fixtures/purity/${fixture}`]);
}

function rejected(gate: GateRun): string {
  assert.notEqual(gate.status, 0, `the gate accepted the fixture:\n${gate.output}`);
  return gate.output;
}

test('the import gate rejects a relative import that escapes the sim', () => {
  const output = rejected(run(['tools/check-sim-imports.ts', IMPORT_FIXTURES]));

  assert.match(output, /escaping\.ts imports "\.\.\/\.\.\/\.\.\/\.\.\/packages\/harness\/src\/rpc\.ts"/);
  assert.match(output, /which escapes/);
});

test('the import gate rejects a bare specifier', () => {
  const output = rejected(run(['tools/check-sim-imports.ts', IMPORT_FIXTURES]));

  assert.match(output, /bare\.ts imports the bare specifier "node:fs"/);
});

test('the dependency gate rejects devDependencies', () => {
  const output = rejected(run(['tools/check-sim-deps.ts', DEPS_FIXTURE]));

  assert.match(output, /declares "devDependencies": left-pad/);
});

test('the purity rules reject globalThis', () => {
  const output = rejected(lint('global-this.ts'));

  assert.match(output, /Unexpected use of 'globalThis'/);
});

test('the purity rules reject Date.parse', () => {
  const output = rejected(lint('date-parse.ts'));

  assert.match(output, /'Date\.parse' is restricted from being used/);
});

test('the purity rules reject the host globals', () => {
  const output = rejected(lint('host-globals.ts'));

  for (const global of ['crypto', 'setTimeout', 'setInterval', 'process']) {
    assert.match(output, new RegExp(`Unexpected use of '${global}'`));
  }
});
