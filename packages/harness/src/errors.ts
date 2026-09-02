export type RpcErrorReason =
  | 'parse-error'
  | 'invalid-request'
  | 'method-unknown'
  | 'invalid-params'
  | 'internal-error'
  | 'session-unknown'
  | 'snapshot-unknown'
  | 'scenario-unknown'
  | 'pointer-unknown'
  | 'limit-exceeded';

const CODES: Record<RpcErrorReason, number> = {
  'parse-error': -32700,
  'invalid-request': -32600,
  'method-unknown': -32601,
  'invalid-params': -32602,
  'internal-error': -32603,
  'session-unknown': -32001,
  'snapshot-unknown': -32002,
  'scenario-unknown': -32003,
  'pointer-unknown': -32004,
  'limit-exceeded': -32005,
};

export interface RpcErrorBody {
  code: number;
  message: string;
  data: { reason: RpcErrorReason };
}

export class RpcError extends Error {
  readonly reason: RpcErrorReason;

  constructor(reason: RpcErrorReason, message: string) {
    super(message);
    this.reason = reason;
  }

  get code(): number {
    return CODES[this.reason];
  }

  body(): RpcErrorBody {
    return { code: this.code, message: this.message, data: { reason: this.reason } };
  }
}

export function errorBodyOf(cause: unknown): RpcErrorBody {
  if (cause instanceof RpcError) return cause.body();
  const message = cause instanceof Error ? cause.message : String(cause);
  return new RpcError('internal-error', message).body();
}
