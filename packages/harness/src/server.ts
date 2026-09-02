import { createInterface } from 'node:readline';

import { RpcError } from './errors.ts';
import { handleLine } from './rpc.ts';
import { SessionRegistry } from './sessions.ts';

const UNANSWERABLE = JSON.stringify({
  jsonrpc: '2.0',
  id: null,
  error: new RpcError('internal-error', 'the request could not be answered').body(),
});

export function serve(input: NodeJS.ReadableStream, output: NodeJS.WritableStream): void {
  const registry = new SessionRegistry();
  const lines = createInterface({ input, crlfDelay: Infinity });
  lines.on('line', (line) => {
    const response = answer(line, registry);
    if (response !== null) output.write(`${response}\n`);
  });
}

function answer(line: string, registry: SessionRegistry): string | null {
  try {
    return handleLine(line, registry);
  } catch {
    return UNANSWERABLE;
  }
}
