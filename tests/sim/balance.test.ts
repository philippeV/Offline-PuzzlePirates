import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { balanceOf } from '../../packages/sim/src/index.ts';

const COMMITTED_BALANCE = fileURLToPath(new URL('../../balance.json', import.meta.url));

const FILE = JSON.parse(readFileSync(COMMITTED_BALANCE, 'utf8')) as Record<
  string,
  Record<string, unknown>
>;

const BLOCK_NAMES = [
  'bilging',
  'ship',
  'battle',
  'npc',
  'brigand',
  'booty',
  'world',
  'market',
  'division',
];

function fileWith(name: string, block: unknown): Record<string, unknown> {
  return { ...FILE, [name]: block };
}

function fileReplacing(name: string, key: string, value: unknown): Record<string, unknown> {
  return fileWith(name, { ...FILE[name], [key]: value });
}

test('the committed balance file parses into every declared block', () => {
  const balance = balanceOf(FILE);

  assert.deepEqual(Object.keys(balance).sort(), [...BLOCK_NAMES].sort());
  assert.ok(Number.isSafeInteger(balance.bilging.boardWidth));
  assert.ok(balance.bilging.ratingBandsPerMille.every(Number.isSafeInteger));
});

test('a file that is not an object is refused', () => {
  assert.throws(() => balanceOf(['bilging']), {
    name: 'TypeError',
    message: 'balance.json must hold an object',
  });
});

test('a missing block is refused by the name of that block', () => {
  assert.throws(() => balanceOf(fileWith('npc', undefined)), {
    name: 'TypeError',
    message: 'balance.json npc must hold an object',
  });
});

test('a field that is not a safe integer is refused by the name of that field', () => {
  assert.throws(() => balanceOf(fileReplacing('bilging', 'boardWidth', 6.5)), {
    name: 'TypeError',
    message: 'balance.json bilging.boardWidth must hold a safe integer',
  });
});

test('a scalar where an integer array belongs is refused by the name of that field', () => {
  assert.throws(() => balanceOf(fileReplacing('bilging', 'ratingBandsPerMille', 500)), {
    name: 'TypeError',
    message: 'balance.json bilging.ratingBandsPerMille must hold an array of safe integers',
  });
});

test('a booty overflow policy outside the declared set is refused', () => {
  assert.throws(() => balanceOf(fileReplacing('booty', 'overflowPolicy', 'jettison')), {
    name: 'TypeError',
    message: 'balance.json booty.overflowPolicy must hold one of truncate, refuse, spill-to-sea',
  });
});
