import type { Balance } from '../balance.ts';
import type { SimEvent } from '../events.ts';
import { MAX_BLACK_BLOCK_ROWS, resolveMelee, type MeleeSide } from '../melee.ts';
import { rngStream } from '../rng.ts';
import { shipClassOf } from '../ship/classes.ts';
import { dutyOutputsOf } from '../ship/duty.ts';
import {
  damagePerMilleOf,
  findShip,
  isFullyDamaged,
  type Allegiance,
  type ShipState,
} from '../ship/state.ts';
import type { WorldState } from '../state.ts';
import { BOOTY_POE_STREAM, awardBooty, rollBooty, type BootyRoll } from './booty.ts';
import { BRIGAND_PLAN_STREAM, planBrigandTurn } from './brigand.ts';
import { PHASES_PER_TURN, idlePlan } from './plan.ts';
import { BATTLE_BOARD_STREAM, createBattleLayout, openingPlacements } from './setup.ts';
import { createBattle, type BattleOutcome, type BattleShip, type BattleState } from './state.ts';
import {
  TICKS_PER_TURN,
  ageTokens,
  mintMovementTokens,
  movementTokenMilliPerTurnOf,
} from './tokens.ts';
import { executePhase } from './turn.ts';

const NO_BOOTY: BootyRoll = { poe: 0, cargoUnits: 0, chartDropped: false };

export function startBattle(
  state: WorldState,
  balance: Balance,
  player: ShipState,
  brigand: ShipState,
  sinkingContext: boolean,
): BattleState {
  const placements = openingPlacements(balance.battle, player.id, brigand.id);
  const stream = rngStream(state.seed, state.rngStreams, BATTLE_BOARD_STREAM);
  const board = createBattleLayout(balance.battle, placements, stream);
  const battle = createBattle(placements, sinkingContext, board);
  planBrigandFor(state, battle, balance);
  return battle;
}

export function stepBattle(state: WorldState): SimEvent[] {
  const battle = state.battle;
  const balance = state.balance;
  if (battle === null || balance === null || battle.outcome !== 'running') return [];
  battle.turnTick += 1;
  if (battle.turnTick < TICKS_PER_TURN) return [];
  battle.turnTick = 0;
  return runTurn(state, battle, balance);
}

export function concludeBattle(state: WorldState, outcome: BattleOutcome): SimEvent[] {
  const battle = state.battle;
  const balance = state.balance;
  if (battle === null || balance === null || outcome === 'running') return [];
  battle.outcome = outcome;
  const booty = outcome === 'player-won' ? claimBooty(state, balance) : NO_BOOTY;
  return [
    {
      type: 'battle.ended',
      tick: state.tick,
      outcome,
      bootyPoe: booty.poe,
      bootyCargoUnits: booty.cargoUnits,
      chartDropped: booty.chartDropped,
    },
  ];
}

function runTurn(state: WorldState, battle: BattleState, balance: Balance): SimEvent[] {
  const scope = { tick: state.tick, battle, ships: state.ships, balance };
  const events: SimEvent[] = [];
  for (let phase = 0; phase < PHASES_PER_TURN; phase += 1) {
    events.push(...executePhase(scope, phase));
    if (battle.grappled !== 0) break;
  }
  events.push(...endTurn(state, battle, balance));
  return [...events, ...concludeBattle(state, outcomeOf(state, battle))];
}

function endTurn(state: WorldState, battle: BattleState, balance: Balance): SimEvent[] {
  let expiredTokens = 0;
  for (const ship of battle.ships) {
    expiredTokens += ageTokens(ship.tokens);
    ship.disengageCounter = Math.max(ship.disengageCounter - 1, 0);
    mintFor(state, ship, balance);
    ship.plan = idlePlan();
  }
  battle.turnIndex += 1;
  planBrigandFor(state, battle, balance);
  return [
    { type: 'battle.turnEnded', tick: state.tick, turnIndex: battle.turnIndex, expiredTokens },
  ];
}

