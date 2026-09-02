import { MASK64 } from './bits.ts';

const FNV64_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV64_PRIME = 0x100000001b3n;

export function canonicalJson(value: unknown): string {
  return serialiseValue(value);
}

export function fnv1a64(text: string): bigint {
  let hash = FNV64_OFFSET_BASIS;
  for (const byte of littleEndianBytes(text)) {
    hash = ((hash ^ BigInt(byte)) * FNV64_PRIME) & MASK64;
  }
  return hash;
}

export function hashCanonical(value: unknown): string {
  return fnv1a64(canonicalJson(value)).toString(16).padStart(16, '0');
}

function* littleEndianBytes(text: string): Generator<number> {
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    yield unit & 0xff;
    yield unit >>> 8;
  }
}

function serialiseValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return serialiseNumber(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(serialiseValue).join(',')}]`;
  if (typeof value === 'object') return serialiseObject(value as Record<string, unknown>);
  throw new TypeError(`canonical json cannot serialise a value of type ${typeof value}`);
}

function serialiseNumber(value: number): string {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`simulation state holds safe integers only, found ${value}`);
  }
  return String(value);
}

function serialiseObject(value: Record<string, unknown>): string {
  const fields = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${serialiseValue(value[key])}`);
  return `{${fields.join(',')}}`;
}
