import type { Command, Sim } from '@opp/sim';

import { createScenarioSim } from './scenarios.ts';

export interface ReplayCommand {
  tick: number;
  command: Command;
}

export interface ReplayCheckpoint {
  tick: number;
  hash: string;
}

export interface Replay {
  seed: number;
  commands: ReplayCommand[];
  hashTrail: ReplayCheckpoint[];
  finalHash: string;
}

export interface ReplayVerification {
  ok: boolean;
  tick: number;
  finalHash: string;
  expectedHash: string;
  divergedAtTick: number | null;
}

export interface ReplayRun {
  seed: number;
  scenario?: string | undefined;
  commands: ReplayCommand[];
  hashTrail: ReplayCheckpoint[];
  expectedHash: string;
}

export function verifyReplay(run: ReplayRun): ReplayVerification {
  const sim = createScenarioSim(run.seed, run.scenario);
  const recorded = new Map(run.hashTrail.map((checkpoint) => [checkpoint.tick, checkpoint.hash]));
  const lastTick = lastTickOf(run);
  let divergedAtTick: number | null = null;

  for (let tick = 0; tick <= lastTick; tick += 1) {
    dispatchIssuedAt(sim, run.commands, tick);
    divergedAtTick = divergenceAt(sim, recorded, divergedAtTick);
    if (tick < lastTick) sim.step(1);
  }

  const finalHash = sim.hash();
  return {
    ok: divergedAtTick === null && finalHash === run.expectedHash,
    tick: sim.state.tick,
    finalHash,
    expectedHash: run.expectedHash,
    divergedAtTick,
  };
}

function lastTickOf(run: ReplayRun): number {
  const commandTicks = run.commands.map((entry) => entry.tick);
  const trailTicks = run.hashTrail.map((checkpoint) => checkpoint.tick);
  return Math.max(0, ...commandTicks, ...trailTicks);
}

function dispatchIssuedAt(sim: Sim, commands: ReplayCommand[], tick: number): void {
  for (const entry of commands) {
    if (entry.tick === tick) sim.dispatch(entry.command);
  }
}

function divergenceAt(
  sim: Sim,
  recorded: Map<number, string>,
  found: number | null,
): number | null {
  if (found !== null) return found;
  const tick = sim.state.tick;
  const expected = recorded.get(tick);
  if (expected === undefined || expected === sim.hash()) return null;
  return tick;
}
