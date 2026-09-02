import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BIN = 'packages/harness/bin/pp-harness.ts';

export interface RpcFailureBody {
  code: number;
  message: string;
  data: { reason: string };
}

export interface HarnessResponse {
  jsonrpc: string;
  id: string | number | null;
  result?: unknown;
  error?: RpcFailureBody;
}

type ResponseHandler = (response: HarnessResponse) => void;

export interface Harness {
  call(method: string, params?: unknown): Promise<HarnessResponse>;
  sendLine(line: string): Promise<HarnessResponse>;
  stop(): Promise<void>;
}

export function startHarness(): Harness {
  const child = spawn(process.execPath, [BIN], {
    cwd: REPO_ROOT,
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const pending: ResponseHandler[] = [];
  readResponses(child, pending);

  const sendLine = (line: string): Promise<HarnessResponse> =>
    new Promise((resolve) => {
      pending.push(resolve);
      child.stdin?.write(`${line}\n`);
    });

  let nextId = 0;
  return {
    sendLine,
    call(method, params) {
      nextId += 1;
      return sendLine(JSON.stringify({ jsonrpc: '2.0', id: nextId, method, params }));
    },
    async stop() {
      child.stdin?.end();
      await once(child, 'close');
    },
  };
}

export function resultOf(response: HarnessResponse): Record<string, unknown> {
  if (response.error !== undefined) {
    throw new Error(`unexpected rpc error: ${response.error.message}`);
  }
  return response.result as Record<string, unknown>;
}

export function reasonOf(response: HarnessResponse): string {
  if (response.error === undefined) throw new Error('expected an rpc error, got a result');
  return response.error.data.reason;
}

function readResponses(child: ChildProcess, pending: ResponseHandler[]): void {
  if (child.stdout === null) throw new Error('the harness process has no stdout');
  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    const resolve = pending.shift();
    if (resolve !== undefined) resolve(JSON.parse(line) as HarnessResponse);
  });
}
