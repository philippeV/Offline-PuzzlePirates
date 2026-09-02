import type { BrigandBalance } from '../balance.ts';
import type { EntityId } from '../ids.ts';
import { PER_MILLE } from '../puzzle/scoring.ts';
import type { RngStream } from '../rng.ts';
import { shipClassOf, type ShipClassId } from '../ship/classes.ts';
import { isImpassable, type BattleBoard } from './board.ts';
import { grappleReaches, lineOfFire } from './fire.ts';
import {
  aheadOf,
  positionsEqual,
  turnedFacing,
  type BeamSide,
  type BoardPosition,
  type Facing,
} from './geometry.ts';
import { PHASES_PER_TURN, type BattlePhasePlan, type PhaseFire, type PhaseMove } from './plan.ts';
import { heldTokensOf, type MoveToken, type TokenPool } from './tokens.ts';

export const BRIGAND_PLAN_STREAM = 'battle.brigandPlan';

export interface BrigandSelf {
  shipId: EntityId;
  shipClass: ShipClassId;
  x: number;
  y: number;
  facing: Facing;
  tokens: TokenPool;
  cannonsLoaded: number;
  damagePerMille: number;
}

export interface BrigandEnemy {
  shipId: EntityId;
  x: number;
  y: number;
  facing: Facing;
}

export function planBrigandTurn(
  board: BattleBoard,
  self: BrigandSelf,
  enemy: BrigandEnemy,
  balance: BrigandBalance,
  stream: RngStream,
): BattlePhasePlan[] {
  const planner = plannerOf(board, self, enemy, balance, stream);
  const grappleSide = openingGrappleSideOf(planner);
  const plan: BattlePhasePlan[] = [];
  for (let phase = 0; phase < PHASES_PER_TURN; phase += 1) {
    const chosen = bestCandidateOf(planner, phase);
    commit(planner, chosen);
    const grapple = phase === 0 ? grappleSide : null;
    plan.push({
      move: chosen.move,
      fire: grapple === null ? spendGunfire(planner) : { kind: 'grapple', side: grapple },
    });
  }
  return plan;
}

const BEAM_SIDES: BeamSide[] = ['port', 'starboard'];
const CANDIDATE_TOKENS: MoveToken[] = ['forward', 'left', 'right'];

interface Pose {
  position: BoardPosition;
  facing: Facing;
}

interface Candidate {
  move: PhaseMove;
  pose: Pose;
  blocked: boolean;
}

interface Planner {
  board: BattleBoard;
  self: BrigandSelf;
  enemy: BrigandEnemy;
  balance: BrigandBalance;
  stream: RngStream;
  noise: number;
  pose: Pose;
  spent: Record<MoveToken, number>;
  restsLeft: number;
  cannonsLeft: number;
}

function plannerOf(
  board: BattleBoard,
  self: BrigandSelf,
  enemy: BrigandEnemy,
  balance: BrigandBalance,
  stream: RngStream,
): Planner {
  const genius = stream.nextIntInRange(0, PER_MILLE) < balance.geniusChancePerMille;
  return {
    board,
    self,
    enemy,
    balance,
    stream,
    noise: genius ? 0 : balance.blunderNoisePerMille,
    pose: { position: { x: self.x, y: self.y }, facing: self.facing },
    spent: { left: 0, forward: 0, right: 0 },
    restsLeft: PHASES_PER_TURN - shipClassOf(self.shipClass).movesPerTurn,
    cannonsLeft: self.cannonsLoaded,
  };
}

function openingGrappleSideOf(planner: Planner): BeamSide | null {
  const shooter = {
    shipId: planner.self.shipId,
    shipClass: planner.self.shipClass,
    position: planner.pose.position,
    facing: planner.pose.facing,
  };
  const targets = [{ shipId: planner.enemy.shipId, position: planner.enemy }];
  const side = BEAM_SIDES.find(
    (candidate) => grappleReaches(planner.board, shooter, targets, candidate) !== null,
  );
  return side ?? null;
}

