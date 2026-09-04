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
  type PanelView,
} from './dom.ts';
import type { PanelContext } from './panels.ts';

const HERE_MARK = '✕';
const DEFAULT_VOYAGE_TYPE: VoyageType = 'pillage';
const GENERIC_NAME_WORDS = ['isle', 'island', 'rock', 'of'];

interface ChartCell {
  readonly point: LeaguePoint;
  readonly node: HTMLElement;
  readonly mark: HTMLElement;
  readonly control: HTMLButtonElement | null;
}

export function createMinimap(context: PanelContext, host: HTMLElement): PanelView {
  const client = context.client;
  const root = element('div', 'pp-chart');
  const grid = element('div', 'pp-chart-grid');
  const chooser = element('div', 'pp-chart-choice');
  const status = element('div', 'pp-chart-status');
  const course = element('section', 'pp-section');
  const courseTitle = element('h3', 'pp-section-title');
  const courseFacts = element('div', 'pp-chart-course');
  const voyageTypeControls = new Map(VOYAGE_TYPES.map((type) => [type, voyageTypeButton(type)]));
  const voyageTypeRow = actionRow([...voyageTypeControls.values()]);
  const sailRow = actionRow([setSailButton()]);
  let selectedIslandId: IslandId | null = null;
  let selectedVoyageType: VoyageType = DEFAULT_VOYAGE_TYPE;

  const cells = orderedPointIds().map((pointId) => cellOf(leaguePointOf(pointId)));

  root.tabIndex = -1;
  root.setAttribute('aria-label', 'Chart of the archipelago');
  grid.append(...cells.map((cell) => cell.node));
  course.append(courseTitle, courseFacts, voyageTypeRow, sailRow);
  chooser.append(status, course);
  root.append(element('h2', 'pp-chart-title', 'Chart'), grid, chooser);
  host.append(root);
  refresh();

  function refresh(): void {
    const atIslandId = client.state.pirate?.atIslandId ?? null;
    if (selectedIslandId === atIslandId) selectedIslandId = null;
    paintGrid(atIslandId);
    paintVoyageTypes();
    paintChooser(atIslandId);
  }

  function cellOf(point: LeaguePoint): ChartCell {
    const mark = element('span', 'pp-here-mark', HERE_MARK);
    const islandId = point.islandId;
    if (islandId === null) {
      const sea = element('div', 'pp-cell pp-cell-sea');
      sea.style.opacity = String(0.35 + point.difficultyPerMille / 2000);
      sea.title = `League point ${point.id}`;
      sea.append(mark);
      return { point, node: sea, mark, control: null };
    }
    const island = islandOf(islandId);
    const control = button(shortNameOf(island.name), 'pp-cell pp-cell-island', () => {
      selectedIslandId = islandId;
      refresh();
    });
    control.title = island.name;
    control.append(mark);
    return { point, node: control, mark, control };
  }

  function paintGrid(atIslandId: IslandId | null): void {
    const hereId = currentPointIdOf(context);
    const route = previewRouteOf(atIslandId);
    for (const cell of cells) {
      const { point, node, control } = cell;
      const here = point.id === hereId;
      node.classList.toggle('pp-cell-route', route.includes(point.id));
      node.classList.toggle('pp-cell-here', here);
      const islandId = point.islandId;
      node.classList.toggle('pp-cell-selected', islandId !== null && islandId === selectedIslandId);
      cell.mark.hidden = !here;
      if (control !== null) control.disabled = islandId === atIslandId;
    }
  }

  function previewRouteOf(atIslandId: IslandId | null): LeaguePointId[] {
    const voyage = client.state.voyage;
    if (voyage !== null) return voyage.route;
    if (selectedIslandId === null || atIslandId === null) return [];
    return routeBetween(islandPointOf(atIslandId), islandPointOf(selectedIslandId));
  }

  function paintChooser(atIslandId: IslandId | null): void {
    clear(status);
    const voyage = client.state.voyage;
    const toIslandId = voyage === null ? selectedIslandId : null;
    course.hidden = toIslandId === null;
    if (voyage !== null) {
      status.append(
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
    if (toIslandId === null) {
      status.append(note('Click an island to chart a course.'));
      return;
    }
    paintCourse(toIslandId, atIslandId);
  }

  function paintCourse(toIslandId: IslandId, fromIslandId: IslandId | null): void {
    courseTitle.textContent = `Course to ${islandOf(toIslandId).name}`;
    clear(courseFacts);
    const route =
      fromIslandId === null
        ? []
        : routeBetween(islandPointOf(fromIslandId), islandPointOf(toIslandId));
    if (route.length === 0) {
      courseFacts.append(note(fromIslandId === null ? 'Chart a course from port.' : 'No route runs there.'));
      voyageTypeRow.hidden = true;
      sailRow.hidden = true;
      return;
    }
    courseFacts.append(factRow('Leagues', String(route.length - 1)));
    voyageTypeRow.hidden = false;
    sailRow.hidden = false;
  }

  function paintVoyageTypes(): void {
    for (const [voyageType, control] of voyageTypeControls) {
      const chosen = voyageType === selectedVoyageType;
      control.setAttribute('aria-pressed', String(chosen));
      control.classList.toggle('pp-chart-voyage-chosen', chosen);
    }
  }

  function voyageTypeButton(voyageType: VoyageType): HTMLButtonElement {
    return button(voyageType, 'pp-chart-voyage', () => {
      selectedVoyageType = voyageType;
      refresh();
    });
  }

  function setSailButton(): HTMLButtonElement {
    return button('Set sail', 'pp-chart-sail', () => {
      const toIslandId = selectedIslandId;
      const ship = context.playerShip();
      if (toIslandId === null || ship === undefined) return;
      client.dispatch({
        op: 'voyage.chart',
        shipId: ship.id,
        toIslandId,
        voyageType: selectedVoyageType,
      });
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
