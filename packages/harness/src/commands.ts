import type { Command } from '@opp/sim';

import { RpcError } from './errors.ts';
import { paramsOf, requiredInteger, requiredString } from './params.ts';

export function parseCommand(value: unknown): Command {
  const fields = paramsOf(value);
  const op = requiredString(fields, 'op');
  const id = requiredInteger(fields, 'id');
  switch (op) {
    case 'marker.move':
      return { op, id, dx: requiredInteger(fields, 'dx'), dy: requiredInteger(fields, 'dy') };
    case 'marker.place':
      return { op, id, x: requiredInteger(fields, 'x'), y: requiredInteger(fields, 'y') };
    default:
      throw new RpcError('invalid-params', `unknown command op "${op}"`);
  }
}
