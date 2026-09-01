import { MASK32, MASK64, joinUint64, splitUint64 } from './bits.ts';
import { fnv1a64 } from './hash.ts';

const SPLITMIX64_GAMMA = 0x9e3779b97f4a7c15n;
const SPLITMIX64_MIX_A = 0xbf58476d1ce4e5b9n;
const SPLITMIX64_MIX_B = 0x94d049bb133111ebn;
const PCG32_MULTIPLIER = 6364136223846793005n;
const UINT32_SPAN = 0x100000000;

export interface RngStreamCursor {
  hi: number;
  lo: number;
  draws: number;
}

export interface RngStreams {
  [streamName: string]: RngStreamCursor;
}

export interface RngStream {
  nextUint32(): number;
  nextIntInRange(minInclusive: number, maxExclusive: number): number;
}

export function createRngStreams(): RngStreams {
  return {};
}

export function rngStream(rootSeed: number, streams: RngStreams, streamName: string): RngStream {
  const increment = deriveIncrement(rootSeed, streamName);
  const cursor = openCursor(rootSeed, streams, streamName);
  const nextUint32 = (): number => drawUint32(cursor, increment);
  return {
    nextUint32,
    nextIntInRange(minInclusive: number, maxExclusive: number): number {
      const span = maxExclusive - minInclusive;
      if (span <= 0) throw new RangeError(`empty range ${minInclusive}..${maxExclusive}`);
      const unbiasedLimit = UINT32_SPAN - (UINT32_SPAN % span);
      let draw = nextUint32();
      while (draw >= unbiasedLimit) draw = nextUint32();
      return minInclusive + (draw % span);
    },
  };
}

function openCursor(rootSeed: number, streams: RngStreams, streamName: string): RngStreamCursor {
  const existing = streams[streamName];
  if (existing !== undefined) return existing;
  const created = { ...splitUint64(deriveSeed(rootSeed, streamName)), draws: 0 };
  streams[streamName] = created;
  return created;
}

function drawUint32(cursor: RngStreamCursor, increment: bigint): number {
  const current = joinUint64(cursor);
  const advanced = (current * PCG32_MULTIPLIER + increment) & MASK64;
  const halves = splitUint64(advanced);
  cursor.hi = halves.hi;
  cursor.lo = halves.lo;
  cursor.draws += 1;
  return permuteOutput(current);
}

function permuteOutput(state: bigint): number {
  const xorshifted = Number((((state >> 18n) ^ state) >> 27n) & MASK32);
  const rotation = Number(state >> 59n);
  return ((xorshifted >>> rotation) | (xorshifted << ((32 - rotation) & 31))) >>> 0;
}

function deriveSeed(rootSeed: number, streamName: string): bigint {
  return splitmix64(BigInt(rootSeed >>> 0) ^ fnv1a64(streamName));
}

function deriveIncrement(rootSeed: number, streamName: string): bigint {
  return ((splitmix64(deriveSeed(rootSeed, streamName)) << 1n) | 1n) & MASK64;
}

function splitmix64(value: bigint): bigint {
  let mixed = (value + SPLITMIX64_GAMMA) & MASK64;
  mixed = ((mixed ^ (mixed >> 30n)) * SPLITMIX64_MIX_A) & MASK64;
  mixed = ((mixed ^ (mixed >> 27n)) * SPLITMIX64_MIX_B) & MASK64;
  return mixed ^ (mixed >> 31n);
}
