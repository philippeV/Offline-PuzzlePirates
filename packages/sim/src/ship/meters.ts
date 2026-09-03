import type { Balance, BattleBalance, ShipBalance } from '../balance.ts';
import type { DamageSource, ShipMeter, SimEvent } from '../events.ts';
import { PER_MILLE } from '../puzzle/scoring.ts';
import { shipClassOf } from './classes.ts';
import type { DutyOutputs } from './duty.ts';
import { damagePerMilleOf, type ShipState } from './state.ts';

export const METER_BANDS = 10;
const ACCUMULATOR_PER_CANNON = PER_MILLE * PER_MILLE;

interface BandedMeter {
  meter: ShipMeter;
  band: number;
}

const BANDED_METERS: ShipMeter[] = ['damage', 'bilge', 'speed'];

export function bandOf(perMille: number): number {
  return clampTo(Math.floor((perMille * METER_BANDS) / PER_MILLE), METER_BANDS);
}

export function stepShipMeters(
  tick: number,
  ship: ShipState,
  outputs: DutyOutputs,
  balance: Balance,
): SimEvent[] {
  const before = bandedMetersOf(ship);
  const carpentry = Math.max(outputs.carpentry, outputs.patching);
  stepBilge(ship, outputs.bilging, carpentry, balance.ship);
  stepDamage(ship, carpentry, balance.ship);
  stepSpeed(ship, outputs, balance.ship);
  stepCannonLoading(ship, outputs.gunnery, balance.battle);
  return before.flatMap((banded) => bandEvent(tick, ship, banded.meter, banded.band));
}

export function applyShipDamage(
  tick: number,
  ship: ShipState,
  source: DamageSource,
  damageSmallMicro: number,
): SimEvent[] {
  if (damageSmallMicro <= 0) return [];
  const shipClass = shipClassOf(ship.shipClass);
  const before = bandOf(damagePerMilleOf(ship));
  const taken = ship.damageTakenSmallMicro + damageSmallMicro;
  ship.damageTakenSmallMicro = clampTo(taken, shipClass.fullDamageSmallMicro);
  const melee = ship.meleeDamageSmallMicro + damageSmallMicro;
  ship.meleeDamageSmallMicro = clampTo(melee, shipClass.maxSfDamageSmallMicro);
  const damageTakenSmallMicro = ship.damageTakenSmallMicro;
  const id = ship.id;
  const damaged: SimEvent = {
    type: 'ship.damaged',
    tick,
    id,
    source,
    damageSmallMicro,
    damageTakenSmallMicro,
  };
  return [damaged, ...bandEvent(tick, ship, 'damage', before)];
}

function stepBilge(ship: ShipState, bilging: number, carpentry: number, balance: ShipBalance): void {
  const damaged = share(damagePerMilleOf(ship), balance.damageBilgeCoefficientPerMille);
  const raised = share(balance.bilgeInflowPerMillePerThousandTicks, PER_MILLE + damaged);
  const slowed = share(raised, PER_MILLE - share(carpentry, balance.carpentryBilgeSlowingPerMille));
  const pumped = share(balance.bilgePumpPerMillePerThousandTicksAtFullDuty, bilging);
  ship.bilgeAccumulator += slowed - pumped;
  const carried = carryFrom(ship.bilgeAccumulator);
  ship.bilgeAccumulator -= carried * PER_MILLE;
  const unclamped = ship.bilgePerMille + carried;
  ship.bilgePerMille = clampTo(unclamped, PER_MILLE);
  if (unclamped !== ship.bilgePerMille) ship.bilgeAccumulator = 0;
}

function stepDamage(ship: ShipState, carpentry: number, balance: ShipBalance): void {
  const full = shipClassOf(ship.shipClass).fullDamageSmallMicro;
  const repaired = share(balance.carpentryRepairPerMillePerThousandTicksAtFullDuty, carpentry);
  ship.damageAccumulator += balance.wearDamagePerMillePerThousandTicks - repaired;
  const carried = carryFrom(ship.damageAccumulator);
  ship.damageAccumulator -= carried * PER_MILLE;
  const unclamped = ship.damageTakenSmallMicro + carried * Math.floor(full / PER_MILLE);
  ship.damageTakenSmallMicro = clampTo(unclamped, full);
  if (unclamped !== ship.damageTakenSmallMicro) ship.damageAccumulator = 0;
}

function stepSpeed(ship: ShipState, outputs: DutyOutputs, balance: ShipBalance): void {
  const sail = Math.max(outputs.sailing, outputs.rigging);
  const navigated = share(outputs.navigating, balance.navigationBonusMaxPerMille);
  const target = clampTo(share(sail, PER_MILLE + navigated), PER_MILLE);
  const cap = PER_MILLE - share(ship.bilgePerMille, balance.bilgeSpeedCapPerMille);
  ship.speedPerMille = clampTo(Math.min(target, cap), PER_MILLE);
}

function stepCannonLoading(ship: ShipState, gunnery: number, balance: BattleBalance): void {
  const shots = shipClassOf(ship.shipClass).shots;
  ship.cannonLoadAccumulator += share(balance.cannonLoadMilliPerThousandTicksAtFullDuty, gunnery);
  while (
    ship.cannonLoadAccumulator >= ACCUMULATOR_PER_CANNON &&
    ship.cannonsLoaded < shots &&
    ship.cannonballs > 0
  ) {
    ship.cannonLoadAccumulator -= ACCUMULATOR_PER_CANNON;
    ship.cannonsLoaded += 1;
    ship.cannonballs -= 1;
  }
  if (ship.cannonsLoaded >= shots || ship.cannonballs === 0) {
    ship.cannonLoadAccumulator = Math.min(ship.cannonLoadAccumulator, ACCUMULATOR_PER_CANNON - 1);
  }
}

function bandedMetersOf(ship: ShipState): BandedMeter[] {
  return BANDED_METERS.map((meter) => ({ meter, band: bandOf(perMilleOf(ship, meter)) }));
}

function bandEvent(tick: number, ship: ShipState, meter: ShipMeter, before: number): SimEvent[] {
  const perMille = perMilleOf(ship, meter);
  const band = bandOf(perMille);
  if (band === before) return [];
  return [{ type: 'ship.meterBanded', tick, id: ship.id, meter, band, perMille }];
}

function perMilleOf(ship: ShipState, meter: ShipMeter): number {
  if (meter === 'damage') return damagePerMilleOf(ship);
  if (meter === 'bilge') return ship.bilgePerMille;
  return ship.speedPerMille;
}

function share(value: number, fractionPerMille: number): number {
  return Math.floor((value * fractionPerMille) / PER_MILLE);
}

function carryFrom(accumulator: number): number {
  return Math.floor(accumulator / PER_MILLE);
}

function clampTo(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max);
}
