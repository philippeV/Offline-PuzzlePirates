import type { Balance } from './balance.ts';
import { canonicalJson } from './hash.ts';
import { NO_SHAPE, type BoardShape } from './puzzle/board.ts';
import { SHIP_CLASS_IDS, type ShipClassId } from './ship/classes.ts';
import { SCHEMA_VERSION, type WorldState } from './state.ts';
import { LEAGUE_POINT_IDS, type LeaguePointId } from './world/leaguePoints.ts';

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

const BALANCE_BLOCKS: Record<keyof Balance, true> = {
  bilging: true,
  ship: true,
  battle: true,
  npc: true,
  brigand: true,
  booty: true,
  world: true,
  market: true,
  division: true,
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
  refuseSpoiltState(save);
  return save as unknown as WorldState;
}

export function refuseSpoiltState(state: unknown): void {
  const save = recordOf(state, 'save');
  for (const [field, kind] of Object.entries(FIELD_KINDS)) {
    if (!holds(save[field], kind)) throw new TypeError(`save.${field} must hold ${kind}`);
  }
  const ships = save['ships'] as unknown[];
  refuseSpoiltPuzzle(save['puzzle']);
  refuseSpoiltBalance(save['balance']);
  refuseUnknownShipClasses(ships);
  refuseSpoiltVoyage(save['voyage'], ships);
  refuseSpoiltBattle(save['battle'], ships);
}

function refuseSpoiltPuzzle(puzzle: unknown): void {
  if (puzzle === null) return;
  const fields = recordOf(puzzle, 'save.puzzle');
  recordOf(fields['frame'], 'save.puzzle.frame');
  refuseSpoiltBoard(recordOf(fields['board'], 'save.puzzle.board'));
}

function refuseSpoiltBoard(board: RawSave): void {
  const width = safeIntegerOf(board['width'], 'save.puzzle.board.width');
  const height = safeIntegerOf(board['height'], 'save.puzzle.board.height');
  const cells = arrayOf(board['cells'], 'save.puzzle.board.cells');
  const shapes = arrayOf(board['shapes'], 'save.puzzle.board.shapes');
  if (cells.length !== width * height) {
    throw new TypeError('save.puzzle.board.cells must hold width * height cells');
  }
  if (shapes.length !== cells.length) {
    throw new TypeError('save.puzzle.board.shapes must hold one shape per cell');
  }
}

function refuseSpoiltBalance(balance: unknown): void {
  if (balance === null) return;
  const blocks = recordOf(balance, 'save.balance');
  for (const block of Object.keys(BALANCE_BLOCKS)) {
    recordOf(blocks[block], `save.balance.${block}`);
  }
}

function refuseUnknownShipClasses(ships: unknown[]): void {
  ships.forEach((ship, index) => {
    const shipClass = recordOf(ship, `save.ships[${index}]`)['shipClass'];
    if (!SHIP_CLASS_IDS.includes(shipClass as ShipClassId)) {
      throw new TypeError(`save.ships[${index}].shipClass must hold a known ship class`);
    }
  });
}

function refuseSpoiltVoyage(voyage: unknown, ships: unknown[]): void {
  if (voyage === null) return;
  const fields = recordOf(voyage, 'save.voyage');
  arrayOf(fields['route'], 'save.voyage.route').forEach((point, index) => {
    if (!LEAGUE_POINT_IDS.includes(point as LeaguePointId)) {
      throw new TypeError(`save.voyage.route[${index}] must hold a known league point`);
    }
  });
  refuseUnknownShipId(fields['shipId'], ships, 'save.voyage.shipId');
}

function refuseSpoiltBattle(battle: unknown, ships: unknown[]): void {
  if (battle === null) return;
  const fields = recordOf(battle, 'save.battle');
  arrayOf(fields['ships'], 'save.battle.ships').forEach((ship, index) => {
    const path = `save.battle.ships[${index}]`;
    refuseUnknownShipId(recordOf(ship, path)['shipId'], ships, `${path}.shipId`);
  });
}

function refuseUnknownShipId(shipId: unknown, ships: unknown[], path: string): void {
  if (!ships.some((ship) => isRecord(ship) && ship['id'] === shipId)) {
    throw new TypeError(`${path} must hold the id of a ship in save.ships`);
  }
}

function recordOf(value: unknown, path: string): RawSave {
  if (!isRecord(value)) throw new TypeError(`${path} must hold an object`);
  return value;
}

function arrayOf(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${path} must hold an array`);
  return value as unknown[];
}

function safeIntegerOf(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new TypeError(`${path} must hold a safe integer`);
  }
  return value;
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
