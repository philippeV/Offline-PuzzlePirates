import { Sim } from '@opp/sim';

import { RpcError } from './errors.ts';

export const DEFAULT_SCENARIO = 'marker-field';

const declaredBuilders: Record<string, (seed: number) => Sim> = {
  [DEFAULT_SCENARIO]: (seed) => Sim.create({ seed }),
};

const BUILDERS: Record<string, (seed: number) => Sim> = Object.assign(
  Object.create(null),
  declaredBuilders,
);

export function createScenarioSim(seed: number, scenario: string | undefined): Sim {
  const name = scenario ?? DEFAULT_SCENARIO;
  const build = BUILDERS[name];
  if (build === undefined) throw new RpcError('scenario-unknown', `no scenario named "${name}"`);
  return build(seed);
}
