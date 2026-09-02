import { parseCommand } from '../commands.ts';
import { MAX_REPLAY_ENTRIES, MAX_REPLAY_TICK } from '../limits.ts';
import type { MethodHandler } from '../method.ts';
import {
  boundedArray,
  boundedCount,
  optionalBoundedArray,
  paramsOf,
  requiredInteger,
  requiredMember,
  requiredString,
} from '../params.ts';
import { verifyReplay, type ReplayCheckpoint, type ReplayCommand } from '../replay.ts';

export const replayMethods: Record<string, MethodHandler> = {
  'replay.verify': (params) => {
    const fields = paramsOf(params);
    return verifyReplay({
      seed: requiredInteger(fields, 'seed'),
      commands: boundedArray(fields, 'commands', MAX_REPLAY_ENTRIES).map(parseReplayCommand),
      hashTrail: (optionalBoundedArray(fields, 'hashTrail', MAX_REPLAY_ENTRIES) ?? []).map(
        parseCheckpoint,
      ),
      expectedHash: requiredString(fields, 'expectedHash'),
    });
  },
};

function parseReplayCommand(value: unknown): ReplayCommand {
  const fields = paramsOf(value);
  const command = parseCommand(requiredMember(fields, 'command'));
  return { tick: boundedCount(fields, 'tick', MAX_REPLAY_TICK), command };
}

function parseCheckpoint(value: unknown): ReplayCheckpoint {
  const fields = paramsOf(value);
  return {
    tick: boundedCount(fields, 'tick', MAX_REPLAY_TICK),
    hash: requiredString(fields, 'hash'),
  };
}
