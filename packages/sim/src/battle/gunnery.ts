import type { SimEvent } from '../events.ts';
import type { EntityId } from '../ids.ts';
import { applyShipDamage } from '../ship/meters.ts';
import { findShip, type ShipState } from '../ship/state.ts';
import { grappleReaches, resolveFire, type FireShooter, type FireTarget } from './fire.ts';
import type { BeamSide } from './geometry.ts';
import {
  DISENGAGE_TURNS_PER_HIT,
  battleShipOf,
  type BattleShip,
  type BattleState,
} from './state.ts';

export interface GunneryScope {
  tick: number;
  battle: BattleState;
  ships: ShipState[];
}

export function firePhase(scope: GunneryScope, phase: number): SimEvent[] {
  return scope.battle.ships.flatMap((ship) => fireOf(scope, ship, phase));
}

export function shooterOf(scope: GunneryScope, ship: BattleShip): FireShooter | null {
  const hull = findShip(scope.ships, ship.shipId);
  if (hull === undefined) return null;
  return {
    shipId: ship.shipId,
    shipClass: hull.shipClass,
    position: { x: ship.x, y: ship.y },
    facing: ship.facing,
  };
}

function fireOf(scope: GunneryScope, ship: BattleShip, phase: number): SimEvent[] {
  const fire = ship.plan[phase]?.fire;
  const shooter = shooterOf(scope, ship);
  if (fire === undefined || fire.kind === 'none' || shooter === null) return [];
  const targets = targetsOf(scope.battle, ship.shipId);
  if (fire.kind === 'grapple') return grappleOf(scope, shooter, targets, fire.side, phase);
  return gunsOf(scope, shooter, targets, fire.side, fire.count, phase);
}

function gunsOf(
  scope: GunneryScope,
  shooter: FireShooter,
  targets: FireTarget[],
  side: BeamSide,
  count: number,
  phase: number,
): SimEvent[] {
  const hull = findShip(scope.ships, shooter.shipId);
  if (hull === undefined) return [];
  const shots = Math.min(count, hull.cannonsLoaded);
  if (shots <= 0) return [];
  hull.cannonsLoaded -= shots;
  const fired: SimEvent = {
    type: 'battle.fired',
    tick: scope.tick,
    id: shooter.shipId,
    phase,
    side,
    shots,
  };
  const hit = resolveFire(scope.battle.board, shooter, targets, side, shots);
  if (hit === null) return [fired];
  const { targetId, damageSmallMicro } = hit;
  return [fired, ...struck(scope, shooter.shipId, targetId, damageSmallMicro, phase, shots)];
}

function struck(
  scope: GunneryScope,
  shooterId: EntityId,
  targetId: EntityId,
  damageSmallMicro: number,
  phase: number,
  shots: number,
): SimEvent[] {
  const victim = findShip(scope.ships, targetId);
  const victimShip = battleShipOf(scope.battle, targetId);
  if (victim === undefined || victimShip === undefined) return [];
  victimShip.disengageCounter += DISENGAGE_TURNS_PER_HIT * shots;
  return [
    { type: 'battle.hit', tick: scope.tick, id: shooterId, targetId, phase, damageSmallMicro },
    ...applyShipDamage(scope.tick, victim, 'shot', damageSmallMicro),
  ];
}

function grappleOf(
  scope: GunneryScope,
  shooter: FireShooter,
  targets: FireTarget[],
  side: BeamSide,
  phase: number,
): SimEvent[] {
  const reached = grappleReaches(scope.battle.board, shooter, targets, side);
  if (reached === null) return [];
  scope.battle.grappled = shooter.shipId;
  return [{ type: 'battle.grappled', tick: scope.tick, id: shooter.shipId, phase }];
}

function targetsOf(battle: BattleState, shooterId: EntityId): FireTarget[] {
  return battle.ships
    .filter((ship) => ship.shipId !== shooterId)
    .map((ship) => ({ shipId: ship.shipId, position: { x: ship.x, y: ship.y } }));
}
