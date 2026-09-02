import { SCHEMA_VERSION, Sim } from '@opp/sim';

import { RpcError } from '../errors.ts';
import { MAX_SAVE_LENGTH } from '../limits.ts';
import type { MethodHandler } from '../method.ts';
import { optionalString, paramsOf, requiredInteger, requiredString } from '../params.ts';
import { statusOf } from '../sessions.ts';

const LOADED_SESSION_SEED = 0;

export const sessionMethods: Record<string, MethodHandler> = {
  'session.new': (params, registry) => {
    const fields = paramsOf(params);
    const seed = requiredInteger(fields, 'seed');
    const { id, session } = registry.open(seed, optionalString(fields, 'scenario'));
    return { session: id, schemaVersion: SCHEMA_VERSION, ...statusOf(session) };
  },

  'session.load': (params, registry) => {
    const fields = paramsOf(params);
    const sim = loadSim(boundedSave(fields));
    const { id, session } = registry.open(LOADED_SESSION_SEED, undefined);
    session.sim = sim;
    return { session: id, schemaVersion: SCHEMA_VERSION, ...statusOf(session) };
  },
};

function boundedSave(fields: Record<string, unknown>): string {
  const save = requiredString(fields, 'save');
  if (save.length > MAX_SAVE_LENGTH) {
    throw new RpcError(
      'limit-exceeded',
      `params.save must not exceed ${MAX_SAVE_LENGTH} characters`,
    );
  }
  return save;
}

function loadSim(save: string): Sim {
  try {
    return Sim.load(save);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new RpcError('invalid-params', `params.save is not a loadable save: ${message}`);
  }
}
