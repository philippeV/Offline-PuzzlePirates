import { Container, Graphics, Text } from 'pixi.js';

import {
  BATTLE_BOARD_HEIGHT,
  BATTLE_BOARD_WIDTH,
  TICKS_PER_SECOND,
  TICKS_PER_TURN,
  bandOf,
  damagePerMilleOf,
  findShip,
  isFullyDamaged,
  shipClassOf,
  tileAt,
} from '../client/rules.ts';
import type {
  BattleBoard,
  BattleOutcome,
  BattleShip,
  BattleState,
  BattleTile,
  EntityId,
  Facing,
  ShipState,
} from '../client/rules.ts';
import { createPlanner } from './planner.ts';
import type { Scene, SceneContext } from './scene.ts';
import {
  HUD_ACCENT,
  HUD_ALARM,
  HUD_BUTTON_HEIGHT,
  HUD_DIM_INK,
  HUD_INK,
  createButton,
  createLabelledValue,
  createMeterBar,
  createPanelBackdrop,
  createText,
  type MeterBar,
} from './hud.ts';

interface ShipRow {
  view: Container;
  title: Text;
  damage: MeterBar;
}

const SEA_FILL = 0x123044;
const SEA_GRID = 0x1b3f57;
const TALL_ROCK_FILL = 0x6a7078;
const SMALL_ROCK_FILL = 0x4a5159;
const WIND_FILL = 0x1d4d6b;
const WIND_INK = 0x9fe0f5;
const WHIRLPOOL_FILL = 0x1a2f4d;
const PLAYER_HULL = 0xe0b64a;
const BRIGAND_HULL = 0xc7523f;
const HULL_OUTLINE = 0x0a1219;

const WHIRLPOOL_COLOURS: number[] = [0x9f7de0, 0x5fd0c0, 0xe08fbf, 0x7fb2e0];

const SCENE_MARGIN = 20;
const PANEL_PADDING = 16;
const PANEL_MINIMUM_WIDTH = 260;
const PANEL_MAXIMUM_WIDTH = 404;
const SHIP_ROW_HEIGHT = 46;
const SHIP_ROW_CAPACITY = 2;

const HEADING_Y = 0;
const TURN_Y = 30;
const CLOCK_Y = 54;
const SHIPS_Y = 100;
const PLANNER_Y = SHIPS_Y + SHIP_ROW_HEIGHT * SHIP_ROW_CAPACITY + 10;

const OUTCOME_TEXTS: Record<BattleOutcome, string> = {
  'running': '',
  'player-won': 'The brigand strikes her colours.',
  'player-lost': 'Yer ship be lost.',
  'disengaged': 'Ye broke off from the fight.',
};

