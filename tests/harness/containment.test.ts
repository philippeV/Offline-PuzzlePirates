import assert from 'node:assert/strict';
import { createInterface } from 'node:readline';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';

import {
  BILGE_SCENARIO,
  handleLine,
  serve,
  SessionRegistry,
} from '../../packages/harness/src/index.ts';

const TICKS_AT_EVENT_BUDGET = 99987;
const TICKS_OVER_EVENT_BUDGET = 99988;
const MAX_EVENTS_PER_RESPONSE = 100000;

interface AnsweredFailure {
  id: unknown;
  error: { data: { reason: string } };
}

interface Answered {
  result?: Record<string, unknown>;
  error?: { data: { reason: string } };
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

function answered(registry: SessionRegistry, method: string, params: unknown): Answered {
  const line = JSON.stringify({ jsonrpc: '2.0', id: 'call', method, params });
  return JSON.parse(handleLine(line, registry) as string) as Answered;
}

function openBilgeSession(registry: SessionRegistry): string {
  const opened = answered(registry, 'session.new', { seed: 1, scenario: BILGE_SCENARIO });
  return opened.result?.['session'] as string;
}

function statusOf(registry: SessionRegistry, session: string): Record<string, unknown> {
  const probed = answered(registry, 'sim.step', { session, ticks: 0 }).result;
  return { tick: probed?.['tick'], stateHash: probed?.['stateHash'] };
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

test('the last sim.step within the event budget is accepted and the next one is refused', () => {
  const registry = new SessionRegistry();
  const session = openBilgeSession(registry);

  const atBudget = answered(registry, 'sim.step', { session, ticks: TICKS_AT_EVENT_BUDGET });
  assert.equal((atBudget.result?.['events'] as unknown[]).length, MAX_EVENTS_PER_RESPONSE);
  assert.equal(atBudget.result?.['tick'], TICKS_AT_EVENT_BUDGET);

  const overBudget = answered(registry, 'sim.step', {
    session: openBilgeSession(registry),
    ticks: TICKS_OVER_EVENT_BUDGET,
  });
  assert.equal(overBudget.error?.data.reason, 'limit-exceeded');
});

test('a sim.step refused by the event budget leaves the session exactly where it was', () => {
  const registry = new SessionRegistry();
  const session = openBilgeSession(registry);
  const before = statusOf(registry, session);

  const refused = answered(registry, 'sim.step', { session, ticks: TICKS_OVER_EVENT_BUDGET });

  assert.equal(refused.error?.data.reason, 'limit-exceeded');
  assert.deepEqual(statusOf(registry, session), before);
});

test('a sim.runUntil refused by the event budget leaves the session exactly where it was', () => {
  const registry = new SessionRegistry();
  const session = openBilgeSession(registry);
  const before = statusOf(registry, session);

  const refused = answered(registry, 'sim.runUntil', {
    session,
    pointer: '/tick',
    equals: -1,
    maxTicks: TICKS_OVER_EVENT_BUDGET,
  });

  assert.equal(refused.error?.data.reason, 'limit-exceeded');
  assert.deepEqual(statusOf(registry, session), before);
});
