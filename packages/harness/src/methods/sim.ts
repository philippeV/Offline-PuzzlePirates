import type { Sim, SimEvent } from '@opp/sim';

import { parseCommand } from '../commands.ts';
import { RpcError } from '../errors.ts';
import { deepEquals } from '../json.ts';
import {
  MAX_COMMANDS_PER_REQUEST,
  MAX_EVENTS_PER_RESPONSE,
  MAX_TICKS_PER_RUN,
  MAX_TICKS_PER_STEP,
} from '../limits.ts';
import type { MethodHandler } from '../method.ts';
import {
  boundedArray,
  boundedCount,
  paramsOf,
  requiredMember,
  requiredString,
} from '../params.ts';
import { readPointer } from '../pointer.ts';
import { sessionOf, statusOf } from '../sessions.ts';

interface RunOutcome {
  matched: boolean;
  ticksStepped: number;
  events: SimEvent[];
}

export const simMethods: Record<string, MethodHandler> = {
  'sim.dispatch': (params, registry) => {
    const fields = paramsOf(params);
    const session = sessionOf(registry, fields);
    const commands = boundedArray(fields, 'commands', MAX_COMMANDS_PER_REQUEST).map(parseCommand);
    const results = commands.map((command) => session.sim.dispatch(command));
    return { results, ...statusOf(session) };
  },

  'sim.step': (params, registry) => {
    const fields = paramsOf(params);
    const session = sessionOf(registry, fields);
    const events = stepWithinEventBudget(
      session.sim,
      boundedCount(fields, 'ticks', MAX_TICKS_PER_STEP),
    );
    return { events, ...statusOf(session) };
  },

  'sim.runUntil': (params, registry) => {
    const fields = paramsOf(params);
    const session = sessionOf(registry, fields);
    const outcome = stepUntilPointerEquals(
      session.sim,
      requiredString(fields, 'pointer'),
      requiredMember(fields, 'equals'),
      boundedCount(fields, 'maxTicks', MAX_TICKS_PER_RUN),
    );
    return { ...outcome, ...statusOf(session) };
  },
};

function stepWithinEventBudget(sim: Sim, ticks: number): SimEvent[] {
  return atomically(sim, () => {
    const events: SimEvent[] = [];
    for (let stepped = 0; stepped < ticks; stepped += 1) {
      events.push(...sim.step(1));
      refuseBeyondEventBudget(events);
    }
    return events;
  });
}

function atomically<T>(sim: Sim, stepping: () => T): T {
  const before = sim.snapshot();
  try {
    return stepping();
  } catch (failure) {
    sim.restore(before);
    throw failure;
  }
}

function refuseBeyondEventBudget(events: SimEvent[]): void {
  if (events.length > MAX_EVENTS_PER_RESPONSE) {
    throw new RpcError(
      'limit-exceeded',
      `a request may emit at most ${MAX_EVENTS_PER_RESPONSE} events`,
    );
  }
}

function stepUntilPointerEquals(
  sim: Sim,
  pointer: string,
  expected: unknown,
  maxTicks: number,
): RunOutcome {
  return atomically(sim, () => {
    const events: SimEvent[] = [];
    for (let ticksStepped = 0; ; ticksStepped += 1) {
      if (deepEquals(readPointer(sim.state, pointer), expected)) {
        return { matched: true, ticksStepped, events };
      }
      if (ticksStepped === maxTicks) return { matched: false, ticksStepped, events };
      events.push(...sim.step(1));
      refuseBeyondEventBudget(events);
    }
  });
}
