import assert from 'node:assert/strict';
import { test } from 'node:test';

import { jsonPatch } from '../../packages/harness/src/patch.ts';

test('an unchanged value produces no operations', () => {
  assert.deepEqual(jsonPatch({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] }), []);
});

test('a longer array adds every element beyond the original length', () => {
  assert.deepEqual(jsonPatch({ ships: [] }, { ships: [{ id: 1 }, { id: 2 }] }), [
    { op: 'add', path: '/ships/0', value: { id: 1 } },
    { op: 'add', path: '/ships/1', value: { id: 2 } },
  ]);
});

test('a shorter array removes its tail from the end backwards', () => {
  assert.deepEqual(jsonPatch({ ships: [{ id: 1 }, { id: 2 }, { id: 3 }] }, { ships: [{ id: 1 }] }), [
    { op: 'remove', path: '/ships/2' },
    { op: 'remove', path: '/ships/1' },
  ]);
});

test('a spawned ship and a changed meter arrive in one patch', () => {
  const before = { ships: [{ id: 1, bilgePerMille: 0 }] };
  const after = { ships: [{ id: 1, bilgePerMille: 40 }, { id: 2, bilgePerMille: 0 }] };
  assert.deepEqual(jsonPatch(before, after), [
    { op: 'replace', path: '/ships/0/bilgePerMille', value: 40 },
    { op: 'add', path: '/ships/1', value: { id: 2, bilgePerMille: 0 } },
  ]);
});

test('a sunk ship leaves a remove and the survivors are re-indexed by value', () => {
  const before = { ships: [{ id: 1 }, { id: 2 }] };
  const after = { ships: [{ id: 2 }] };
  assert.deepEqual(jsonPatch(before, after), [
    { op: 'remove', path: '/ships/1' },
    { op: 'replace', path: '/ships/0/id', value: 2 },
  ]);
});

test('a member that disappears is removed and one that appears is added', () => {
  assert.deepEqual(jsonPatch({ puzzle: null, battle: null }, { battle: null, ships: [] }), [
    { op: 'remove', path: '/puzzle' },
    { op: 'add', path: '/ships', value: [] },
  ]);
});

test('a member whose type changes is replaced whole', () => {
  assert.deepEqual(jsonPatch({ battle: null }, { battle: { turnIndex: 0 } }), [
    { op: 'replace', path: '/battle', value: { turnIndex: 0 } },
  ]);
});

test('a member name containing pointer syntax is escaped', () => {
  assert.deepEqual(jsonPatch({ 'a/b': 1 }, { 'a/b': 2 }), [
    { op: 'replace', path: '/a~1b', value: 2 },
  ]);
  assert.deepEqual(jsonPatch({ 'a~b': 1 }, { 'a~b': 2 }), [
    { op: 'replace', path: '/a~0b', value: 2 },
  ]);
});
