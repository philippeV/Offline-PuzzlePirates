import type { Container } from 'pixi.js';

import type { GameClient, SceneId } from '../client/client.ts';
import type { Atlas } from '../iso/atlas.ts';

export type PanelId = 'ye' | 'booty' | 'location' | 'market' | 'minimap' | 'duty';

export type Intent =
  | { kind: 'open-panel'; panel: PanelId }
  | { kind: 'enter-scene'; scene: SceneId }
  | { kind: 'say'; text: string };

export interface SceneContext {
  client: GameClient;
  atlas: Atlas;
  emit(intent: Intent): void;
}

export interface Scene {
  readonly id: SceneId;
  readonly view: Container;
  resize(width: number, height: number): void;
  update(elapsedMs: number): void;
  destroy(): void;
}

export type SceneFactory = (context: SceneContext) => Scene;
