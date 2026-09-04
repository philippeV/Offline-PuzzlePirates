import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createTicker, type Ticker } from '../../packages/view/src/ticker.ts';

interface FrameQueue {
  readonly armed: number;
  fire(now: number): void;
  restore(): void;
}

function stubAnimationFrames(): FrameQueue {
  const requested = new Map<number, (now: number) => void>();
  const previousRequest = globalThis.requestAnimationFrame;
  const previousCancel = globalThis.cancelAnimationFrame;
  let nextHandle = 1;

  globalThis.requestAnimationFrame = (callback) => {
    const handle = nextHandle;
    nextHandle += 1;
    requested.set(handle, callback);
    return handle;
  };
  globalThis.cancelAnimationFrame = (handle) => {
    requested.delete(handle);
  };

  return {
    get armed(): number {
      return requested.size;
    },
    fire(now: number): void {
      const due = [...requested.values()];
      requested.clear();
      for (const callback of due) callback(now);
    },
    restore(): void {
      globalThis.requestAnimationFrame = previousRequest;
      globalThis.cancelAnimationFrame = previousCancel;
    },
  };
}

test('a throwing frame costs one frame and not the loop', (t) => {
  const frames = stubAnimationFrames();
  t.after(() => frames.restore());
  let steps = 0;
  const ticker = createTicker(() => {
    steps += 1;
    if (steps === 1) throw new Error('the frame be broken');
  });

  ticker.start();
  assert.throws(() => frames.fire(16));
  frames.fire(32);

  assert.equal(steps, 2);
});

test('a ticker that reports itself running has a frame armed', (t) => {
  const frames = stubAnimationFrames();
  t.after(() => frames.restore());
  const ticker = createTicker(() => {
    throw new Error('the frame be broken');
  });

  ticker.start();
  assert.throws(() => frames.fire(16));

  assert.ok(ticker.running);
  assert.equal(frames.armed, 1);
});

test('a ticker stopped from inside a frame arms no other', (t) => {
  const frames = stubAnimationFrames();
  t.after(() => frames.restore());
  let steps = 0;
  const ticker: Ticker = createTicker(() => {
    steps += 1;
    ticker.stop();
  });

  ticker.start();
  frames.fire(16);

  assert.equal(ticker.running, false);
  assert.equal(frames.armed, 0);
  frames.fire(32);
  assert.equal(steps, 1);
});
