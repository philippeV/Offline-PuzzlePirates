import type { RejectionReason } from '../commands.ts';
import { shipClassOf, type ShipClassId } from '../ship/classes.ts';
import type { BeamSide } from './geometry.ts';
import type { MoveToken } from './tokens.ts';

export const PHASES_PER_TURN = 4;

export type PhaseMove =
  | { kind: 'none' }
  | { kind: 'rest' }
  | { kind: 'move'; token: MoveToken };

export type PhaseFire =
  | { kind: 'none' }
  | { kind: 'guns'; side: BeamSide; count: number }
  | { kind: 'grapple'; side: BeamSide };

export interface BattlePhasePlan {
  move: PhaseMove;
  fire: PhaseFire;
}

export function idlePlan(): BattlePhasePlan[] {
  return Array.from({ length: PHASES_PER_TURN }, () => idlePhase());
}

export function idlePhase(): BattlePhasePlan {
  return { move: { kind: 'none' }, fire: { kind: 'none' } };
}

export function planRejectionOf(
  shipClassId: ShipClassId,
  plan: BattlePhasePlan[],
): RejectionReason | null {
  if (plan.length !== PHASES_PER_TURN) return 'plan-wrong-length';
  const shipClass = shipClassOf(shipClassId);
  const rests = plan.filter((phase) => phase.move.kind === 'rest').length;
  if (restsRequiredBy(shipClass.movesPerTurn) !== rests) return 'plan-move-budget';
  if (plan.some((phase) => exceedsSideBudget(phase.fire, shipClass.shotsPerSidePerPhase))) {
    return 'too-many-shots';
  }
  return null;
}

export function movedPhasesOf(plan: BattlePhasePlan[]): number {
  return plan.filter((phase) => phase.move.kind === 'move').length;
}

function restsRequiredBy(movesPerTurn: number): number {
  return PHASES_PER_TURN - movesPerTurn;
}

function exceedsSideBudget(fire: PhaseFire, shotsPerSidePerPhase: number): boolean {
  return fire.kind === 'guns' && (fire.count < 1 || fire.count > shotsPerSidePerPhase);
}
