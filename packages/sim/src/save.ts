import { canonicalJson } from './hash.ts';
import { SCHEMA_VERSION, type WorldState } from './state.ts';

type RawSave = Record<string, unknown>;
type Migration = (save: RawSave) => RawSave;

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
};

function shipsWithCargo(ships: unknown): unknown[] {
  if (!Array.isArray(ships)) return [];
  return ships.map((ship: unknown) =>
    typeof ship === 'object' && ship !== null ? { ...(ship as RawSave), cargo: [] } : ship,
  );
}

export function serialise(state: WorldState): string {
  return canonicalJson(state);
}

export function deserialise(text: string): WorldState {
  return migrate(JSON.parse(text) as RawSave);
}

function migrate(save: RawSave): WorldState {
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

  return current as unknown as WorldState;
}

function schemaVersionOf(save: RawSave): number {
  const version = save['schemaVersion'];
  if (typeof version !== 'number') throw new Error('save carries no schemaVersion');
  return version;
}
