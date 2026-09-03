import {
  MOVE_TOKENS,
  PHASES_PER_TURN,
  type BattlePhasePlan,
  type BeamSide,
  type MoveToken,
  type PhaseFire,
  type PhaseMove,
} from '@opp/sim';

import { RpcError } from './errors.ts';
import { boundedArray, paramsOf, requiredCount, requiredString } from './params.ts';

const BEAM_SIDES: BeamSide[] = ['port', 'starboard'];

export function parsePlan(fields: Record<string, unknown>): BattlePhasePlan[] {
  return boundedArray(fields, 'plan', PHASES_PER_TURN).map(parsePhase);
}

function parsePhase(value: unknown): BattlePhasePlan {
  const phase = paramsOf(value);
  return { move: parseMove(phase['move']), fire: parseFire(phase['fire']) };
}

function parseMove(value: unknown): PhaseMove {
  if (value === undefined) return { kind: 'none' };
  const move = paramsOf(value);
  const kind = requiredString(move, 'kind');
  if (kind === 'none' || kind === 'rest') return { kind };
  if (kind !== 'move') throw new RpcError('invalid-params', `unknown move kind "${kind}"`);
  return { kind, token: parseToken(requiredString(move, 'token')) };
}

function parseFire(value: unknown): PhaseFire {
  if (value === undefined) return { kind: 'none' };
  const fire = paramsOf(value);
  const kind = requiredString(fire, 'kind');
  if (kind === 'none') return { kind };
  if (kind === 'grapple') return { kind, side: parseSide(requiredString(fire, 'side')) };
  if (kind !== 'guns') throw new RpcError('invalid-params', `unknown fire kind "${kind}"`);
  const side = parseSide(requiredString(fire, 'side'));
  return { kind, side, count: requiredCount(fire, 'count') };
}

function parseToken(token: string): MoveToken {
  const found = MOVE_TOKENS.find((candidate) => candidate === token);
  if (found === undefined) throw new RpcError('invalid-params', `unknown move token "${token}"`);
  return found;
}

function parseSide(side: string): BeamSide {
  const found = BEAM_SIDES.find((candidate) => candidate === side);
  if (found === undefined) throw new RpcError('invalid-params', `unknown beam side "${side}"`);
  return found;
}
