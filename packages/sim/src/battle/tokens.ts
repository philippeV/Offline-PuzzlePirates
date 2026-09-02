import { TICKS_PER_SECOND } from '../clock.ts';
import { PER_MILLE } from '../puzzle/scoring.ts';

export const MOVEMENT_TOKEN_LIFETIME_TURNS = 5;
export const PLANNING_SECONDS_PER_TURN = 35;
export const TICKS_PER_TURN = PLANNING_SECONDS_PER_TURN * TICKS_PER_SECOND;

export type MoveToken = 'left' | 'forward' | 'right';

export const MOVE_TOKENS: MoveToken[] = ['left', 'forward', 'right'];

export interface TokenPool {
  left: number[];
  forward: number[];
  right: number[];
  accumulator: number;
  rotation: number;
}

export function createTokenPool(): TokenPool {
  return {
    left: emptyAges(),
    forward: emptyAges(),
    right: emptyAges(),
    accumulator: 0,
    rotation: 0,
  };
}

export function heldTokensOf(pool: TokenPool, token: MoveToken): number {
  return pool[token].reduce((total, count) => total + count, 0);
}

export function mintMovementTokens(pool: TokenPool, milliPerTurn: number): number {
  pool.accumulator += milliPerTurn;
  const minted = Math.floor(pool.accumulator / PER_MILLE);
  pool.accumulator -= minted * PER_MILLE;
  for (let issued = 0; issued < minted; issued += 1) {
    const token = MOVE_TOKENS[pool.rotation % MOVE_TOKENS.length] ?? 'forward';
    const ages = pool[token];
    ages[0] = (ages[0] ?? 0) + 1;
    pool.rotation = (pool.rotation + 1) % MOVE_TOKENS.length;
  }
  return minted;
}

export function ageTokens(pool: TokenPool): number {
  let expired = 0;
  for (const token of MOVE_TOKENS) {
    const ages = pool[token];
    expired += ages[MOVEMENT_TOKEN_LIFETIME_TURNS - 1] ?? 0;
    ages.pop();
    ages.unshift(0);
  }
  return expired;
}

export function spendToken(pool: TokenPool, token: MoveToken): boolean {
  const ages = pool[token];
  for (let age = ages.length - 1; age >= 0; age -= 1) {
    const held = ages[age] ?? 0;
    if (held > 0) {
      ages[age] = held - 1;
      return true;
    }
  }
  return false;
}

export function movementTokenMilliPerTurnOf(
  ratePerThousandTicks: number,
  dutyOutputPerMille: number,
  bilgePerMille: number,
  throttlePerMille: number,
): number {
  const atFullDuty = Math.floor((ratePerThousandTicks * TICKS_PER_TURN) / PER_MILLE);
  const earned = Math.floor((atFullDuty * dutyOutputPerMille) / PER_MILLE);
  const throttle = Math.floor((bilgePerMille * throttlePerMille) / PER_MILLE);
  return Math.floor((earned * (PER_MILLE - throttle)) / PER_MILLE);
}

function emptyAges(): number[] {
  return Array.from({ length: MOVEMENT_TOKEN_LIFETIME_TURNS }, () => 0);
}
