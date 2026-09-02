import { balanceOf } from '@opp/sim';
import { DEFAULT_OPENING, mount, type GameApp, type Opening } from '@opp/view';

import balanceFile from '../../../balance.json' with { type: 'json' };

const DEFAULT_SEED = 12648430;
const DEFAULT_SCENE = 'port';
const SCENE_NAMES = ['port', 'deck', 'puzzle', 'battle'] as const;
const INTEGER_PATTERN = /^-?\d+$/;

type SceneName = (typeof SCENE_NAMES)[number];

declare global {
  interface Window {
    __ppApp?: GameApp;
  }
}

function seedFrom(search: URLSearchParams): number {
  const raw = search.get('seed');
  if (raw === null) return DEFAULT_SEED;
  if (!INTEGER_PATTERN.test(raw) || !Number.isSafeInteger(Number(raw))) {
    console.warn(`Ignoring non-integer seed "${raw}"; falling back to ${DEFAULT_SEED}.`);
    return DEFAULT_SEED;
  }
  return Number(raw);
}

function sceneFrom(search: URLSearchParams): SceneName {
  const raw = search.get('scene');
  if (raw === null) return DEFAULT_SCENE;
  const named = SCENE_NAMES.find((scene) => scene === raw);
  if (named === undefined) {
    console.warn(`Ignoring unknown scene "${raw}"; falling back to ${DEFAULT_SCENE}.`);
    return DEFAULT_SCENE;
  }
  return named;
}

function openingFor(scene: SceneName): Opening {
  return scene === 'battle' ? 'sea-battle' : DEFAULT_OPENING;
}

function hostElement(id: string): HTMLElement {
  const host = document.getElementById(id);
  if (host === null) throw new Error(`The app shell is missing its #${id} host element.`);
  return host;
}

function showFailure(headline: string, detail: string): void {
  const banner = document.createElement('div');
  banner.id = 'shell-failure';
  banner.setAttribute('role', 'alert');
  const title = document.createElement('h1');
  title.textContent = headline;
  const body = document.createElement('p');
  body.textContent = detail;
  banner.append(title, body);
  document.body.append(banner);
}

function enterRequestedScene(app: GameApp, requested: SceneName): SceneName {
  if (app.client.scene !== requested) app.client.enterScene(requested);
  return app.client.scene;
}

function nextPresentedFrame(): Promise<void> {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function signalReady(): void {
  document.documentElement.dataset.renderReady = 'true';
  window.dispatchEvent(new CustomEvent('render:ready'));
}

function reportMountFailure(reason: unknown): void {
  const detail = reason instanceof Error ? reason.message : String(reason);
  document.documentElement.dataset.renderError = detail;
  showFailure('Offline Puzzle Pirates could not start.', detail);
  console.error(reason);
}

async function start(): Promise<void> {
  const search = new URLSearchParams(location.search);
  const requestedScene = sceneFrom(search);

  const app = await mount({
    canvasHost: hostElement('stage'),
    panelHost: hostElement('panels'),
    balance: balanceOf(balanceFile),
    seed: seedFrom(search),
    opening: openingFor(requestedScene),
  });
  window.__ppApp = app;

  const presentedScene = enterRequestedScene(app, requestedScene);
  document.documentElement.dataset.renderScene = presentedScene;
  if (presentedScene !== requestedScene) {
    document.documentElement.dataset.sceneRefused = requestedScene;
    showFailure(
      `The view would not open the ${requestedScene} scene.`,
      `?scene=${requestedScene} was requested; the view stayed on ${presentedScene}.`,
    );
  }

  await nextPresentedFrame();
  signalReady();
}

start().catch(reportMountFailure);
