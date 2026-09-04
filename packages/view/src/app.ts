import { Application } from 'pixi.js';

import type { Opening } from './client/boot.ts';
import { GameClient, type SceneId } from './client/client.ts';
import type { Balance } from './client/rules.ts';
import { createAtlas, type Atlas } from './iso/atlas.ts';
import { createPanelDeck, type PanelDeck } from './panels/panels.ts';
import { createBattleScene } from './scenes/battle.ts';
import { createDeckScene } from './scenes/deck.ts';
import { createPortScene } from './scenes/port.ts';
import { createPuzzleScene } from './scenes/puzzle.ts';
import type { Intent, Scene, SceneContext, SceneFactory } from './scenes/scene.ts';
import { createTicker, type Ticker } from './ticker.ts';

const BACKDROP = 0x0a1622;

const SCENE_FACTORIES: Record<SceneId, SceneFactory> = {
  port: createPortScene,
  deck: createDeckScene,
  puzzle: createPuzzleScene,
  battle: createBattleScene,
};

export interface MountOptions {
  canvasHost: HTMLElement;
  panelHost: HTMLElement;
  balance: Balance;
  seed: number;
  opening?: Opening;
}

export interface GameApp {
  readonly client: GameClient;
  destroy(): void;
}

export async function mount(options: MountOptions): Promise<GameApp> {
  const client = GameClient.create({
    seed: options.seed,
    balance: options.balance,
    ...(options.opening === undefined ? {} : { opening: options.opening }),
  });
  const application = new Application();
  await application.init({
    background: BACKDROP,
    resizeTo: options.canvasHost,
    antialias: true,
    autoStart: false,
  });
  options.canvasHost.appendChild(application.canvas);
  application.canvas.addEventListener('contextmenu', preventDefault);

  const atlas = createAtlas(application.renderer);
  const panels = createPanelDeck(client, options.panelHost);
  const stage = createStage(application, client, atlas, panels);

  const ticker = createTicker((ticks, elapsedMs) => {
    if (ticks > 0) client.advance(ticks);
    stage.follow();
    stage.update(elapsedMs);
    application.render();
  });

  const unsubscribe = client.subscribe(stage.follow);
  const resize = (): void => stage.resize();
  window.addEventListener('resize', resize);
  stage.follow();
  stage.resize();
  application.render();
  ticker.start();

  return {
    client,
    destroy(): void {
      destroyApp(ticker, unsubscribe, resize, stage, panels, atlas, application);
    },
  };
}

interface Stage {
  follow(): void;
  update(elapsedMs: number): void;
  resize(): void;
  destroy(): void;
}

function createStage(
  application: Application,
  client: GameClient,
  atlas: Atlas,
  panels: PanelDeck,
): Stage {
  const context: SceneContext = { client, atlas, emit: (intent) => act(client, panels, intent) };
  let mounted: Scene | null = null;
  let mountedEpoch = -1;

  function follow(): void {
    if (mounted !== null && mounted.id === client.scene && mountedEpoch === client.epoch) return;
    if (mounted !== null) {
      application.stage.removeChild(mounted.view);
      mounted.destroy();
    }
    mounted = SCENE_FACTORIES[client.scene](context);
    mountedEpoch = client.epoch;
    application.stage.addChild(mounted.view);
    resize();
  }

  function resize(): void {
    mounted?.resize(application.screen.width, application.screen.height);
  }

  return {
    follow,
    resize,
    update(elapsedMs: number): void {
      mounted?.update(elapsedMs);
    },
    destroy(): void {
      if (mounted === null) return;
      application.stage.removeChild(mounted.view);
      mounted.destroy();
      mounted = null;
    },
  };
}

function act(client: GameClient, panels: PanelDeck, intent: Intent): void {
  if (intent.kind === 'open-panel') {
    panels.open(intent.panel);
    return;
  }
  if (intent.kind === 'enter-scene') {
    client.enterScene(intent.scene);
    return;
  }
  client.say(intent.text);
}

function preventDefault(event: Event): void {
  event.preventDefault();
}

function destroyApp(
  ticker: Ticker,
  unsubscribe: () => void,
  resize: () => void,
  stage: Stage,
  panels: PanelDeck,
  atlas: Atlas,
  application: Application,
): void {
  ticker.stop();
  unsubscribe();
  window.removeEventListener('resize', resize);
  application.canvas.removeEventListener('contextmenu', preventDefault);
  stage.destroy();
  panels.destroy();
  atlas.destroy();
  application.destroy(true, { children: true });
}
