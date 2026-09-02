import { shipClassOf, type ShipClassId } from '../ship/classes.ts';
import { ramRankOf } from './claims.ts';
import type { Movement } from './movement.ts';

export const SAME_CLASS_COLLISIONS = 1;
export const CROSS_CLASS_COLLISIONS = 2;

export type CollisionLog = Map<string, [Movement, Movement]>;

export type RamDamageOverrides = Partial<Record<ShipClassId, number>>;

export function recordCollision(log: CollisionLog, one: Movement, other: Movement): void {
  const [first, second] =
    one.plan.ship.shipId < other.plan.ship.shipId ? [one, other] : [other, one];
  log.set(`${first.plan.ship.shipId}:${second.plan.ship.shipId}`, [first, second]);
}

export function applyCollisions(log: CollisionLog, overrides: RamDamageOverrides = {}): void {
  for (const [one, other] of log.values()) {
    const collisions = collisionsBetween(one, other);
    dealRamDamage(one, other, collisions, overrides);
    dealRamDamage(other, one, collisions, overrides);
  }
}

export function ramDamageOf(shipClass: ShipClassId, overrides: RamDamageOverrides): number {
  return overrides[shipClass] ?? shipClassOf(shipClass).ramDamageSmallMicro;
}

function collisionsBetween(one: Movement, other: Movement): number {
  return ramRankOf(one.plan) === ramRankOf(other.plan)
    ? SAME_CLASS_COLLISIONS
    : CROSS_CLASS_COLLISIONS;
}

function dealRamDamage(
  victim: Movement,
  rammer: Movement,
  collisions: number,
  overrides: RamDamageOverrides,
): void {
  victim.collided = true;
  victim.damageTakenSmallMicro += ramDamageOf(rammer.plan.ship.shipClass, overrides) * collisions;
}
