import { Sim } from '@opp/sim';

import { BALANCE } from './balance.ts';
import { RpcError } from './errors.ts';

export const DEFAULT_SCENARIO = 'marker-field';
export const BILGE_SCENARIO = 'bilge-session';

const BILGING_PUZZLE = 'bilging';

const declaredBuilders: Record<string, (seed: number) => Sim> = {
  [DEFAULT_SCENARIO]: (seed) => Sim.create({ seed }),
  [BILGE_SCENARIO]: (seed) => openBilgeSession(seed),
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

function openBilgeSession(seed: number): Sim {
  const sim = Sim.create({ seed, balance: BALANCE });
  const started = sim.dispatch({ op: 'puzzle.start', puzzle: BILGING_PUZZLE });
  if (started.status === 'rejected') {
    throw new RpcError('internal-error', `the ${BILGE_SCENARIO} scenario was ${started.reason}`);
  }
  return sim;
}
