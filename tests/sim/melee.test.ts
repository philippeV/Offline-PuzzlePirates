import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_BLACK_BLOCK_ROWS,
  MELEE_COLUMNS,
  resolveMelee,
  strengthOf,
  type MeleeSide,
} from '../../packages/sim/src/melee.ts';

function side(overrides: Partial<MeleeSide>): MeleeSide {
  return { blackBlockRows: 0, rumSick: false, crew: 7, ...overrides };
}

test('an undamaged crew fights with its whole board', () => {
  assert.equal(strengthOf(side({ crew: 7 })), 7 * MAX_BLACK_BLOCK_ROWS * MELEE_COLUMNS);
});

test('every row of black blocks costs a sixth of the board', () => {
  for (let rows = 0; rows <= MAX_BLACK_BLOCK_ROWS; rows += 1) {
    assert.equal(
      strengthOf(side({ crew: 1, blackBlockRows: rows })),
      (MAX_BLACK_BLOCK_ROWS - rows) * MELEE_COLUMNS,
      `${rows} rows`,
    );
  }
});

test('a fully damaged ship brings no fight at all', () => {
  assert.equal(strengthOf(side({ blackBlockRows: MAX_BLACK_BLOCK_ROWS })), 0);
});

test('rum sickness takes the leftmost and rightmost columns', () => {
  assert.equal(
    strengthOf(side({ crew: 7, rumSick: true })),
    7 * MAX_BLACK_BLOCK_ROWS * (MELEE_COLUMNS - 2),
  );
});

test('black block rows are clamped to the published maximum of six', () => {
  assert.equal(strengthOf(side({ blackBlockRows: 99 })), 0);
  assert.equal(strengthOf(side({ blackBlockRows: -3 })), strengthOf(side({ blackBlockRows: 0 })));
});

test('the bigger crew wins an otherwise even boarding', () => {
  const result = resolveMelee(side({ crew: 12 }), side({ crew: 7 }));
  assert.equal(result.winner, 'attacker');
});

test('damage decides a boarding between equal crews', () => {
  const result = resolveMelee(side({ crew: 7, blackBlockRows: 4 }), side({ crew: 7 }));
  assert.equal(result.winner, 'defender');
});

test('rum sickness can lose a boarding the crew would otherwise win', () => {
  const dry = resolveMelee(side({ crew: 9 }), side({ crew: 7 }));
  const sick = resolveMelee(side({ crew: 9, rumSick: true }), side({ crew: 7 }));
  assert.equal(dry.winner, 'attacker');
  assert.equal(sick.winner, 'defender');
});

test('a tie is held by the ship being boarded', () => {
  const result = resolveMelee(side({ crew: 7 }), side({ crew: 7 }));
  assert.equal(result.winner, 'defender');
  assert.equal(result.attackerStrength, result.defenderStrength);
});