function bestCandidateOf(planner: Planner, phase: number): Candidate {
  const scored = candidatesOf(planner, phase).map((candidate) => ({
    candidate,
    score: scoreOf(planner, candidate) + jitterOf(planner),
  }));
  return scored.reduce((best, entry) => (entry.score > best.score ? entry : best)).candidate;
}

function candidatesOf(planner: Planner, phase: number): Candidate[] {
  if (planner.restsLeft >= PHASES_PER_TURN - phase) return [candidateOf(planner, { kind: 'rest' })];
  const moves: PhaseMove[] = planner.restsLeft > 0 ? [{ kind: 'rest' }] : [];
  if (phase < planner.balance.planLookaheadPhases) {
    for (const token of CANDIDATE_TOKENS) {
      if (heldTokensOf(planner.self.tokens, token) > planner.spent[token]) {
        moves.push({ kind: 'move', token });
      }
    }
  }
  moves.push({ kind: 'none' });
  return moves.map((move) => candidateOf(planner, move));
}

function candidateOf(planner: Planner, move: PhaseMove): Candidate {
  if (move.kind !== 'move') return { move, pose: planner.pose, blocked: false };
  const { position, facing } = planner.pose;
  const ahead = aheadOf(position, facing);
  const turned = move.token === 'forward' ? facing : turnedFacing(facing, move.token);
  const destination = move.token === 'forward' ? ahead : aheadOf(ahead, turned);
  const blocked = [ahead, destination].some((tile) => isImpassable(planner.board, tile));
  return { move, pose: { position: blocked ? position : destination, facing: turned }, blocked };
}

function scoreOf(planner: Planner, candidate: Candidate): number {
  const { balance, board, enemy } = planner;
  const enemyPose: Pose = { position: enemy, facing: enemy.facing };
  const before = manhattanTo(planner.pose.position, enemy);
  const closed = before - manhattanTo(candidate.pose.position, enemy);
  const approach = isRetreating(planner) ? -closed : closed;
  const exposed = beamSideFrom(board, candidate.pose, enemy) !== null;
  const incoming = beamSideFrom(board, enemyPose, candidate.pose.position) !== null;
  return (
    balance.weightCloseDistance * approach +
    (exposed ? balance.weightBroadsideExposure : 0) -
    (incoming ? balance.weightIncomingBroadside : 0) -
    (isPureLoss(planner, candidate) ? balance.weightRockCollision : 0)
  );
}

function isPureLoss(planner: Planner, candidate: Candidate): boolean {
  return candidate.blocked && candidate.pose.facing === planner.pose.facing;
}

function jitterOf(planner: Planner): number {
  if (planner.noise === 0) return 0;
  return planner.stream.nextIntInRange(-planner.noise, planner.noise + 1);
}

function commit(planner: Planner, candidate: Candidate): void {
  if (candidate.move.kind === 'rest') planner.restsLeft -= 1;
  if (candidate.move.kind === 'move') planner.spent[candidate.move.token] += 1;
  planner.pose = candidate.pose;
}

function spendGunfire(planner: Planner): PhaseFire {
  const side = beamSideFrom(planner.board, planner.pose, planner.enemy);
  if (side === null || planner.cannonsLeft < 1) return { kind: 'none' };
  const shotsPerSide = shipClassOf(planner.self.shipClass).shotsPerSidePerPhase;
  const count = Math.min(shotsPerSide, planner.cannonsLeft);
  planner.cannonsLeft -= count;
  return { kind: 'guns', side, count };
}

function beamSideFrom(board: BattleBoard, pose: Pose, target: BoardPosition): BeamSide | null {
  const side = BEAM_SIDES.find((candidate) =>
    lineOfFire(board, pose.position, pose.facing, candidate).some((tile) =>
      positionsEqual(tile, target),
    ),
  );
  return side ?? null;
}

function isRetreating(planner: Planner): boolean {
  return planner.self.damagePerMille >= planner.balance.disengageAtDamagePerMille;
}

function manhattanTo(from: BoardPosition, to: BoardPosition): number {
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
}
