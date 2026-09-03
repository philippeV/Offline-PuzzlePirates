import assert from 'node:assert/strict';

import {
  TICKS_PER_TURN,
  createRngStreams,
  damagePerMilleOf,
  findShip,
  planBrigandTurn,
  rngStream,
  type BattlePhasePlan,
  type BattleShip,
  type Command,
  type CommandResult,
  type RngStreams,
  type ShipState,
  type SimEvent,
  type WorldState,
} from '@opp/sim';

import { BALANCE } from '../../packages/harness/src/balance.ts';

const AGENT_PLAN_STREAM = 'agent.plan';
const TICKS_PER_SAIL_SLICE = 600;

export function shipOf(state: WorldState, allegiance: string): ShipState {
  const ship = state.ships.find((crewed) => crewed.allegiance === allegiance);
  assert.ok(ship !== undefined, `no ${allegiance} ship`);
  return ship;
}

function stationOf(state: WorldState, allegiance: string): BattleShip {
  const ships = state.battle?.ships ?? [];
  const ship = ships.find(
    (crewed) => findShip(state.ships, crewed.shipId)?.allegiance === allegiance,
  );
  assert.ok(ship !== undefined, `no ${allegiance} ship on the board`);
  return ship;
}

export function agentPlanOf(state: WorldState, streams: RngStreams): BattlePhasePlan[] {
  const me = stationOf(state, 'player');
  const foe = stationOf(state, 'brigand');
  const hull = shipOf(state, 'player');
  return planBrigandTurn(
    state.battle?.board ?? { width: 0, height: 0, tiles: [] },
    {
      shipId: me.shipId,
      shipClass: hull.shipClass,
      x: me.x,
      y: me.y,
      facing: me.facing,
      tokens: me.tokens,
      cannonsLoaded: hull.cannonsLoaded,
      damagePerMille: damagePerMilleOf(hull),
    },
    { shipId: foe.shipId, x: foe.x, y: foe.y, facing: foe.facing },
    BALANCE.brigand,
    rngStream(state.seed, streams, AGENT_PLAN_STREAM),
  );
}

export interface LoopDriver {
  readonly state: Readonly<WorldState>;
  dispatch(command: Command): CommandResult;
  step(ticks: number): SimEvent[];
}

export interface SailReport {
  battles: number;
  ticks: number;
}

export function sailToDestination(sim: LoopDriver, maxTicks: number): SailReport {
  const streams = createRngStreams();
  const report: SailReport = { battles: 0, ticks: 0 };
  let fighting = false;

  while (report.ticks < maxTicks) {
    const state = sim.state as WorldState;
    const voyage = state.voyage;
    if (voyage === null) return report;

    const battle = state.battle;
    if (battle !== null && battle.outcome === 'running') {
      if (!fighting) {
        fighting = true;
        report.battles += 1;
      }
      sim.dispatch({
        op: 'battle.plan',
        shipId: stationOf(state, 'player').shipId,
        plan: agentPlanOf(state, streams),
      });
      sim.step(TICKS_PER_TURN);
      report.ticks += TICKS_PER_TURN;
      continue;
    }

    fighting = false;
    if (voyage.legIndex >= voyage.route.length - 1) return report;

    sim.step(TICKS_PER_SAIL_SLICE);
    report.ticks += TICKS_PER_SAIL_SLICE;
  }

  throw new Error(`voyage did not reach its destination within ${maxTicks} ticks`);
}
