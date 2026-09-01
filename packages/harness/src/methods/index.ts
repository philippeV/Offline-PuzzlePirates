import type { MethodHandler } from '../method.ts';

import { replayMethods } from './replay.ts';
import { rngMethods } from './rng.ts';
import { sessionMethods } from './session.ts';
import { simMethods } from './sim.ts';
import { snapshotMethods } from './snapshot.ts';
import { stateMethods } from './state.ts';

export const methods: Record<string, MethodHandler> = {
  ...sessionMethods,
  ...simMethods,
  ...stateMethods,
  ...snapshotMethods,
  ...replayMethods,
  ...rngMethods,
};
