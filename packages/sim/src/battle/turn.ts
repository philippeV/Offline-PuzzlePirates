import type { Balance } from '../balance.ts';
import type { SimEvent } from '../events.ts';
import { applyShipDamage } from '../ship/meters.ts';
import { findShip, type ShipState } from '../ship/state.ts';
import { tileAt } from './board.ts';
import {
  resolveMovement,
  type CollisionIntent,
  type CollisionOutcome,
  type CollisionShip,
} from './collision.ts';
import { firePhase } from './gunnery.ts';
import type { RamDamageOverrides } from './ram.ts';
import { battleShipOf, type BattleShip, type BattleState } from './state.ts';
import { whirlEffect } from './tiles.ts';
import { spendToken } from './tokens.ts';

export interface TurnScope {
  tick: number;
  battle: BattleState;
  ships: ShipState[];
  balance: Balance;
}

export function ramDamageOverridesOf(balance: Balance): RamDamageOverrides {
  return { 'war-galleon': balance.ship.warGalleonRamDamageSmallMicro };
}

export function executePhase(scope: TurnScope, phase: number): SimEvent[] {
  return [...movePhase(scope, phase), ...tilePhase(scope, phase), ...firePhase(scope, phase)];
}

function movePhase(scope: TurnScope, phase: number): SimEvent[] {
  const ships = collisionShipsOf(scope, (ship) => plannedIntentOf(ship, phase));
  return applyOutcomes(scope, phase, resolve(scope, ships));
}

function tilePhase(scope: TurnScope, phase: number): SimEvent[] {
  const ships = collisionShipsOf(scope, (ship) => tileIntentOf(scope.battle, ship));
  if (ships.every((ship) => ship.intent.kind === 'stationary')) return [];
  return applyOutcomes(scope, phase, resolve(scope, ships));
}

function resolve(scope: TurnScope, ships: CollisionShip[]): CollisionOutcome[] {
  return resolveMovement(scope.battle.board, ships, ramDamageOverridesOf(scope.balance));
}

function collisionShipsOf(
  scope: TurnScope,
  intentOf: (ship: BattleShip) => CollisionIntent,
): CollisionShip[] {
  const ships: CollisionShip[] = [];
  for (const ship of scope.battle.ships) {
    const hull = findShip(scope.ships, ship.shipId);
    if (hull === undefined) continue;
    ships.push({
      shipId: ship.shipId,
      shipClass: hull.shipClass,
      position: { x: ship.x, y: ship.y },
      facing: ship.facing,
      intent: intentOf(ship),
    });
  }
  return ships;
}

function plannedIntentOf(ship: BattleShip, phase: number): CollisionIntent {
  const move = ship.plan[phase]?.move;
  if (move === undefined || move.kind !== 'move') return { kind: 'stationary' };
  if (!spendToken(ship.tokens, move.token)) return { kind: 'stationary' };
  if (move.token === 'forward') return { kind: 'forward' };
  return { kind: 'turn', turn: move.token };
}

function tileIntentOf(battle: BattleState, ship: BattleShip): CollisionIntent {
  const tile = tileAt(battle.board, ship.x, ship.y);
  if (tile === undefined) return { kind: 'stationary' };
  if (tile.kind === 'wind') return { kind: 'wind', facing: tile.facing };
  if (tile.kind !== 'whirlpool') return { kind: 'stationary' };
  const pose = whirlEffect(battle.board, tile.id, {
    position: { x: ship.x, y: ship.y },
    facing: ship.facing,
  });
  return { kind: 'whirl', destination: pose.position, facing: pose.facing };
}

function applyOutcomes(
  scope: TurnScope,
  phase: number,
  outcomes: CollisionOutcome[],
): SimEvent[] {
  const events: SimEvent[] = [];
  for (const outcome of outcomes) {
    const ship = battleShipOf(scope.battle, outcome.shipId);
    const hull = findShip(scope.ships, outcome.shipId);
    if (ship === undefined || hull === undefined) continue;
    events.push(...movedEvents(scope, phase, ship, outcome));
    events.push(
      ...applyShipDamage(
        scope.tick,
        hull,
        outcome.struckObstacle ? 'obstacle' : 'ram',
        outcome.damageTakenSmallMicro,
      ),
    );
  }
  return events;
}

function movedEvents(
  scope: TurnScope,
  phase: number,
  ship: BattleShip,
  outcome: CollisionOutcome,
): SimEvent[] {
  const changed =
    ship.x !== outcome.position.x ||
    ship.y !== outcome.position.y ||
    ship.facing !== outcome.facing;
  ship.x = outcome.position.x;
  ship.y = outcome.position.y;
  ship.facing = outcome.facing;
  const events: SimEvent[] = [];
  if (changed) {
    const { x, y, facing } = ship;
    events.push({ type: 'battle.moved', tick: scope.tick, id: ship.shipId, phase, x, y, facing });
  }
  if (outcome.collided || outcome.struckObstacle) {
    const { struckObstacle } = outcome;
    const id = ship.shipId;
    events.push({ type: 'battle.collided', tick: scope.tick, id, phase, struckObstacle });
  }
  return events;
}