export function createBattleScene(context: SceneContext): Scene {
  const client = context.client;
  const view = new Container();

  const boardLayer = new Container();
  const tilesGraphic = new Graphics();
  const tileLabels = new Container();
  const shipsGraphic = new Graphics();
  const shipLabels = new Container();
  const overlay = new Container();
  const overlayVeil = new Graphics();
  const overlayText = createText('', 20, HUD_INK);
  overlayText.anchor.set(0.5);
  overlay.addChild(overlayVeil, overlayText);
  boardLayer.addChild(tilesGraphic, tileLabels, shipsGraphic, shipLabels, overlay);

  const panel = new Container();
  const panelBody = new Container();
  panel.addChild(panelBody);

  const planner = createPlanner(client);
  const panelWidthOfContent = planner.width;

  const heading = createText('Sea battle', 18, HUD_INK);
  const turn = createLabelledValue('Turn', panelWidthOfContent);
  const clock = createMeterBar('Planning window', panelWidthOfContent, HUD_ACCENT);
  const shipsBlock = new Container();
  const returnButton = createButton({
    label: 'Return to the deck',
    width: panelWidthOfContent,
    height: HUD_BUTTON_HEIGHT,
    onTap: returnToDeck,
  });

  heading.y = HEADING_Y;
  turn.view.y = TURN_Y;
  clock.view.y = CLOCK_Y;
  shipsBlock.y = SHIPS_Y;
  planner.view.y = PLANNER_Y;
  returnButton.view.y = PLANNER_Y + planner.height + 10;
  panelBody.addChild(heading, turn.view, clock.view, shipsBlock, planner.view, returnButton.view);

  overlay.visible = false;
  returnButton.view.visible = false;
  view.addChild(boardLayer, panel);

  const shipRows = new Map<EntityId, ShipRow>();
  const shipNames = new Map<EntityId, Text>();

  let sceneWidth = 1200;
  let sceneHeight = 720;
  let cellSize = 22;
  let renderedBoard: BattleBoard | null = null;
  let renderedCellSize = 0;

  const contentHeight = PLANNER_Y + planner.height + 10 + HUD_BUTTON_HEIGHT;

  function boardOf(): BattleBoard | null {
    return client.state.battle?.board ?? null;
  }

  function layout(): void {
    const board = boardOf();
    const columns = board?.width ?? BATTLE_BOARD_WIDTH;
    const rows = board?.height ?? BATTLE_BOARD_HEIGHT;
    const panelWidth = Math.max(
      PANEL_MINIMUM_WIDTH,
      Math.min(PANEL_MAXIMUM_WIDTH, sceneWidth * 0.42),
    );
    const across = Math.max(160, sceneWidth - panelWidth - SCENE_MARGIN * 3);
    const down = Math.max(160, sceneHeight - SCENE_MARGIN * 2);
    cellSize = Math.max(6, Math.floor(Math.min(across / columns, down / rows)));
    boardLayer.position.set(
      Math.round(SCENE_MARGIN + Math.max(0, (across - cellSize * columns) / 2)),
      Math.round(Math.max(SCENE_MARGIN, (sceneHeight - cellSize * rows) / 2)),
    );

    panel.position.set(sceneWidth - panelWidth - SCENE_MARGIN, SCENE_MARGIN);
    panelBody.position.set(PANEL_PADDING, PANEL_PADDING);
    panelBody.scale.set(panelScaleOf(panelWidth));
    replaceBackdrop(panelWidth);
  }

  function panelScaleOf(panelWidth: number): number {
    const acrossScale = (panelWidth - PANEL_PADDING * 2) / panelWidthOfContent;
    const downScale = (sceneHeight - SCENE_MARGIN * 2 - PANEL_PADDING * 2) / contentHeight;
    return Math.max(0.4, Math.min(1, acrossScale, downScale));
  }

  function replaceBackdrop(panelWidth: number): void {
    const previous = panel.children[0];
    if (previous !== undefined && previous !== panelBody) {
      panel.removeChild(previous);
      previous.destroy();
    }
    panel.addChildAt(createPanelBackdrop(panelWidth, sceneHeight - SCENE_MARGIN * 2), 0);
  }

  function renderTiles(board: BattleBoard): void {
    if (board === renderedBoard && cellSize === renderedCellSize) return;
    renderedBoard = board;
    renderedCellSize = cellSize;
    tilesGraphic.clear();
    tileLabels.removeChildren().forEach((child) => child.destroy());
    for (let y = 0; y < board.height; y += 1) {
      for (let x = 0; x < board.width; x += 1) {
        drawTile(tilesGraphic, tileLabels, tileAt(board, x, y), x, y, cellSize);
      }
    }
  }

  function renderShips(battle: BattleState, ships: ShipState[]): void {
    shipsGraphic.clear();
    const seen = new Set<EntityId>();
    for (const ship of battle.ships) {
      const hull = findShip(ships, ship.shipId);
      if (hull === undefined) continue;
      seen.add(ship.shipId);
      drawShip(shipsGraphic, ship, hull, cellSize);
      placeShipName(ship, hull);
    }
    for (const [id, label] of shipNames) {
      if (seen.has(id)) continue;
      shipNames.delete(id);
      label.destroy();
    }
  }

  function placeShipName(ship: BattleShip, hull: ShipState): void {
    let label = shipNames.get(ship.shipId);
    if (label === undefined) {
      label = createText('', 11, HUD_INK);
      label.anchor.set(0.5, 1);
      shipNames.set(ship.shipId, label);
      shipLabels.addChild(label);
    }
    label.text = `${titleCased(hull.allegiance)} ${shipClassOf(hull.shipClass).name}`;
    label.position.set(ship.x * cellSize + cellSize / 2, ship.y * cellSize - 2);
  }

  function syncShipRows(battle: BattleState, ships: ShipState[]): void {
    const wanted = battle.ships.slice(0, SHIP_ROW_CAPACITY);
    const seen = new Set<EntityId>();
    wanted.forEach((ship, index) => {
      seen.add(ship.shipId);
      const row = shipRows.get(ship.shipId) ?? addShipRow(ship.shipId);
      row.view.y = index * SHIP_ROW_HEIGHT;
      refreshShipRow(row, ship, findShip(ships, ship.shipId));
    });
    for (const [id, row] of shipRows) {
      if (seen.has(id)) continue;
      shipRows.delete(id);
      row.view.destroy({ children: true });
    }
  }

  function addShipRow(id: EntityId): ShipRow {
    const rowView = new Container();
    const title = createText('', 13, HUD_INK);
    const damage = createMeterBar('Damage', panelWidthOfContent, HUD_ALARM);
    damage.view.y = 16;
    rowView.addChild(title, damage.view);
    shipsBlock.addChild(rowView);
    const row = { view: rowView, title, damage };
    shipRows.set(id, row);
    return row;
  }

  function refreshShipRow(row: ShipRow, ship: BattleShip, hull: ShipState | undefined): void {
    if (hull === undefined) {
      row.view.visible = false;
      return;
    }
    row.view.visible = true;
    const perMille = damagePerMilleOf(hull);
    row.title.text = `${titleCased(hull.allegiance)} · ${shipClassOf(hull.shipClass).name}`;
    row.damage.set(perMille, damageCaptionOf(hull, perMille, ship.facing));
  }

  function renderOverlay(board: BattleBoard, outcome: BattleOutcome): void {
    const finished = outcome !== 'running';
    overlay.visible = finished;
    returnButton.view.visible = finished;
    if (!finished) return;
    overlayVeil.clear();
    overlayVeil
      .rect(0, 0, cellSize * board.width, cellSize * board.height)
      .fill({ color: 0x050a0f, alpha: 0.66 });
    overlayText.text = OUTCOME_TEXTS[outcome];
    overlayText.position.set((cellSize * board.width) / 2, (cellSize * board.height) / 2);
  }

  function render(): void {
    const state = client.state;
    const battle = state.battle;
    if (battle === null) {
      tilesGraphic.clear();
      shipsGraphic.clear();
      overlay.visible = false;
      planner.refresh(null);
      return;
    }
    renderTiles(battle.board);
    renderShips(battle, state.ships);
    syncShipRows(battle, state.ships);
    renderOverlay(battle.board, battle.outcome);
    turn.set(`${battle.turnIndex + 1}`);
    clock.set(remainingPerMilleOf(battle.turnTick), secondsLeftOf(battle.turnTick));
    planner.refresh(playerShipIdOf(battle, state.ships));
  }

  function returnToDeck(): void {
    context.emit({ kind: 'enter-scene', scene: 'deck' });
  }

  function resize(width: number, height: number): void {
    sceneWidth = width;
    sceneHeight = height;
    layout();
  }

  function update(): void {
    render();
  }

  function destroy(): void {
    planner.destroy();
    view.destroy({ children: true });
  }

  layout();

  return { id: 'battle', view, resize, update, destroy };
}

