import assert from 'node:assert/strict';
import { createInterface } from 'node:readline';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';

import { handleLine, serve, SessionRegistry } from '../../packages/harness/src/index.ts';

interface AnsweredFailure {
  id: unknown;
  error: { data: { reason: string } };
}

function request(id: unknown): string {
  return JSON.stringify({ jsonrpc: '2.0', id, method: 'session.new', params: { seed: 1 } });
}

function carries(member: string): (value: unknown) => boolean {
  return (value) => typeof value === 'object' && value !== null && member in value;
}

async function whileStringifyRefuses<T>(
  refused: (value: unknown) => boolean,
  body: () => T | Promise<T>,
): Promise<T> {
  const real = JSON.stringify;
  JSON.stringify = ((value: unknown, ...rest: unknown[]) => {
    if (refused(value)) throw new Error('this value does not serialise');
    return (real as (...args: unknown[]) => string)(value, ...rest);
  }) as typeof JSON.stringify;
  try {
    return await body();
  } finally {
    JSON.stringify = real;
  }
}

function answers(output: NodeJS.ReadableStream): () => Promise<string> {
  const waiting: ((line: string) => void)[] = [];
  const arrived: string[] = [];
  createInterface({ input: output }).on('line', (line) => {
    const resolve = waiting.shift();
    if (resolve === undefined) arrived.push(line);
    else resolve(line);
  });
  return () =>
    new Promise((resolve) => {
      const line = arrived.shift();
      if (line === undefined) waiting.push(resolve);
      else resolve(line);
    });
}

test('a result that cannot be serialised is answered against its own request id', async () => {
  const registry = new SessionRegistry();

  const answer = await whileStringifyRefuses(carries('result'), () =>
    handleLine(request('open-me'), registry),
  );

  const failure = JSON.parse(answer as string) as AnsweredFailure;
  assert.equal(failure.id, 'open-me');
  assert.equal(failure.error.data.reason, 'internal-error');
});

test('an unbounded request id is not echoed back into the failure', async () => {
  const registry = new SessionRegistry();

  const answer = await whileStringifyRefuses(carries('result'), () =>
    handleLine(request('x'.repeat(257)), registry),
  );

  assert.equal((JSON.parse(answer as string) as AnsweredFailure).id, null);
});

test('a failure the fallback cannot serialise is still answered, and serving continues', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  serve(input, output);
  const nextAnswer = answers(output);

  const opening = `${request('open-me')}\n`;
  const contained = await whileStringifyRefuses(carries('jsonrpc'), () => {
    input.write(opening);
    return nextAnswer();
  });

  const failure = JSON.parse(contained) as AnsweredFailure;
  assert.equal(failure.id, null);
  assert.equal(failure.error.data.reason, 'internal-error');

  input.write(`${request('and-again')}\n`);
  const served = JSON.parse(await nextAnswer()) as { id: unknown; result: unknown };
  assert.equal(served.id, 'and-again');
  assert.notEqual(served.result, undefined);
});
