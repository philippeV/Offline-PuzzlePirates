import type {
  BattleCommand,
  CommandResult,
  CommissionShipCommand,
  DisengageCommand,
  PlanBattleTurnCommand,
  RejectionReason,
  StartBattleCommand,
} from '../commands.ts';
import { SHIP_CLASS_IDS } from '../ship/classes.ts';
import { createShip, findShip, type ShipState } from '../ship/state.ts';
import type { EntityId } from '../ids.ts';
import type { WorldState } from '../state.ts';
import { planRejectionOf, type BattlePhasePlan } from './plan.ts';
import { concludeBattle, startBattle } from './session.ts';
import { battleShipOf, type BattleShip, type BattleState } from './state.ts';
import { MOVE_TOKENS, heldTokensOf, type MoveToken, type TokenPool } from './tokens.ts';

export function applyCommissionCommand(
  state: WorldState,
  command: CommissionShipCommand,
): CommandResult {
  const found = SHIP_CLASS_IDS.find((candidate) => candidate === command.shipClass);
  if (found === undefined) {
    return { status: 'rejected', reason: 'unknown-ship' };
  }
  state.ships.push(createShip(state, command));
  return { status: 'accepted', events: [] };
}

export function applyBattleCommand(state: WorldState, command: BattleCommand): CommandResult {
  if (command.op === 'battle.start') return start(state, command);
  if (command.op === 'battle.plan') return plan(state, command);
  return disengage(state, command);
}

function start(state: WorldState, command: StartBattleCommand): CommandResult {
  const balance = state.balance;
  if (balance === null) return { status: 'rejected', reason: 'balance-missing' };
  if (state.battle !== null) return { status: 'rejected', reason: 'battle-already-running' };
  const player = state.ships.find((ship) => ship.allegiance === 'player');
  const brigand = state.ships.find((ship) => ship.allegiance === 'brigand');
  if (player === undefined || brigand === undefined) {
    return { status: 'rejected', reason: 'unknown-ship' };
  }
  state.battle = startBattle(state, balance, player, brigand, command.sinkingContext ?? false);
  return {
    status: 'accepted',
    events: [
      { type: 'battle.started', tick: state.tick, ships: state.battle.ships.map(idOf) },
    ],
  };
}

function plan(state: WorldState, command: PlanBattleTurnCommand): CommandResult {
  const battle = runningBattleOf(state);
  if (battle === null) return { status: 'rejected', reason: 'no-battle-running' };
  const ship = battleShipOf(battle, command.shipId);
  const hull = findShip(state.ships, command.shipId);
  if (ship === undefined || hull === undefined) {
    return { status: 'rejected', reason: 'unknown-ship' };
  }
  const rejection =
    planRejectionOf(hull.shipClass, command.plan) ??
    affordable(ship.tokens, hull, command.plan);
  if (rejection !== null) return { status: 'rejected', reason: rejection };
  ship.plan = command.plan;
  return { status: 'accepted', events: [] };
}

function disengage(state: WorldState, command: DisengageCommand): CommandResult {
  const battle = runningBattleOf(state);
  if (battle === null) return { status: 'rejected', reason: 'no-battle-running' };
  const ship = battleShipOf(battle, command.shipId);
  if (ship === undefined) return { status: 'rejected', reason: 'unknown-ship' };
  if (ship.disengageCounter > 0) return { status: 'rejected', reason: 'disengage-not-ready' };
  return { status: 'accepted', events: concludeBattle(state, 'disengaged') };
}

function affordable(
  pool: TokenPool,
  hull: ShipState,
  plan: BattlePhasePlan[],
): RejectionReason | null {
  for (const token of MOVE_TOKENS) {
    if (plannedTokensOf(plan, token) > heldTokensOf(pool, token)) return 'no-movement-token';
  }
  return plannedShotsOf(plan) > hull.cannonsLoaded ? 'no-gun-token' : null;
}

function plannedTokensOf(plan: BattlePhasePlan[], token: MoveToken): number {
  return plan.filter((phase) => phase.move.kind === 'move' && phase.move.token === token).length;
}

function plannedShotsOf(plan: BattlePhasePlan[]): number {
  return plan.reduce(
    (total, phase) => total + (phase.fire.kind === 'guns' ? phase.fire.count : 0),
    0,
  );
}

function runningBattleOf(state: WorldState): BattleState | null {
  const battle = state.battle;
  if (battle === null || battle.outcome !== 'running') return null;
  return battle;
}

function idOf(ship: BattleShip): EntityId {
  return ship.shipId;
}
