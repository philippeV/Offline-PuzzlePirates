import type { Balance, Command, IslandId, StationSlot } from './rules.ts';

export type Opening = 'pillage-loop' | 'sea-battle';

export const DEFAULT_OPENING: Opening = 'pillage-loop';
export const HOME_ISLAND: IslandId = 'alkaid';
export const OPENING_STATION: StationSlot = 'bilging';

const BILGING_PUZZLE = 'bilging';

export function openingCommands(opening: Opening, balance: Balance): Command[] {
  if (opening === 'sea-battle') return seaBattleCommands(balance);
  return pillageLoopCommands(balance);
}

function pillageLoopCommands(balance: Balance): Command[] {
  return [
    { op: 'puzzle.start', puzzle: BILGING_PUZZLE },
    { op: 'world.start', islandId: HOME_ISLAND },
    playerSloop(balance),
  ];
}

function seaBattleCommands(balance: Balance): Command[] {
  return [
    { op: 'puzzle.start', puzzle: BILGING_PUZZLE },
    playerSloop(balance),
    {
      op: 'ship.commission',
      shipClass: 'sloop',
      allegiance: 'brigand',
      cannonballs: balance.battle.startingCannonballs,
      rum: balance.battle.startingRum,
      cargoUnits: balance.booty.brigandCargoUnitsBase,
    },
    { op: 'battle.start', sinkingContext: true },
  ];
}

function playerSloop(balance: Balance): Command {
  return {
    op: 'ship.commission',
    shipClass: 'sloop',
    allegiance: 'player',
    playerStation: OPENING_STATION,
    cannonballs: balance.battle.startingCannonballs,
    rum: balance.battle.startingRum,
  };
}