function playerShipIdOf(battle: BattleState, ships: ShipState[]): EntityId | null {
  for (const ship of battle.ships) {
    if (findShip(ships, ship.shipId)?.allegiance === 'player') return ship.shipId;
  }
  return null;
}

function remainingPerMilleOf(turnTick: number): number {
  return Math.round(((TICKS_PER_TURN - turnTick) * 1000) / TICKS_PER_TURN);
}

function secondsLeftOf(turnTick: number): string {
  return `${((TICKS_PER_TURN - turnTick) / TICKS_PER_SECOND).toFixed(1)}s`;
}

function damageCaptionOf(hull: ShipState, perMille: number, facing: Facing): string {
  const band = `band ${bandOf(perMille)}/10 · ${facing}`;
  return isFullyDamaged(hull) ? `${band} · sunk` : band;
}

function titleCased(word: string): string {
  return `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`;
}

function drawTile(
  graphic: Graphics,
  labels: Container,
  tile: BattleTile | undefined,
  x: number,
  y: number,
  size: number,
): void {
  const left = x * size;
  const top = y * size;
  graphic.rect(left, top, size, size).fill({ color: SEA_FILL });
  graphic.rect(left, top, size, size).stroke({ width: 1, color: SEA_GRID, alpha: 0.6 });
  if (tile === undefined || tile.kind === 'open') return;
  if (tile.kind === 'rock-tall') {
    drawTallRock(graphic, left, top, size);
    return;
  }
  if (tile.kind === 'rock-small') {
    graphic.circle(left + size / 2, top + size / 2, size * 0.26).fill({ color: SMALL_ROCK_FILL });
    graphic
      .circle(left + size / 2, top + size / 2, size * 0.26)
      .stroke({ width: 1, color: HULL_OUTLINE, alpha: 0.8 });
    return;
  }
  if (tile.kind === 'wind') {
    graphic.rect(left, top, size, size).fill({ color: WIND_FILL, alpha: 0.9 });
    drawArrow(graphic, left + size / 2, top + size / 2, size * 0.36, tile.facing, WIND_INK);
    return;
  }
  drawWhirlpool(graphic, labels, left, top, size, tile.id);
}

