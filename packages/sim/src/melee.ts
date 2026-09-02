export const MAX_BLACK_BLOCK_ROWS = 6;
export const MELEE_COLUMNS = 6;
export const RUM_SICK_COLUMNS = 2;

export type MeleeTeam = 'attacker' | 'defender';

export interface MeleeSide {
  blackBlockRows: number;
  rumSick: boolean;
  crew: number;
}

export interface MeleeResult {
  winner: MeleeTeam;
  attackerStrength: number;
  defenderStrength: number;
}

export function resolveMelee(attacker: MeleeSide, defender: MeleeSide): MeleeResult {
  const attackerStrength = strengthOf(attacker);
  const defenderStrength = strengthOf(defender);
  return {
    winner: attackerStrength > defenderStrength ? 'attacker' : 'defender',
    attackerStrength,
    defenderStrength,
  };
}

export function strengthOf(side: MeleeSide): number {
  const rows = clamp(side.blackBlockRows, 0, MAX_BLACK_BLOCK_ROWS);
  const columns = side.rumSick ? MELEE_COLUMNS - RUM_SICK_COLUMNS : MELEE_COLUMNS;
  return Math.max(side.crew, 0) * (MAX_BLACK_BLOCK_ROWS - rows) * columns;
}

function clamp(value: number, minInclusive: number, maxInclusive: number): number {
  return Math.min(Math.max(value, minInclusive), maxInclusive);
}
