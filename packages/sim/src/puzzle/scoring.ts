import type { BilgingBalance } from './balance.ts';

export const PER_MILLE = 1000;
export const POINTS_PER_MOVE_AT_FULL_EFFICIENCY = 3;

const BASE_POINTS_SLOPE = 2;
const BASE_POINTS_INTERCEPT = 3;
const VEGAS_LINE_COUNT = 4;
const VEGAS_LINE_LENGTH = 5;
const MINIMUM_COMBO_MULTIPLIER = 1;

export function basePointsOf(lineLength: number): number {
  return BASE_POINTS_SLOPE * lineLength - BASE_POINTS_INTERCEPT;
}

export function comboMultiplierOf(
  lineLengths: number[],
  balance: BilgingBalance,
  starLevel: number,
): number {
  const scaled = tableMultiplierOf(lineLengths, balance) * starScalePerMilleOf(balance, starLevel);
  return Math.max(MINIMUM_COMBO_MULTIPLIER, Math.floor(scaled / PER_MILLE));
}

export function comboScoreOf(
  lineLengths: number[],
  balance: BilgingBalance,
  starLevel: number,
): number {
  const base = lineLengths.reduce((total, length) => total + basePointsOf(length), 0);
  return base * comboMultiplierOf(lineLengths, balance, starLevel);
}

export function chainScoreOf(clearedCellCount: number, balance: BilgingBalance): number {
  return clearedCellCount * balance.chainPointsPerCell;
}

export function crabScoreOf(
  crabCount: number,
  bilgePerMille: number,
  balance: BilgingBalance,
): number {
  const scaled = balance.crabPointsAtFullWater * crabCount * crabCount * bilgePerMille;
  return Math.floor(scaled / PER_MILLE);
}

export function movesForEfficiencyMilli(
  score: number,
  efficiencyNumerator: number,
  efficiencyDenominator: number,
): number {
  const dividend = score * efficiencyDenominator * PER_MILLE;
  const divisor = POINTS_PER_MOVE_AT_FULL_EFFICIENCY * efficiencyNumerator;
  return roundedQuotient(dividend, divisor);
}

function tableMultiplierOf(lineLengths: number[], balance: BilgingBalance): number {
  if (isVegas(lineLengths)) return balance.vegasMultiplier;
  const table = balance.comboMultiplierByLineCount;
  return table[Math.min(lineLengths.length, table.length - 1)] ?? 0;
}

function starScalePerMilleOf(balance: BilgingBalance, starLevel: number): number {
  const table = balance.comboScalePerMilleByStarLevel;
  const level = Math.min(Math.max(starLevel, 0), table.length - 1);
  return table[level] ?? PER_MILLE;
}

function roundedQuotient(dividend: number, divisor: number): number {
  return Math.floor((2 * dividend + divisor) / (2 * divisor));
}

function isVegas(lineLengths: number[]): boolean {
  if (lineLengths.length !== VEGAS_LINE_COUNT) return false;
  return lineLengths.some((length) => length >= VEGAS_LINE_LENGTH);
}
