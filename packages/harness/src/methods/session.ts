import { SCHEMA_VERSION } from '@opp/sim';

import type { MethodHandler } from '../method.ts';
import { optionalString, paramsOf, requiredInteger } from '../params.ts';
import { statusOf } from '../sessions.ts';

export const sessionMethods: Record<string, MethodHandler> = {
  'session.new': (params, registry) => {
    const fields = paramsOf(params);
    const seed = requiredInteger(fields, 'seed');
    const { id, session } = registry.open(seed, optionalString(fields, 'scenario'));
    return { session: id, schemaVersion: SCHEMA_VERSION, ...statusOf(session) };
  },
};
