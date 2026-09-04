import assert from 'node:assert/strict';
import { before, test } from 'node:test';

import { Window } from 'happy-dom';

import { BALANCE } from '../../packages/harness/src/balance.ts';
import { GameClient } from '../../packages/view/src/client/client.ts';
import { createMinimap } from '../../packages/view/src/panels/minimap.ts';
import type { PanelContext } from '../../packages/view/src/panels/panels.ts';

const SEED = 12648430;

before(() => {
  const window = new Window();
  globalThis.document = window.document as unknown as Document;
});

function mountChart(): { context: PanelContext; host: HTMLElement; refresh: () => void } {
  const client = GameClient.create({ seed: SEED, balance: BALANCE });
  const context: PanelContext = {
    client,
    playerShip: () => client.state.ships.find((ship) => ship.allegiance === 'player'),
    open: () => undefined,
  };
  const host = document.createElement('div');
  document.body.replaceChildren(host);
  const view = createMinimap(context, host);
  return { context, host, refresh: () => view.refresh() };
}

function islandCell(host: HTMLElement, name: string): HTMLButtonElement {
  const cell = host.querySelector<HTMLButtonElement>(`.pp-cell-island[title="${name}"]`);
  if (cell === null) throw new Error(`the chart has no cell for ${name}`);
  return cell;
}

function courseSection(host: HTMLElement): HTMLElement {
  const course = host.querySelector<HTMLElement>('.pp-chart-choice .pp-section');
  if (course === null) throw new Error('the chart has no course section');
  return course;
}

test('an island cell survives the simulation running under the pointer', () => {
  const { host, context, refresh } = mountChart();
  const doyle = islandCell(host, 'Doyle Island');

  for (let tick = 0; tick < 10; tick += 1) {
    context.client.advance(1);
    refresh();
  }

  assert.ok(
    islandCell(host, 'Doyle Island') === doyle && doyle.isConnected,
    'the cell the player pressed was replaced while they pressed it',
  );
});

test('clicking an island offers that course, its voyage types and a confirm control', () => {
  const { host } = mountChart();

  assert.match(host.textContent ?? '', /Click an island to chart a course\./);

  islandCell(host, 'Doyle Island').click();

  const course = courseSection(host);
  assert.equal(course.hidden, false);
  assert.match(course.textContent ?? '', /Course to Doyle Island/);
  assert.equal(course.querySelectorAll('.pp-chart-voyage').length, 3);
  assert.equal(course.querySelectorAll('.pp-chart-sail').length, 1);
});

test('the route the course would sail is previewed before the ship departs', () => {
  const { host, context } = mountChart();

  assert.equal(host.querySelectorAll('.pp-cell-route').length, 0);

  islandCell(host, 'Doyle Island').click();

  assert.equal(context.client.state.voyage, null);
  assert.ok(
    host.querySelectorAll('.pp-cell-route').length > 1,
    'selecting an island previewed no route on the grid',
  );
});

test('the island the player is standing on is disabled rather than offered', () => {
  const { host, context } = mountChart();

  assert.equal(context.client.state.pirate?.atIslandId, 'alkaid');
  assert.equal(islandCell(host, 'Alkaid Island').disabled, true);
  assert.equal(islandCell(host, 'Doyle Island').disabled, false);
});

test('the chart keeps keyboard focus while the simulation runs', () => {
  const { host, context, refresh } = mountChart();
  const doyle = islandCell(host, 'Doyle Island');

  doyle.focus();
  context.client.advance(120);
  refresh();

  assert.ok(document.activeElement === doyle, 'the cell lost keyboard focus while the world ran');
});

test('the chosen voyage type and Set sail charts the course', () => {
  const { host, context } = mountChart();

  islandCell(host, 'Doyle Island').click();
  const trade = [...courseSection(host).querySelectorAll<HTMLButtonElement>('.pp-chart-voyage')].find(
    (control) => control.textContent === 'trade',
  );
  trade?.click();
  courseSection(host).querySelector<HTMLButtonElement>('.pp-chart-sail')?.click();

  assert.equal(context.client.state.voyage?.type, 'trade');
  assert.ok((context.client.state.voyage?.route.length ?? 0) > 1);
});
