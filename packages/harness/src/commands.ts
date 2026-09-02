import {
  SHIP_CLASS_IDS,
  STATION_SLOTS,
  type Command,
  type ShipClassId,
  type StationSlot,
} from '@opp/sim';

import { RpcError } from './errors.ts';
import {
  optionalBoolean,
  optionalCount,
  optionalString,
  paramsOf,
  requiredCount,
  requiredInteger,
  requiredString,
} from './params.ts';
import { parsePlan } from './plans.ts';

export function parseCommand(value: unknown): Command {
  const fields = paramsOf(value);
  const op = requiredString(fields, 'op');
  switch (op) {
    case 'marker.move':
      return {
        op,
        id: requiredInteger(fields, 'id'),
        dx: requiredInteger(fields, 'dx'),
        dy: requiredInteger(fields, 'dy'),
      };
    case 'marker.place':
      return {
        op,
        id: requiredInteger(fields, 'id'),
        x: requiredInteger(fields, 'x'),
        y: requiredInteger(fields, 'y'),
      };
    case 'puzzle.start':
      return { op, puzzle: requiredString(fields, 'puzzle') };
    case 'bilge.swap':
    case 'bilge.poke':
      return { op, x: requiredInteger(fields, 'x'), y: requiredInteger(fields, 'y') };
    case 'ship.commission':
      return {
        op,
        shipClass: parseShipClass(requiredString(fields, 'shipClass')),
        allegiance: requiredString(fields, 'allegiance') === 'brigand' ? 'brigand' : 'player',
        playerStation: parseStation(optionalString(fields, 'playerStation')),
        crewCount: optionalCount(fields, 'crewCount'),
        cannonballs: optionalCount(fields, 'cannonballs'),
        rum: optionalCount(fields, 'rum'),
        cargoUnits: optionalCount(fields, 'cargoUnits'),
        poe: optionalCount(fields, 'poe'),
      };
    case 'battle.start':
      return { op, sinkingContext: optionalBoolean(fields, 'sinkingContext') };
    case 'battle.plan':
      return { op, shipId: requiredInteger(fields, 'shipId'), plan: parsePlan(fields) };
    case 'battle.disengage':
      return { op, shipId: requiredInteger(fields, 'shipId') };
    case 'world.start':
      return { op, islandId: domainId(fields, 'islandId') };
    case 'voyage.chart':
      return {
        op,
        shipId: requiredInteger(fields, 'shipId'),
        toIslandId: domainId(fields, 'toIslandId'),
        voyageType: domainId(fields, 'voyageType'),
      };
    case 'voyage.port':
      return { op };
    case 'market.buy':
    case 'market.sell':
      return {
        op,
        shipId: requiredInteger(fields, 'shipId'),
        commodityId: domainId(fields, 'commodityId'),
        units: requiredCount(fields, 'units'),
      };
    case 'booty.divide':
      return { op, shipId: requiredInteger(fields, 'shipId') };
    default:
      throw new RpcError('invalid-params', `unknown command op "${op}"`);
  }
}

function domainId<Id extends string>(fields: Record<string, unknown>, key: string): Id {
  return requiredString(fields, key) as Id;
}

function parseShipClass(shipClass: string): ShipClassId {
  const found = SHIP_CLASS_IDS.find((candidate) => candidate === shipClass);
  if (found === undefined) {
    throw new RpcError('invalid-params', `unknown ship class "${shipClass}"`);
  }
  return found;
}

function parseStation(station: string | undefined): StationSlot | null {
  if (station === undefined) return null;
  const found = STATION_SLOTS.find((slot) => slot === station);
  if (found === undefined) throw new RpcError('invalid-params', `unknown station "${station}"`);
  return found;
}
