import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { simPurityRules } from '../../eslint.config.js';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ESLINT = 'node_modules/eslint/bin/eslint.js';
const IMPORT_FIXTURES = 'tests/gates/fixtures/imports';
const DEPS_FIXTURE = 'tests/gates/fixtures/deps/package.json';
const SIM_SOURCE = 'packages/sim/src/index.ts';
const SEVERITIES: Record<string, number> = { off: 0, warn: 1, error: 2 };

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

function printedConfigFor(target: string): Record<string, unknown> {
  assert.ok(existsSync(join(REPO_ROOT, target)), `${target} does not exist`);

  const printed = run([ESLINT, '--print-config', target]);
  assert.equal(printed.status, 0, `--print-config failed for ${target}:\n${printed.output}`);
  assert.notEqual(printed.output.trim(), 'undefined', `${target} is ignored by eslint`);

  return (JSON.parse(printed.output) as { rules: Record<string, unknown> }).rules;
}

function severityAsNumber(declared: unknown): unknown {
  if (!Array.isArray(declared)) return declared;
  const [severity, ...options] = declared;
  return typeof severity === 'string' ? [SEVERITIES[severity], ...options] : declared;
}

function entriesOf(rule: keyof typeof simPurityRules): Record<string, unknown>[] {
  return simPurityRules[rule].slice(1) as Record<string, unknown>[];
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

test('every purity rule reaches a real simulation source file', () => {
  const printed = printedConfigFor(SIM_SOURCE);

  for (const [rule, declared] of Object.entries(simPurityRules)) {
    assert.deepEqual(
      printed[rule],
      severityAsNumber(declared),
      `${rule} does not reach ${SIM_SOURCE} as declared`,
    );
  }
});

test('the purity rules still declare the entries the fixtures cannot cover', () => {
  const globals = entriesOf('no-restricted-globals').map((entry) => entry['name']);
  const properties = entriesOf('no-restricted-properties').map(
    (entry) => `${String(entry['object'])}.${String(entry['property'])}`,
  );
  const selectors = entriesOf('no-restricted-syntax').map((entry) => entry['selector']);

  for (const global of ['globalThis', 'crypto', 'setTimeout', 'setInterval', 'process']) {
    assert.ok(globals.includes(global), `no-restricted-globals no longer names ${global}`);
  }
  for (const property of ['Math.random', 'Date.now', 'Date.parse', 'performance.now']) {
    assert.ok(properties.includes(property), `no-restricted-properties no longer names ${property}`);
  }
  assert.equal(selectors.length, 4, 'no-restricted-syntax no longer declares four selectors');
});
