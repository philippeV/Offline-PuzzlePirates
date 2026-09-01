import { errorBodyOf, RpcError, type RpcErrorBody } from './errors.ts';
import { isRecord } from './json.ts';
import type { MethodHandler } from './method.ts';
import { methods } from './methods/index.ts';
import type { SessionRegistry } from './sessions.ts';

export type RpcId = string | number | null;

export interface RpcSuccess {
  jsonrpc: '2.0';
  id: RpcId;
  result: unknown;
}

export interface RpcFailure {
  jsonrpc: '2.0';
  id: RpcId;
  error: RpcErrorBody;
}

export type RpcResponse = RpcSuccess | RpcFailure;

export function handleLine(line: string, registry: SessionRegistry): string | null {
  if (line.trim() === '') return null;
  return JSON.stringify(respond(line, registry));
}

function respond(line: string, registry: SessionRegistry): RpcResponse {
  let request: unknown;
  try {
    request = JSON.parse(line);
  } catch (cause) {
    return { jsonrpc: '2.0', id: null, error: parseErrorBody(cause) };
  }
  return invoke(request, registry);
}

function invoke(request: unknown, registry: SessionRegistry): RpcResponse {
  const id = idOf(request);
  try {
    const handler = handlerFor(request);
    return { jsonrpc: '2.0', id, result: handler(paramsFrom(request), registry) };
  } catch (cause) {
    return { jsonrpc: '2.0', id, error: errorBodyOf(cause) };
  }
}

function handlerFor(request: unknown): MethodHandler {
  if (!isRecord(request) || request['jsonrpc'] !== '2.0') {
    throw new RpcError('invalid-request', 'a request is an object with "jsonrpc": "2.0"');
  }
  const method = request['method'];
  if (typeof method !== 'string') {
    throw new RpcError('invalid-request', 'a request carries a string "method"');
  }
  const handler = methods[method];
  if (handler === undefined) throw new RpcError('method-unknown', `no method named "${method}"`);
  return handler;
}

function paramsFrom(request: unknown): unknown {
  return isRecord(request) ? request['params'] : undefined;
}

function idOf(request: unknown): RpcId {
  if (!isRecord(request)) return null;
  const id = request['id'];
  return typeof id === 'string' || typeof id === 'number' ? id : null;
}

function parseErrorBody(cause: unknown): RpcErrorBody {
  const message = cause instanceof Error ? cause.message : String(cause);
  return new RpcError('parse-error', message).body();
}
