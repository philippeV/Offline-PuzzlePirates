import type { Balance } from '../balance.ts';
import { PER_MILLE } from '../puzzle/scoring.ts';
import type { PuzzleState } from '../puzzle/session.ts';
import type { ShipState } from './state.ts';

export interface DutyOutputs {
  navigating: number;
  sailing: number;
  rigging: number;
  gunnery: number;
  carpentry: number;
  patching: number;
  bilging: number;
}

export function npcOutputOf(ship: ShipState, balance: Balance): number {
  return ship.allegiance === 'brigand'
    ? balance.npc.brigandCrewDutyOutputPerMille
    : balance.npc.crewDutyOutputPerMille;
}

export function dutyOutputsOf(
  ship: ShipState,
  puzzle: PuzzleState | null,
  balance: Balance,
): DutyOutputs {
  const npc = npcOutputOf(ship, balance);
  const outputs: DutyOutputs = {
    navigating: npc,
    sailing: npc,
    rigging: npc,
    gunnery: npc,
    carpentry: npc,
    patching: npc,
    bilging: npc,
  };
  const station = ship.playerStation;
  if (station === null || puzzle === null) return outputs;
  return { ...outputs, [station]: clampToPerMille(puzzle.dutyOutputPerMille) };
}

function clampToPerMille(output: number): number {
  return Math.min(Math.max(output, 0), PER_MILLE);
}
