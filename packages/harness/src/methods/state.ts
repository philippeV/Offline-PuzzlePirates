import type { MethodHandler } from '../method.ts';
import { optionalCount, paramsOf, requiredString } from '../params.ts';
import { jsonPatch } from '../patch.ts';
import { readPointer, truncateToDepth } from '../pointer.ts';
import { sessionOf, snapshotOf } from '../sessions.ts';

export const stateMethods: Record<string, MethodHandler> = {
  'state.get': (params, registry) => {
    const fields = paramsOf(params);
    const session = sessionOf(registry, fields);
    const value = readPointer(session.sim.state, requiredString(fields, 'pointer'));
    const depth = optionalCount(fields, 'depth');
    return { value: depth === undefined ? value : truncateToDepth(value, depth) };
  },

  'state.diff': (params, registry) => {
    const fields = paramsOf(params);
    const session = sessionOf(registry, fields);
    const snapshot = snapshotOf(session, requiredString(fields, 'fromSnapshotId'));
    return { patch: jsonPatch(snapshot, session.sim.state) };
  },
};
