import { RpcError } from './errors.ts';
import { isRecord } from './json.ts';

const ARRAY_INDEX = /^(?:0|[1-9][0-9]*)$/;

export function readPointer(root: unknown, pointer: string): unknown {
  return tokensOf(pointer).reduce(descend, root);
}

export function escapePointerToken(token: string): string {
  return token.replaceAll('~', '~0').replaceAll('/', '~1');
}

export function truncateToDepth(value: unknown, depth: number): unknown {
  if (Array.isArray(value)) {
    if (depth <= 0) return `[${value.length} items]`;
    return value.map((item) => truncateToDepth(item, depth - 1));
  }
  if (isRecord(value)) {
    const keys = Object.keys(value);
    if (depth <= 0) return `{${keys.length} fields}`;
    return Object.fromEntries(keys.map((key) => [key, truncateToDepth(value[key], depth - 1)]));
  }
  return value;
}

function tokensOf(pointer: string): string[] {
  if (pointer === '') return [];
  if (!pointer.startsWith('/')) {
    throw new RpcError('invalid-params', `a json pointer starts with "/", got "${pointer}"`);
  }
  return pointer
    .slice(1)
    .split('/')
    .map((token) => token.replaceAll('~1', '/').replaceAll('~0', '~'));
}

function descend(value: unknown, token: string): unknown {
  if (Array.isArray(value)) return elementAt(value, token);
  if (isRecord(value)) return memberOf(value, token);
  throw new RpcError('pointer-unknown', `"${token}" cannot be read from a leaf value`);
}

function elementAt(value: unknown[], token: string): unknown {
  if (!ARRAY_INDEX.test(token) || Number(token) >= value.length) {
    throw new RpcError('pointer-unknown', `no element "${token}" in an array of ${value.length}`);
  }
  return value[Number(token)];
}

function memberOf(value: Record<string, unknown>, token: string): unknown {
  if (!Object.hasOwn(value, token)) throw new RpcError('pointer-unknown', `no member "${token}"`);
  return value[token];
}
