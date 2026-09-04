import { Sim } from '@opp/sim';

import { DEFAULT_OPENING, openingCommands, type Opening } from './boot.ts';
import { linesOf, refusalOf, type LogLine } from './log.ts';
import type { Balance, Command, CommandResult, SimEvent, WorldState } from './rules.ts';

export type SceneId = 'port' | 'deck' | 'puzzle' | 'battle';

export interface ClientOptions {
  seed: number;
  balance: Balance;
  opening?: Opening;
}

const LOG_CAPACITY = 120;

const TICKS_BETWEEN_QUIET_ANNOUNCEMENTS = 30;

export class GameClient {
  private readonly balance: Balance;
  private readonly opening: Opening;
  private sim: Sim;
  private lines: LogLine[] = [];
  private current: SceneId = 'port';
  private readonly listeners = new Set<() => void>();
  private quietTicks = 0;

  private constructor(sim: Sim, balance: Balance, opening: Opening) {
    this.sim = sim;
    this.balance = balance;
    this.opening = opening;
  }

  static create(options: ClientOptions): GameClient {
    const opening = options.opening ?? DEFAULT_OPENING;
    const sim = Sim.create({ seed: options.seed, balance: options.balance });
    const client = new GameClient(sim, options.balance, opening);
    for (const command of openingCommands(opening, options.balance)) client.dispatch(command);
    client.lines = [];
    client.syncScene();
    return client;
  }

  get state(): Readonly<WorldState> {
    return this.sim.state;
  }

  get tick(): number {
    return this.sim.state.tick;
  }

  get scene(): SceneId {
    return this.current;
  }

  get log(): readonly LogLine[] {
    return this.lines;
  }

  get atSea(): boolean {
    return this.sim.state.voyage !== null;
  }

  get inBattle(): boolean {
    const battle = this.sim.state.battle;
    return battle !== null && battle.outcome === 'running';
  }

  dispatch(command: Command): CommandResult {
    const result = this.sim.dispatch(command);
    if (result.status === 'rejected') {
      this.append({ tick: this.tick, channel: 'refused', text: refusalOf(result.reason) });
    } else {
      this.record(result.events);
    }
    this.announce();
    return result;
  }

  advance(ticks: number): SimEvent[] {
    const events = this.sim.step(ticks);
    this.record(events);
    this.syncScene();
    this.quietTicks += ticks;
    if (events.length > 0 || this.quietTicks >= TICKS_BETWEEN_QUIET_ANNOUNCEMENTS) {
      this.quietTicks = 0;
      this.announce();
    }
    return events;
  }

  enterScene(scene: SceneId): boolean {
    if (!this.canEnter(scene)) return false;
    this.current = scene;
    this.announce();
    return true;
  }

  canEnter(scene: SceneId): boolean {
    if (this.inBattle) return scene === 'battle' || scene === 'puzzle';
    if (scene === 'battle') return false;
    if (scene === 'port') return !this.atSea;
    return true;
  }

  say(text: string): void {
    this.append({ tick: this.tick, channel: 'vessel', text });
  }

  save(): string {
    return this.sim.save();
  }

  restore(text: string): void {
    const restored = Sim.load(text);
    const running = { sim: this.sim, lines: this.lines, scene: this.current };
    this.sim = restored;
    this.lines = [];
    try {
      this.syncScene();
      this.announce();
    } catch (failure) {
      this.sim = running.sim;
      this.lines = running.lines;
      this.current = running.scene;
      throw failure;
    }
  }

  reset(seed: number): void {
    this.sim = Sim.create({ seed, balance: this.balance });
    for (const command of openingCommands(this.opening, this.balance)) this.sim.dispatch(command);
    this.lines = [];
    this.current = 'port';
    this.syncScene();
    this.announce();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private syncScene(): void {
    if (this.inBattle && this.current !== 'puzzle') this.current = 'battle';
    if (!this.inBattle && this.current === 'battle') this.current = 'deck';
    if (this.atSea && this.current === 'port') this.current = 'deck';
  }

  private record(events: SimEvent[]): void {
    for (const event of events) {
      for (const line of linesOf(event)) this.append(line);
    }
  }

  private append(line: LogLine): void {
    this.lines.push(line);
    if (this.lines.length > LOG_CAPACITY) this.lines.splice(0, this.lines.length - LOG_CAPACITY);
  }

  private announce(): void {
    for (const listener of this.listeners) listener();
  }
}
