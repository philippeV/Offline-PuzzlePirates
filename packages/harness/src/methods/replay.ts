import { parseCommand } from '../commands.ts';
import type { MethodHandler } from '../method.ts';
import {
  optionalArray,
  paramsOf,
  requiredArray,
  requiredCount,
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
      commands: requiredArray(fields, 'commands').map(parseReplayCommand),
      hashTrail: (optionalArray(fields, 'hashTrail') ?? []).map(parseCheckpoint),
      expectedHash: requiredString(fields, 'expectedHash'),
    });
  },
};

function parseReplayCommand(value: unknown): ReplayCommand {
  const fields = paramsOf(value);
  const command = parseCommand(requiredMember(fields, 'command'));
  return { tick: requiredCount(fields, 'tick'), command };
}

function parseCheckpoint(value: unknown): ReplayCheckpoint {
  const fields = paramsOf(value);
  return { tick: requiredCount(fields, 'tick'), hash: requiredString(fields, 'hash') };
}
