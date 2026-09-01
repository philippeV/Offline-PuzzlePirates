import type { Sim, SimEvent } from '@opp/sim';

import { parseCommand } from '../commands.ts';
import { deepEquals } from '../json.ts';
import type { MethodHandler } from '../method.ts';
import {
  paramsOf,
  requiredArray,
  requiredCount,
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
    const commands = requiredArray(fields, 'commands').map(parseCommand);
    const results = commands.map((command) => session.sim.dispatch(command));
    return { results, ...statusOf(session) };
  },

  'sim.step': (params, registry) => {
    const fields = paramsOf(params);
    const session = sessionOf(registry, fields);
    const events = session.sim.step(requiredCount(fields, 'ticks'));
    return { events, ...statusOf(session) };
  },

  'sim.runUntil': (params, registry) => {
    const fields = paramsOf(params);
    const session = sessionOf(registry, fields);
    const outcome = stepUntilPointerEquals(
      session.sim,
      requiredString(fields, 'pointer'),
      requiredMember(fields, 'equals'),
      requiredCount(fields, 'maxTicks'),
    );
    return { ...outcome, ...statusOf(session) };
  },
};

function stepUntilPointerEquals(
  sim: Sim,
  pointer: string,
  expected: unknown,
  maxTicks: number,
): RunOutcome {
  const events: SimEvent[] = [];
  for (let ticksStepped = 0; ; ticksStepped += 1) {
    if (deepEquals(readPointer(sim.state, pointer), expected)) {
      return { matched: true, ticksStepped, events };
    }
    if (ticksStepped === maxTicks) return { matched: false, ticksStepped, events };
    events.push(...sim.step(1));
  }
}
