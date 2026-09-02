import { readFileSync, writeFileSync } from 'node:fs';

import type { Replay, ReplayCheckpoint, ReplayCommand } from '../packages/harness/src/index.ts';
import { resultOf, startHarness, type Harness } from '../tests/harness/client.ts';

const FIXTURE = process.argv[2] ?? 'packages/fixtures/replays/marker-drift.json';

export interface ReplayPlan {
  seed: number;
  scenario: string;
  commands: ReplayCommand[];
  lastTick: number;
}

export interface ReplayFixture extends Replay {
  scenario: string;
}

export async function recordReplay(harness: Harness, plan: ReplayPlan): Promise<Replay> {
  const opened = resultOf(
    await harness.call('session.new', { seed: plan.seed, scenario: plan.scenario }),
  );
  const session = opened['session'] as string;
  const hashTrail: ReplayCheckpoint[] = [];
  let hash = opened['stateHash'] as string;

  for (let tick = 0; tick <= plan.lastTick; tick += 1) {
    const issued = commandsIssuedAt(plan.commands, tick);
    if (issued.length > 0) {
      hash = await hashAfter(harness, 'sim.dispatch', { session, commands: issued });
    }
    hashTrail.push({ tick, hash });
    if (tick < plan.lastTick) {
      hash = await hashAfter(harness, 'sim.step', { session, ticks: 1 });
    }
  }

  return { seed: plan.seed, commands: plan.commands, hashTrail, finalHash: hash };
}

export function lastTickOf(fixture: ReplayFixture): number {
  const commandTicks = fixture.commands.map((entry) => entry.tick);
  const trailTicks = fixture.hashTrail.map((checkpoint) => checkpoint.tick);
  return Math.max(0, ...commandTicks, ...trailTicks);
}

function commandsIssuedAt(commands: ReplayCommand[], tick: number): ReplayCommand['command'][] {
  return commands.filter((entry) => entry.tick === tick).map((entry) => entry.command);
}

async function hashAfter(harness: Harness, method: string, params: unknown): Promise<string> {
  return resultOf(await harness.call(method, params))['stateHash'] as string;
}

async function rerecord(path: string): Promise<void> {
  const fixture = JSON.parse(readFileSync(path, 'utf8')) as ReplayFixture;
  const harness = startHarness();
  const recorded = await recordReplay(harness, {
    seed: fixture.seed,
    scenario: fixture.scenario,
    commands: fixture.commands,
    lastTick: lastTickOf(fixture),
  });
  await harness.stop();

  const written: ReplayFixture = {
    seed: recorded.seed,
    scenario: fixture.scenario,
    commands: recorded.commands,
    hashTrail: recorded.hashTrail,
    finalHash: recorded.finalHash,
  };
  writeFileSync(path, `${JSON.stringify(written, null, 2)}\n`);
  console.log(
    `${path} records ${written.hashTrail.length} checkpoints ending at ${written.finalHash}.`,
  );
}

if (import.meta.main) await rerecord(FIXTURE);
