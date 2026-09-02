import type { SimEvent } from '../events.ts';
import { rngStream } from '../rng.ts';
import type { WorldState } from '../state.ts';
import type { BilgingBalance } from './balance.ts';
import { BILGE_REFILL_STREAM, BILGE_RULES, colourCountOf } from './bilging.ts';
import { BILGE_CRITTER_STREAM } from './critters.ts';
import { recordMove } from './frame.ts';
import {
  resolveBoard,
  type OpeningClear,
  type ResolveContext,
  type ResolveStep,
} from './resolve.ts';
import { PER_MILLE, chainScoreOf, comboScoreOf, crabScoreOf } from './scoring.ts';
import type { PuzzleState } from './session.ts';

export function applyBilgeMove(
  state: WorldState,
  balance: BilgingBalance,
  puzzle: PuzzleState,
  moved: SimEvent,
  opening: OpeningClear | null,
): SimEvent[] {
  const context = resolveContextOf(state, balance, puzzle);
  const steps = resolveBoard(puzzle.board, context, opening);
  const points = steps.reduce((total, step) => total + stepPointsOf(step, context), 0);

  puzzle.moves += 1;
  puzzle.totalScore += points;
  recordMove(puzzle.frame, points);
  return [
    moved,
    ...steps.map((step) => clearedEvent(state.tick, step, context)),
    {
      type: 'puzzle.scored',
      tick: state.tick,
      points,
      totalScore: puzzle.totalScore,
      moves: puzzle.moves,
    },
  ];
}

export function stepPointsOf(step: ResolveStep, context: ResolveContext): number {
  const crabs = crabScoreOf(step.crabCells.length, context.bilgePerMille, context.balance);
  return clearPointsOf(step, context) + crabs;
}

function resolveContextOf(
  state: WorldState,
  balance: BilgingBalance,
  puzzle: PuzzleState,
): ResolveContext {
  const colourCount = colourCountOf(balance, puzzle.starLevel);
  const colours = rngStream(state.seed, state.rngStreams, BILGE_REFILL_STREAM);
  const critters = rngStream(state.seed, state.rngStreams, BILGE_CRITTER_STREAM);
  return {
    balance,
    rules: BILGE_RULES,
    starLevel: puzzle.starLevel,
    waterLineRow: puzzle.waterLineRow,
    bilgePerMille: puzzle.bilgePerMille,
    drawColour: () => colours.nextIntInRange(0, colourCount),
    drawCritter: () => critters.nextIntInRange(0, PER_MILLE),
  };
}

function clearedEvent(tick: number, step: ResolveStep, context: ResolveContext): SimEvent {
  return {
    type: 'bilge.cleared',
    tick,
    chain: step.chain,
    cells: step.clearedCells,
    crabs: step.crabCells,
    points: stepPointsOf(step, context),
    settleTicks: step.settleTicks,
  };
}

function clearPointsOf(step: ResolveStep, context: ResolveContext): number {
  const cells = step.clearedCells.length;
  if (step.kind === 'poke') return cells * context.balance.pufferPointsPerCell;
  if (step.kind === 'jelly') return cells * context.balance.jellyPointsPerCell;
  if (step.kind === 'chain') return chainScoreOf(cells, context.balance);
  return comboScoreOf(
    step.runs.map((run) => run.length),
    context.balance,
    context.starLevel,
  );
}
