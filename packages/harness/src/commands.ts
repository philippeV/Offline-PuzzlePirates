import type { Command } from '@opp/sim';

import { RpcError } from './errors.ts';
import { paramsOf, requiredInteger, requiredString } from './params.ts';

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
      return { op, x: requiredInteger(fields, 'x'), y: requiredInteger(fields, 'y') };
    default:
      throw new RpcError('invalid-params', `unknown command op "${op}"`);
  }
}
