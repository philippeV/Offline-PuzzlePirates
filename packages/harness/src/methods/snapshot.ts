import type { MethodHandler } from '../method.ts';
import { paramsOf, requiredString } from '../params.ts';
import { sessionOf, snapshotOf, statusOf, takeSnapshot } from '../sessions.ts';

export const snapshotMethods: Record<string, MethodHandler> = {
  'snapshot.take': (params, registry) => {
    const fields = paramsOf(params);
    const session = sessionOf(registry, fields);
    return { snapshotId: takeSnapshot(session), ...statusOf(session) };
  },

  'snapshot.restore': (params, registry) => {
    const fields = paramsOf(params);
    const session = sessionOf(registry, fields);
    const snapshotId = requiredString(fields, 'snapshotId');
    session.sim.restore(snapshotOf(session, snapshotId));
    return { snapshotId, ...statusOf(session) };
  },
};
