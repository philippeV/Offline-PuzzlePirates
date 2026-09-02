export const MASK64 = 0xffffffffffffffffn;
export const MASK32 = 0xffffffffn;

export interface Uint64Halves {
  hi: number;
  lo: number;
}

export function splitUint64(value: bigint): Uint64Halves {
  return { hi: Number((value >> 32n) & MASK32), lo: Number(value & MASK32) };
}

export function joinUint64(halves: Uint64Halves): bigint {
  return ((BigInt(halves.hi) << 32n) | BigInt(halves.lo)) & MASK64;
}
