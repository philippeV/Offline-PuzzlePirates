import { readFileSync } from 'node:fs';

import { balanceOf, type Balance } from '@opp/sim';

const SOURCE = new URL('../../../balance.json', import.meta.url);

export function loadBalance(source: URL): Balance {
  return balanceOf(JSON.parse(readFileSync(source, 'utf8')));
}

export const BALANCE: Balance = loadBalance(SOURCE);