function drawTallRock(graphic: Graphics, left: number, top: number, size: number): void {
  graphic.rect(left, top, size, size).fill({ color: TALL_ROCK_FILL });
  graphic
    .poly([
      left + size * 0.5,
      top + size * 0.14,
      left + size * 0.86,
      top + size * 0.82,
      left + size * 0.14,
      top + size * 0.82,
    ])
    .fill({ color: 0x3b4046 });
  graphic.rect(left, top, size, size).stroke({ width: 1, color: HULL_OUTLINE, alpha: 0.9 });
}

function drawWhirlpool(
  graphic: Graphics,
  labels: Container,
  left: number,
  top: number,
  size: number,
  id: number,
): void {
  const colour = WHIRLPOOL_COLOURS[id % WHIRLPOOL_COLOURS.length] ?? HUD_DIM_INK;
  const cx = left + size / 2;
  const cy = top + size / 2;
  graphic.rect(left, top, size, size).fill({ color: WHIRLPOOL_FILL });
  graphic.circle(cx, cy, size * 0.38).stroke({ width: 2, color: colour, alpha: 0.9 });
  graphic.circle(cx, cy, size * 0.2).stroke({ width: 2, color: colour, alpha: 0.6 });
  if (size < 14) return;
  const label = createText(`${id}`, Math.max(8, size * 0.38), colour);
  label.anchor.set(0.5);
  label.position.set(cx, cy);
  labels.addChild(label);
}

function drawShip(graphic: Graphics, ship: BattleShip, hull: ShipState, size: number): void {
  const cx = ship.x * size + size / 2;
  const cy = ship.y * size + size / 2;
  const colour = hull.allegiance === 'player' ? PLAYER_HULL : BRIGAND_HULL;
  const heading = headingOf(ship.facing);
  const points = hullPoints(cx, cy, size * 0.42, heading);
  graphic.poly(points).fill({ color: colour, alpha: isFullyDamaged(hull) ? 0.45 : 1 });
  graphic.poly(points).stroke({ width: 1.5, color: HULL_OUTLINE });
  drawDamagePip(graphic, cx, cy + size * 0.42, size, damagePerMilleOf(hull));
}

function hullPoints(cx: number, cy: number, radius: number, heading: number): number[] {
  const corners = [0, 2.4, -2.4];
  const points: number[] = [];
  for (const corner of corners) {
    const angle = heading + corner;
    const reach = corner === 0 ? radius : radius * 0.85;
    points.push(cx + Math.cos(angle) * reach, cy + Math.sin(angle) * reach);
  }
  return points;
}

function drawDamagePip(
  graphic: Graphics,
  cx: number,
  cy: number,
  size: number,
  perMille: number,
): void {
  const width = size * 0.7;
  const filled = (width * Math.min(Math.max(perMille, 0), 1000)) / 1000;
  graphic.rect(cx - width / 2, cy, width, 3).fill({ color: 0x0a1219, alpha: 0.8 });
  if (filled > 0) graphic.rect(cx - width / 2, cy, filled, 3).fill({ color: HUD_ALARM });
}

function drawArrow(
  graphic: Graphics,
  cx: number,
  cy: number,
  reach: number,
  facing: Facing,
  colour: number,
): void {
  const heading = headingOf(facing);
  const tipX = cx + Math.cos(heading) * reach;
  const tipY = cy + Math.sin(heading) * reach;
  graphic
    .moveTo(cx - Math.cos(heading) * reach, cy - Math.sin(heading) * reach)
    .lineTo(tipX, tipY)
    .stroke({ width: 2, color: colour, cap: 'round' });
  graphic
    .poly([
      tipX,
      tipY,
      tipX + Math.cos(heading + 2.5) * reach * 0.5,
      tipY + Math.sin(heading + 2.5) * reach * 0.5,
      tipX + Math.cos(heading - 2.5) * reach * 0.5,
      tipY + Math.sin(heading - 2.5) * reach * 0.5,
    ])
    .fill({ color: colour });
}

function headingOf(facing: Facing): number {
  if (facing === 'north') return -Math.PI / 2;
  if (facing === 'east') return 0;
  if (facing === 'south') return Math.PI / 2;
  return Math.PI;
}
