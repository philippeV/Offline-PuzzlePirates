import { advanceTick } from './clock.ts';
import type { Command, CommandResult } from './commands.ts';
import type { SimEvent } from './events.ts';
import { hashCanonical } from './hash.ts';
import { applyMarkerCommand, driftMarkers, spawnMarker } from './marker.ts';
import type { PuzzleBalance } from './puzzle/balance.ts';
import { applyPuzzleCommand } from './puzzle/dispatch.ts';
import { stepPuzzle } from './puzzle/session.ts';
import { deserialise, serialise } from './save.ts';
import { cloneWorldState, createWorldState, type WorldState } from './state.ts';

export interface SimOptions {
  seed: number;
  balance?: PuzzleBalance;
}

export type Snapshot = WorldState;

export class Sim {
  #state: WorldState;

  constructor(state: WorldState) {
    this.#state = state;
  }

  static create(options: SimOptions): Sim {
    const state = createWorldState(options.seed, options.balance ?? null);
    spawnMarker(state);
    return new Sim(state);
  }

  static load(text: string): Sim {
    return new Sim(deserialise(text));
  }

  get state(): Readonly<WorldState> {
    return this.#state;
  }

  dispatch(command: Command): CommandResult {
    if (command.op === 'marker.move' || command.op === 'marker.place') {
      return applyMarkerCommand(this.#state, command);
    }
    return applyPuzzleCommand(this.#state, command);
  }

  step(ticks: number): SimEvent[] {
    const events: SimEvent[] = [];
    for (let remaining = ticks; remaining > 0; remaining -= 1) {
      advanceTick(this.#state);
      events.push(...driftMarkers(this.#state));
      events.push(...stepPuzzle(this.#state));
    }
    return events;
  }

  hash(): string {
    return hashCanonical(this.#state);
  }

  save(): string {
    return serialise(this.#state);
  }

  snapshot(): Snapshot {
    return cloneWorldState(this.#state);
  }

  restore(snapshot: Snapshot): void {
    this.#state = cloneWorldState(snapshot);
  }
}
