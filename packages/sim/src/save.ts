import { canonicalJson } from './hash.ts';
import { NO_SHAPE, type BoardShape } from './puzzle/board.ts';
import { SCHEMA_VERSION, type WorldState } from './state.ts';

type RawSave = Record<string, unknown>;
type Migration = (save: RawSave) => RawSave;
type FieldKind = 'a number' | 'an array' | 'an object' | 'an object or null';

const migrations: Record<number, Migration> = {
  1: (save) => save,
  2: (save) => ({ ...save, balance: null, puzzle: null }),
  3: (save) => ({ ...save, balance: null, ships: [], battle: null }),
  4: (save) => ({
    ...save,
    balance: null,
    pirate: null,
    voyage: null,
    markets: [],
    ships: shipsWithCargo(save['ships']),
  }),
  5: (save) => ({ ...save, balance: null, puzzle: shapedPuzzleOf(save['puzzle']) }),
};

const FIELD_KINDS: Record<keyof WorldState, FieldKind> = {
  schemaVersion: 'a number',
  seed: 'a number',
  tick: 'a number',
  nextEntityId: 'a number',
  rngStreams: 'an object',
  markers: 'an array',
  balance: 'an object or null',
  puzzle: 'an object or null',
  ships: 'an array',
  battle: 'an object or null',
  pirate: 'an object or null',
  voyage: 'an object or null',
  markets: 'an array',
};

function shipsWithCargo(ships: unknown): unknown[] {
  if (!Array.isArray(ships)) return [];
  return ships.map((ship: unknown) =>
    typeof ship === 'object' && ship !== null ? { ...(ship as RawSave), cargo: [], bootyCargo: [] } : ship,
  );
}

export function serialise(state: WorldState): string {
  return canonicalJson(state);
}

export function deserialise(text: string): WorldState {
  return worldStateOf(migrate(JSON.parse(text) as RawSave));
}

function migrate(save: RawSave): RawSave {
  let current = save;
  let version = schemaVersionOf(current);

  if (version > SCHEMA_VERSION) {
    throw new Error(`save schema version ${version} is newer than ${SCHEMA_VERSION}`);
  }

  while (version < SCHEMA_VERSION) {
    const migration = migrations[version];
    if (migration === undefined) {
      throw new Error(`no migration registered from schema version ${version}`);
    }
    version += 1;
    current = { ...migration(current), schemaVersion: version };
  }

  return current;
}

function shapedPuzzleOf(puzzle: unknown): unknown {
  if (puzzle === null || typeof puzzle !== 'object') return puzzle;
  const board = (puzzle as RawSave)['board'] as RawSave;
  const cells = board['cells'] as unknown[];
  return {
    ...puzzle,
    board: { ...board, shapes: new Array<BoardShape>(cells.length).fill(NO_SHAPE) },
    maneuverBar: 0,
  };
}

function schemaVersionOf(save: RawSave): number {
  const version = save['schemaVersion'];
  if (typeof version !== 'number') throw new Error('save carries no schemaVersion');
  return version;
}

function worldStateOf(save: RawSave): WorldState {
  for (const [field, kind] of Object.entries(FIELD_KINDS)) {
    if (!holds(save[field], kind)) throw new TypeError(`save.${field} must hold ${kind}`);
  }
  return save as unknown as WorldState;
}

function holds(value: unknown, kind: FieldKind): boolean {
  if (kind === 'a number') return typeof value === 'number';
  if (kind === 'an array') return Array.isArray(value);
  if (kind === 'an object') return isRecord(value);
  return value === null || isRecord(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
