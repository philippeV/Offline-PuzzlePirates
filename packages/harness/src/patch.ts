import { deepEquals, isRecord } from './json.ts';
import { escapePointerToken } from './pointer.ts';

export type PatchOperation =
  | { op: 'add'; path: string; value: unknown }
  | { op: 'remove'; path: string }
  | { op: 'replace'; path: string; value: unknown };

export function jsonPatch(source: unknown, target: unknown): PatchOperation[] {
  const operations: PatchOperation[] = [];
  collectOperations(operations, '', source, target);
  return operations;
}

function collectOperations(
  operations: PatchOperation[],
  path: string,
  source: unknown,
  target: unknown,
): void {
  if (deepEquals(source, target)) return;
  if (Array.isArray(source) && Array.isArray(target)) {
    collectElementOperations(operations, path, source, target);
    return;
  }
  if (isRecord(source) && isRecord(target)) {
    collectMemberOperations(operations, path, source, target);
    return;
  }
  operations.push({ op: 'replace', path, value: target });
}

function collectElementOperations(
  operations: PatchOperation[],
  path: string,
  source: unknown[],
  target: unknown[],
): void {
  for (let index = source.length - 1; index >= target.length; index -= 1) {
    operations.push({ op: 'remove', path: `${path}/${index}` });
  }
  const shared = Math.min(source.length, target.length);
  for (let index = 0; index < shared; index += 1) {
    collectOperations(operations, `${path}/${index}`, source[index], target[index]);
  }
  for (let index = source.length; index < target.length; index += 1) {
    operations.push({ op: 'add', path: `${path}/${index}`, value: target[index] });
  }
}

function collectMemberOperations(
  operations: PatchOperation[],
  path: string,
  source: Record<string, unknown>,
  target: Record<string, unknown>,
): void {
  for (const key of Object.keys(source).sort()) {
    if (!(key in target)) operations.push({ op: 'remove', path: memberPath(path, key) });
  }
  for (const key of Object.keys(target).sort()) {
    if (key in source) {
      collectOperations(operations, memberPath(path, key), source[key], target[key]);
    } else {
      operations.push({ op: 'add', path: memberPath(path, key), value: target[key] });
    }
  }
}

function memberPath(path: string, key: string): string {
  return `${path}/${escapePointerToken(key)}`;
}
