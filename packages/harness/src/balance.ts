import { readFileSync } from 'node:fs';

import type { BilgingBalance, PuzzleBalance } from '@opp/sim';

import { isRecord } from './json.ts';

const SOURCE = new URL('../../../balance.json', import.meta.url);

export function loadPuzzleBalance(source: URL): PuzzleBalance {
  return { bilging: bilgingBalanceOf(blockOf(fileOf(source), 'bilging')) };
}

export const BALANCE: PuzzleBalance = loadPuzzleBalance(SOURCE);

function fileOf(source: URL): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(source, 'utf8'));
  if (!isRecord(parsed)) throw new TypeError('balance.json must hold an object');
  return parsed;
}

function blockOf(file: Record<string, unknown>, key: string): Record<string, unknown> {
  const block = file[key];
  if (!isRecord(block)) throw new TypeError(`balance.json ${key} must hold an object`);
  return block;
}

function bilgingBalanceOf(block: Record<string, unknown>): BilgingBalance {
  return {
    boardWidth: integerOf(block, 'boardWidth'),
    boardHeight: integerOf(block, 'boardHeight'),
    colourCountByStarLevel: integerArrayOf(block, 'colourCountByStarLevel'),
    maxStarLevel: integerOf(block, 'maxStarLevel'),
    startingStarLevel: integerOf(block, 'startingStarLevel'),
    ticksPerStarStep: integerOf(block, 'ticksPerStarStep'),
    comboMultiplierByLineCount: integerArrayOf(block, 'comboMultiplierByLineCount'),
    vegasMultiplier: integerOf(block, 'vegasMultiplier'),
    chainPointsPerCell: integerOf(block, 'chainPointsPerCell'),
    inflowPerMillePerThousandTicks: integerOf(block, 'inflowPerMillePerThousandTicks'),
    pumpPerMillePerThousandTicks: integerOf(block, 'pumpPerMillePerThousandTicks'),
    ratingBandsPerMille: integerArrayOf(block, 'ratingBandsPerMille'),
  };
}

function integerOf(block: Record<string, unknown>, key: string): number {
  return safeIntegerOf(block[key], `bilging.${key}`);
}

function integerArrayOf(block: Record<string, unknown>, key: string): number[] {
  const value = block[key];
  if (!Array.isArray(value)) {
    throw new TypeError(`balance.json bilging.${key} must hold an array of safe integers`);
  }
  return value.map((entry, index) => safeIntegerOf(entry, `bilging.${key}[${index}]`));
}

function safeIntegerOf(value: unknown, key: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new TypeError(`balance.json ${key} must hold a safe integer`);
  }
  return value;
}
