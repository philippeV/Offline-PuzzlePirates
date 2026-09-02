import type { MethodHandler } from '../method.ts';
import { paramsOf } from '../params.ts';
import { sessionOf } from '../sessions.ts';

export const rngMethods: Record<string, MethodHandler> = {
  'rng.cursors': (params, registry) => {
    const session = sessionOf(registry, paramsOf(params));
    return { cursors: session.sim.state.rngStreams };
  },
};