function mintFor(state: WorldState, ship: BattleShip, balance: Balance): void {
  const hull = findShip(state.ships, ship.shipId);
  if (hull === undefined) return;
  const outputs = dutyOutputsOf(hull, state.puzzle, balance);
  mintMovementTokens(
    ship.tokens,
    movementTokenMilliPerTurnOf(
      balance.battle.movementTokenMilliPerThousandTicksAtFullDuty,
      Math.max(outputs.sailing, outputs.rigging),
      hull.bilgePerMille,
      balance.battle.bilgeTokenThrottlePerMille,
    ),
  );
}

function planBrigandFor(state: WorldState, battle: BattleState, balance: Balance): void {
  const brigand = shipWith(state, battle, 'brigand');
  const enemy = shipWith(state, battle, 'player');
  const hull = brigand === undefined ? undefined : findShip(state.ships, brigand.shipId);
  if (brigand === undefined || enemy === undefined || hull === undefined) return;
  const stream = rngStream(state.seed, state.rngStreams, BRIGAND_PLAN_STREAM);
  brigand.plan = planBrigandTurn(
    battle.board,
    {
      shipId: brigand.shipId,
      shipClass: hull.shipClass,
      x: brigand.x,
      y: brigand.y,
      facing: brigand.facing,
      tokens: brigand.tokens,
      cannonsLoaded: hull.cannonsLoaded,
      damagePerMille: damagePerMilleOf(hull),
    },
    { shipId: enemy.shipId, x: enemy.x, y: enemy.y, facing: enemy.facing },
    balance.brigand,
    stream,
  );
}

function outcomeOf(state: WorldState, battle: BattleState): BattleOutcome {
  const player = hullWith(state, battle, 'player');
  const brigand = hullWith(state, battle, 'brigand');
  if (player === undefined || brigand === undefined) return 'running';
  if (battle.grappled !== 0) return meleeOutcomeOf(state, battle, player, brigand);
  if (isFullyDamaged(brigand)) return 'player-won';
  if (isFullyDamaged(player)) return 'player-lost';
  return 'running';
}

function meleeOutcomeOf(
  state: WorldState,
  battle: BattleState,
  player: ShipState,
  brigand: ShipState,
): BattleOutcome {
  const grappler = findShip(state.ships, battle.grappled);
  if (grappler === undefined) return 'running';
  const defender = grappler.id === player.id ? brigand : player;
  const result = resolveMelee(meleeSideOf(grappler), meleeSideOf(defender));
  const winner = result.winner === 'attacker' ? grappler : defender;
  return winner.allegiance === 'player' ? 'player-won' : 'player-lost';
}

function meleeSideOf(ship: ShipState): MeleeSide {
  const maxSf = shipClassOf(ship.shipClass).maxSfDamageSmallMicro;
  return {
    blackBlockRows: Math.floor((ship.meleeDamageSmallMicro * MAX_BLACK_BLOCK_ROWS) / maxSf),
    rumSick: ship.rum === 0,
    crew: ship.crewCount,
  };
}

function claimBooty(state: WorldState, balance: Balance): BootyRoll {
  const battle = state.battle;
  if (battle === null) return NO_BOOTY;
  const player = hullWith(state, battle, 'player');
  const brigand = hullWith(state, battle, 'brigand');
  if (player === undefined || brigand === undefined) return NO_BOOTY;
  const stream = rngStream(state.seed, state.rngStreams, BOOTY_POE_STREAM);
  return awardBooty(player, brigand, rollBooty(brigand, balance.booty, stream), balance.booty);
}

function hullWith(
  state: WorldState,
  battle: BattleState,
  allegiance: Allegiance,
): ShipState | undefined {
  const ship = shipWith(state, battle, allegiance);
  return ship === undefined ? undefined : findShip(state.ships, ship.shipId);
}

function shipWith(
  state: WorldState,
  battle: BattleState,
  allegiance: Allegiance,
): BattleShip | undefined {
  return battle.ships.find(
    (ship) => findShip(state.ships, ship.shipId)?.allegiance === allegiance,
  );
}
