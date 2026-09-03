import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { BattleOutcome } from '../../packages/view/src/client/rules.ts';
import { linesOf } from '../../packages/view/src/client/log.ts';

function endedTextOf(outcome: BattleOutcome, bootyPoe = 0, bootyCargoUnits = 0): string {
  const lines = linesOf({
    type: 'battle.ended',
    tick: 7,
    outcome,
    bootyPoe,
    bootyCargoUnits,
    chartDropped: false,
  });
  const line = lines[0];
  assert.ok(line !== undefined, `no log line for a ${outcome} battle`);
  return line.text;
}

test('a won battle names the booty it paid', () => {
  assert.equal(
    endedTextOf('player-won', 120, 3),
    'Victory! 120 PoE and 3 units into the booty chest.',
  );
});

test('a lost battle narrates the defeat without promising a consequence', () => {
  assert.equal(endedTextOf('player-lost'), 'Ye be bested. The brigand leaves ye in her wake.');
});

test('a lost battle claims nothing the sim never applies', () => {
  const text = endedTextOf('player-lost');

  for (const claim of ['sunk', 'sink', 'lost', 'ashore', 'nothing', 'cargo', 'PoE']) {
    assert.ok(!text.toLowerCase().includes(claim.toLowerCase()), `loss text claimed "${claim}"`);
  }
});

test('every outcome speaks for itself', () => {
  const won = endedTextOf('player-won');
  const lost = endedTextOf('player-lost');
  const disengaged = endedTextOf('disengaged');

  assert.equal(disengaged, 'The brigand slips away.');
  assert.equal(new Set([won, lost, disengaged]).size, 3);
});
