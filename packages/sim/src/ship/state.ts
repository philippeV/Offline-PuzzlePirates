import { takeEntityId, type EntityId, type EntityIdCounter } from '../ids.ts';
import { shipClassOf, type ShipClassId } from './classes.ts';

export type StationSlot =
  | 'navigating'
  | 'sailing'
  | 'rigging'
  | 'gunnery'
  | 'carpentry'
  | 'patching'
  | 'bilging';

export type Allegiance = 'player' | 'brigand';

export const STATION_SLOTS: StationSlot[] = [
  'navigating',
  'sailing',
  'rigging',
  'gunnery',
  'carpentry',
  'patching',
  'bilging',
];

export interface ShipState {
  id: EntityId;
  shipClass: ShipClassId;
  allegiance: Allegiance;
  damageTakenSmallMicro: number;
  meleeDamageSmallMicro: number;
  damageAccumulator: number;
  bilgePerMille: number;
  bilgeAccumulator: number;
  speedPerMille: number;
  cannonsLoaded: number;
  cannonLoadAccumulator: number;
  rum: number;
  cannonballs: number;
  cargoUnits: number;
  poe: number;
  bootyCargoUnits: number;
  bootyPoe: number;
  crewCount: number;
  playerStation: StationSlot | null;
}

export interface ShipOptions {
  shipClass: ShipClassId;
  allegiance: Allegiance;
  crewCount?: number | undefined;
  cannonballs?: number | undefined;
  rum?: number | undefined;
  cargoUnits?: number | undefined;
  poe?: number | undefined;
  playerStation?: StationSlot | null | undefined;
}

export function createShip(counter: EntityIdCounter, options: ShipOptions): ShipState {
  const shipClass = shipClassOf(options.shipClass);
  return {
    id: takeEntityId(counter),
    shipClass: options.shipClass,
    allegiance: options.allegiance,
    damageTakenSmallMicro: 0,
    meleeDamageSmallMicro: 0,
    damageAccumulator: 0,
    bilgePerMille: 0,
    bilgeAccumulator: 0,
    speedPerMille: 0,
    cannonsLoaded: 0,
    cannonLoadAccumulator: 0,
    rum: options.rum ?? 0,
    cannonballs: options.cannonballs ?? 0,
    cargoUnits: options.cargoUnits ?? 0,
    poe: options.poe ?? 0,
    bootyCargoUnits: 0,
    bootyPoe: 0,
    crewCount: options.crewCount ?? shipClass.swabbieStaffing,
    playerStation: options.playerStation ?? null,
  };
}

export function findShip(ships: ShipState[], id: EntityId): ShipState | undefined {
  return ships.find((ship) => ship.id === id);
}

export function isFullyDamaged(ship: ShipState): boolean {
  return ship.damageTakenSmallMicro >= shipClassOf(ship.shipClass).fullDamageSmallMicro;
}

export function damagePerMilleOf(ship: ShipState): number {
  const full = shipClassOf(ship.shipClass).fullDamageSmallMicro;
  return Math.min(Math.floor((ship.damageTakenSmallMicro * 1000) / full), 1000);
}
