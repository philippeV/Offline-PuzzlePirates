import { commodityOf, islandOf } from './rules.ts';
import type { BattleOutcome, RejectionReason, SimEvent } from './rules.ts';

export type LogChannel = 'vessel' | 'ahoy' | 'refused';

export interface LogLine {
  tick: number;
  channel: LogChannel;
  text: string;
}

const REFUSALS: Record<RejectionReason, string> = {
  'unknown-marker': 'There be no such marker.',
  'non-integer-coordinate': 'That be no square on the board.',
  'destination-outside-field': 'That lies off the field.',
  'balance-missing': 'The ocean sails with no balance loaded.',
  'unknown-puzzle': 'No such puzzle.',
  'puzzle-already-running': 'Ye be at that duty already.',
  'no-puzzle-running': 'Ye be at no duty station.',
  'swap-outside-board': 'That swap falls off the board.',
  'poke-outside-board': 'There be nothing there to poke.',
  'crab-not-swappable': 'The crab will not be shoved about.',
  'not-a-puffer': 'That be no puffer to pop.',
  'unknown-ship': 'No such ship.',
  'no-battle-running': 'There be no battle.',
  'battle-already-running': 'Ye be in a battle already.',
  'plan-wrong-length': 'A turn takes four phases.',
  'plan-move-budget': 'She cannot move that far in a turn.',
  'too-many-shots': 'She cannot fire that many.',
  'no-movement-token': 'Ye hold no such move token.',
  'no-gun-token': 'The magazine be empty.',
  'disengage-not-ready': 'Ye cannot break off yet.',
  'world-already-started': 'The ocean be sailing already.',
  'world-not-started': 'There be no ocean.',
  'unknown-island': 'No such island.',
  'unknown-commodity': 'No such commodity.',
  'not-in-port': 'Ye must be in port for that.',
  'voyage-already-running': 'Ye be at sea already.',
  'no-voyage-running': 'Ye be not at sea.',
  'not-at-island': 'Ye be not at an island.',
  'no-route': 'No route runs there.',
  'unknown-voyage-type': 'No such voyage.',
  'battle-running': 'Not while the guns are out.',
  'island-has-no-market': 'That island keeps no market.',
  'insufficient-poe': 'Ye cannot afford that.',
  'insufficient-stock': 'The market be out of that.',
  'insufficient-cargo': 'Ye carry none of that.',
  'market-stock-full': 'The market will take no more.',
  'wrong-cannon-ball-size': 'Her guns take no ball of that size.',
  'negative-units': 'Ye cannot trade less than nothing.',
  'hold-full': 'The hold be full.',
  'no-booty': 'There be nothing to divide.',
};
export function refusalOf(reason: RejectionReason): string {
  return REFUSALS[reason] ?? 'That cannot be done.';
}

export function linesOf(event: SimEvent): LogLine[] {
  const text = textOf(event);
  if (text === null) return [];
  return [{ tick: event.tick, channel: channelOf(event), text }];
}

function channelOf(event: SimEvent): LogChannel {
  if (event.type === 'booty.divided' || event.type === 'battle.ended') return 'ahoy';
  return 'vessel';
}

function textOf(event: SimEvent): string | null {
  switch (event.type) {
    case 'world.started':
      return `Ye wake in ${islandOf(event.islandId).name}.`;
    case 'voyage.charted':
      return `Course set for ${islandOf(event.toIslandId).name}, ${event.legs} leagues.`;
    case 'voyage.legReached':
      return `League ${event.legIndex + 1} astern.`;
    case 'voyage.ported':
      return `Ported at ${islandOf(event.islandId).name}.`;
    case 'encounter.spawned':
      return 'A brigand bears down on ye!';
    case 'battle.started':
      return 'Battle stations!';
    case 'battle.turnEnded':
      return `Turn ${event.turnIndex + 1} done.`;
    case 'battle.hit':
      return 'A shot tells!';
    case 'battle.grappled':
      return 'Grappled! Boarders away!';
    case 'battle.ended':
      return endedTextOf(event.outcome, event.bootyPoe, event.bootyCargoUnits);
    case 'cargo.plundered':
      return `Plundered ${event.units} of ${commodityOf(event.commodityId).name}.`;
    case 'market.traded':
      return `${event.side === 'buy' ? 'Bought' : 'Sold'} ${event.units} of ${commodityOf(event.commodityId).name} for ${event.poe} PoE.`;
    case 'booty.divided':
      return `Booty divided: ${event.pirateSharePoe} PoE to ye, ${event.crewCutPoe} to the crew.`;
    case 'puzzle.levelChanged':
      return `The bilge rises: star level ${event.starLevel}.`;
    default:
      return null;
  }
}

function endedTextOf(outcome: BattleOutcome, poe: number, cargoUnits: number): string {
  if (outcome === 'player-won') {
    return `Victory! ${poe} PoE and ${cargoUnits} units into the booty chest.`;
  }
  if (outcome === 'player-lost') return 'Ye be bested. The brigand leaves ye in her wake.';
  return 'The brigand slips away.';
}
