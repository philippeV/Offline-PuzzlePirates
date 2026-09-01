import { createInterface } from 'node:readline';

import { handleLine } from './rpc.ts';
import { SessionRegistry } from './sessions.ts';

export function serve(input: NodeJS.ReadableStream, output: NodeJS.WritableStream): void {
  const registry = new SessionRegistry();
  const lines = createInterface({ input, crlfDelay: Infinity });
  lines.on('line', (line) => {
    const response = handleLine(line, registry);
    if (response !== null) output.write(`${response}\n`);
  });
}
