import { RpcError } from './errors.ts';
import { isRecord } from './json.ts';

export function paramsOf(params: unknown): Record<string, unknown> {
  if (!isRecord(params)) throw new RpcError('invalid-params', 'params must be an object');
  return params;
}

export function requiredMember(fields: Record<string, unknown>, key: string): unknown {
  if (!(key in fields)) throw new RpcError('invalid-params', `params.${key} is required`);
  return fields[key];
}

export function requiredString(fields: Record<string, unknown>, key: string): string {
  const value = requiredMember(fields, key);
  if (typeof value !== 'string') {
    throw new RpcError('invalid-params', `params.${key} must be a string`);
  }
  return value;
}

export function requiredInteger(fields: Record<string, unknown>, key: string): number {
  const value = requiredMember(fields, key);
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new RpcError('invalid-params', `params.${key} must be a safe integer`);
  }
  return value;
}

export function requiredCount(fields: Record<string, unknown>, key: string): number {
  const value = requiredInteger(fields, key);
  if (value < 0) throw new RpcError('invalid-params', `params.${key} must not be negative`);
  return value;
}

export function boundedCount(
  fields: Record<string, unknown>,
  key: string,
  limit: number,
): number {
  const value = requiredCount(fields, key);
  if (value > limit) {
    throw new RpcError('limit-exceeded', `params.${key} must not exceed ${limit}`);
  }
  return value;
}

export function requiredArray(fields: Record<string, unknown>, key: string): unknown[] {
  const value = requiredMember(fields, key);
  if (!Array.isArray(value)) throw new RpcError('invalid-params', `params.${key} must be an array`);
  return value;
}

export function boundedArray(
  fields: Record<string, unknown>,
  key: string,
  limit: number,
): unknown[] {
  const value = requiredArray(fields, key);
  if (value.length > limit) {
    throw new RpcError('limit-exceeded', `params.${key} must not exceed ${limit} entries`);
  }
  return value;
}

export function optionalString(fields: Record<string, unknown>, key: string): string | undefined {
  return key in fields ? requiredString(fields, key) : undefined;
}

export function optionalBoolean(
  fields: Record<string, unknown>,
  key: string,
): boolean | undefined {
  if (!(key in fields)) return undefined;
  const value = fields[key];
  if (typeof value !== 'boolean') {
    throw new RpcError('invalid-params', `params.${key} must be a boolean`);
  }
  return value;
}

export function optionalCount(fields: Record<string, unknown>, key: string): number | undefined {
  return key in fields ? requiredCount(fields, key) : undefined;
}

export function optionalArray(fields: Record<string, unknown>, key: string): unknown[] | undefined {
  return key in fields ? requiredArray(fields, key) : undefined;
}

export function optionalBoundedArray(
  fields: Record<string, unknown>,
  key: string,
  limit: number,
): unknown[] | undefined {
  return key in fields ? boundedArray(fields, key, limit) : undefined;
}
