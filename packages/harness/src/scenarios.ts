import { Sim, type Command } from '@opp/sim';

import { BALANCE } from './balance.ts';
import { RpcError } from './errors.ts';

export const DEFAULT_SCENARIO = 'marker-field';
export const BILGE_SCENARIO = 'bilge-session';
export const SEA_BATTLE_SCENARIO = 'sea-battle';

const BILGING_PUZZLE = 'bilging';

const declaredBuilders: Record<string, (seed: number) => Sim> = {
  [DEFAULT_SCENARIO]: (seed) => Sim.create({ seed }),
  [BILGE_SCENARIO]: (seed) => openBilgeSession(seed),
  [SEA_BATTLE_SCENARIO]: (seed) => openSeaBattle(seed),
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
  drive(sim, BILGE_SCENARIO, [{ op: 'puzzle.start', puzzle: BILGING_PUZZLE }]);
  return sim;
}

function openSeaBattle(seed: number): Sim {
  const sim = Sim.create({ seed, balance: BALANCE });
  const { startingCannonballs, startingRum } = BALANCE.battle;
  drive(sim, SEA_BATTLE_SCENARIO, [
    { op: 'puzzle.start', puzzle: BILGING_PUZZLE },
    {
      op: 'ship.commission',
      shipClass: 'sloop',
      allegiance: 'player',
      playerStation: 'bilging',
      cannonballs: startingCannonballs,
      rum: startingRum,
    },
    {
      op: 'ship.commission',
      shipClass: 'sloop',
      allegiance: 'brigand',
      cannonballs: startingCannonballs,
      rum: startingRum,
      cargoUnits: BALANCE.booty.brigandCargoUnitsBase,
    },
    { op: 'battle.start', sinkingContext: true },
  ]);
  return sim;
}

function drive(sim: Sim, scenario: string, commands: Command[]): void {
  for (const command of commands) {
    const result = sim.dispatch(command);
    if (result.status === 'rejected') {
      throw new RpcError('internal-error', `the ${scenario} scenario was ${result.reason}`);
    }
  }
}
