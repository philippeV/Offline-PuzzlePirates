import {
  LEAGUE_POINT_IDS,
  VOYAGE_TYPES,
  islandOf,
  islandPointOf,
  leaguePointOf,
  routeBetween,
} from '../client/rules.ts';
import type { IslandId, LeaguePoint, LeaguePointId, VoyageType } from '../client/rules.ts';
import {
  actionRow,
  barRow,
  button,
  clear,
  element,
  factRow,
  note,
  section,
  type PanelView,
} from './dom.ts';
import type { PanelContext } from './panels.ts';

const HERE_MARK = '✕';
const GENERIC_NAME_WORDS = ['isle', 'island', 'rock', 'of'];

export function createMinimap(context: PanelContext, host: HTMLElement): PanelView {
  const client = context.client;
  const root = element('div', 'pp-chart');
  const grid = element('div', 'pp-chart-grid');
  const chooser = element('div', 'pp-chart-choice');
  let selectedIslandId: IslandId | null = null;

  root.tabIndex = -1;
  root.setAttribute('aria-label', 'Chart of the archipelago');
  root.append(element('h2', 'pp-chart-title', 'Chart'), grid, chooser);
  host.append(root);
  refresh();

  function refresh(): void {
    drawGrid();
    drawChooser();
  }

  function drawGrid(): void {
    clear(grid);
    const hereId = currentPointIdOf(context);
    const route = client.state.voyage?.route ?? [];
    for (const pointId of orderedPointIds()) {
      grid.append(cellOf(leaguePointOf(pointId), hereId, route));
    }
  }

  function cellOf(point: LeaguePoint, hereId: LeaguePointId | null, route: LeaguePointId[]): HTMLElement {
    const classes = ['pp-cell'];
    if (route.includes(point.id)) classes.push('pp-cell-route');
    if (point.id === hereId) classes.push('pp-cell-here');
    if (point.islandId !== null && point.islandId === selectedIslandId) {
      classes.push('pp-cell-selected');
    }
    const islandId = point.islandId;
    if (islandId === null) {
      const sea = element('div', `${classes.join(' ')} pp-cell-sea`);
      sea.style.opacity = String(0.35 + point.difficultyPerMille / 2000);
      sea.title = `League point ${point.id}`;
      if (point.id === hereId) sea.append(element('span', 'pp-here-mark', HERE_MARK));
      return sea;
    }
    const island = islandOf(islandId);
    const control = button(shortNameOf(island.name), `${classes.join(' ')} pp-cell-island`, () => {
      selectedIslandId = islandId;
      refresh();
    });
    control.title = island.name;
    if (point.id === hereId) control.append(element('span', 'pp-here-mark', HERE_MARK));
    return control;
  }

  function drawChooser(): void {
    clear(chooser);
    const voyage = client.state.voyage;
    if (voyage !== null) {
      chooser.append(
        factRow('Leg', `${voyage.legIndex} of ${voyage.route.length - 1}`),
        factRow('Voyage', voyage.type),
        barRow(
          'Leg progress',
          progressPerMilleOf(voyage.legTicks, voyage.legTicksRequired),
          `${voyage.legTicks}/${voyage.legTicksRequired}`,
        ),
      );
      return;
    }
    if (selectedIslandId === null) {
      chooser.append(note('Click an island to chart a course.'));
      return;
    }
    chooser.append(courseSection(selectedIslandId));
  }

  function courseSection(toIslandId: IslandId): HTMLElement {
    const panel = section(`Course to ${islandOf(toIslandId).name}`);
    const fromIslandId = client.state.pirate?.atIslandId ?? null;
    if (fromIslandId === null) {
      panel.append(note('Chart a course from port.'));
      return panel;
    }
    const route = routeBetween(islandPointOf(fromIslandId), islandPointOf(toIslandId));
    if (route.length === 0) {
      panel.append(note('No route runs there.'));
      return panel;
    }
    panel.append(factRow('Leagues', String(route.length - 1)));
    panel.append(
      actionRow(VOYAGE_TYPES.map((voyageType) => voyageButton(toIslandId, voyageType))),
    );
    return panel;
  }

  function voyageButton(toIslandId: IslandId, voyageType: VoyageType): HTMLButtonElement {
    return button(voyageType, 'pp-chart-voyage', () => {
      const ship = context.playerShip();
      if (ship === undefined) return;
      client.dispatch({ op: 'voyage.chart', shipId: ship.id, toIslandId, voyageType });
    });
  }

  return {
    root,
    refresh,
    destroy(): void {
      root.remove();
    },
  };
}

function orderedPointIds(): LeaguePointId[] {
  return [...LEAGUE_POINT_IDS].sort((first, second) => {
    const a = leaguePointOf(first);
    const b = leaguePointOf(second);
    return a.row === b.row ? a.col - b.col : a.row - b.row;
  });
}

function currentPointIdOf(context: PanelContext): LeaguePointId | null {
  const state = context.client.state;
  const voyage = state.voyage;
  if (voyage !== null) return voyage.route[voyage.legIndex] ?? null;
  const islandId = state.pirate?.atIslandId ?? null;
  return islandId === null ? null : islandPointOf(islandId);
}

function progressPerMilleOf(ticks: number, required: number): number {
  if (required <= 0) return 0;
  return Math.floor((ticks * 1000) / required);
}

function shortNameOf(name: string): string {
  const words = name.split(' ').filter((word) => !GENERIC_NAME_WORDS.includes(word.toLowerCase()));
  return words.length === 0 ? name : words.join(' ');
}
