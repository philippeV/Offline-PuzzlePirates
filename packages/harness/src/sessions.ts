import type { Sim, Snapshot } from '@opp/sim';

import { RpcError } from './errors.ts';
import { requiredString } from './params.ts';
import { createScenarioSim } from './scenarios.ts';

export interface Session {
  sim: Sim;
  snapshots: Map<string, Snapshot>;
  takenSnapshots: number;
}

export interface SimStatus {
  tick: number;
  stateHash: string;
}

export class SessionRegistry {
  #sessions = new Map<string, Session>();
  #openedSessions = 0;

  open(seed: number, scenario: string | undefined): { id: string; session: Session } {
    const sim = createScenarioSim(seed, scenario);
    const id = `s${this.#openedSessions}`;
    const session: Session = { sim, snapshots: new Map(), takenSnapshots: 0 };
    this.#openedSessions += 1;
    this.#sessions.set(id, session);
    return { id, session };
  }

  get(id: string): Session {
    const session = this.#sessions.get(id);
    if (session === undefined) throw new RpcError('session-unknown', `no session named "${id}"`);
    return session;
  }
}

export function sessionOf(registry: SessionRegistry, fields: Record<string, unknown>): Session {
  return registry.get(requiredString(fields, 'session'));
}

export function statusOf(session: Session): SimStatus {
  return { tick: session.sim.state.tick, stateHash: session.sim.hash() };
}

export function takeSnapshot(session: Session): string {
  const id = `snap${session.takenSnapshots}`;
  session.takenSnapshots += 1;
  session.snapshots.set(id, session.sim.snapshot());
  return id;
}

export function snapshotOf(session: Session, snapshotId: string): Snapshot {
  const snapshot = session.snapshots.get(snapshotId);
  if (snapshot === undefined) {
    throw new RpcError('snapshot-unknown', `no snapshot named "${snapshotId}"`);
  }
  return snapshot;
}
