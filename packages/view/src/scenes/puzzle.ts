import { Container, Graphics, Rectangle, type FederatedPointerEvent } from 'pixi.js';

import {
  BILGE_RULES,
  CRAB_CELL,
  EMPTY_CELL,
  JELLY_CELL,
  PUFFER_CELL,
  flatIndexOf,
  ratingOf,
  swapPartnerOf,
} from '../client/rules.ts';
import type { Board, BoardPosition, PuzzleState, SimEvent } from '../client/rules.ts';
import type { Scene, SceneContext } from './scene.ts';
import {
  HUD_ACCENT,
  HUD_ALARM,
  HUD_BUTTON_HEIGHT,
  HUD_DIM_INK,
  HUD_INK,
  HUD_WATER,
  createButton,
  createLabelledValue,
  createMeterBar,
  createPanelBackdrop,
  createParagraph,
  createText,
} from './hud.ts';

export type MarkerShape =
  | 'circle'
  | 'square'
  | 'diamond'
  | 'triangle-up'
  | 'triangle-down'
  | 'triangle-left'
  | 'triangle-right'
  | 'plus'
  | 'cross'
  | 'ring'
  | 'bar-horizontal'
  | 'bar-vertical'
  | 'chevron-up'
  | 'chevron-down'
  | 'hexagon'
  | 'star';

interface CascadeStep {
  boardCells: number[];
  highlight: number[];
  caption: string;
  durationMs: number;
}

interface BoardPlacement {
  cellSize: number;
  originX: number;
  originY: number;
}

const CELL_COLOURS: number[] = [
  0xe69f00, 0x56b4e9, 0x009e73, 0xf0e442, 0x0072b2, 0xd55e00, 0xcc79a7, 0xdcdcdc, 0x7f3c8d,
  0x11a579, 0x3969ac, 0xf2b701, 0xe73f74, 0x80ba5a, 0xa5aa99, 0xb26b3b,
];

const CELL_MARKERS: MarkerShape[] = [
  'circle',
  'square',
  'diamond',
  'triangle-up',
  'triangle-down',
  'triangle-left',
  'triangle-right',
  'plus',
  'cross',
  'ring',
  'bar-horizontal',
  'bar-vertical',
  'chevron-up',
  'chevron-down',
  'hexagon',
  'star',
];

const DEFAULT_BOARD_WIDTH = 12;
const DEFAULT_BOARD_HEIGHT = 12;
const SEA_BACKDROP = 0x0a1219;

const CRITTER_ART: Record<number, { fill: number; shape: MarkerShape }> = {
  [CRAB_CELL]: { fill: 0xd0442f, shape: 'plus' },
  [PUFFER_CELL]: { fill: 0xe8a33d, shape: 'star' },
  [JELLY_CELL]: { fill: 0xb478d8, shape: 'ring' },
};
const EMPTY_FILL = 0x131c25;
const CELL_GAP = 2;
const CASCADE_SWAP_MS = 130;
const CASCADE_CHAIN_MS = 210;
const SURFACE_WAVE_MS = 2600;
const SURFACE_SEGMENTS = 48;
const PANEL_INNER_WIDTH = 260;
const PANEL_PADDING = 16;
const SCENE_MARGIN = 20;
const FULL_METER = 1000;

const HEADING_Y = 0;
const SCORE_Y = 34;
const MOVES_Y = 54;
const STAR_LEVEL_Y = 74;
const RATING_Y = 94;
const BILGE_Y = 122;
const CAPTION_Y = 168;
const LEAVE_Y = 196;
const HINT_Y = 236;

export function createPuzzleScene(context: SceneContext): Scene {
  const client = context.client;
  const view = new Container();

  const boardLayer = new Container();
  const cellsGraphic = new Graphics();
  const waterGraphic = new Graphics();
  const highlightGraphic = new Graphics();
  boardLayer.addChild(cellsGraphic, waterGraphic, highlightGraphic);

  const panel = new Container();
  const panelBody = new Container();
  panel.addChild(panelBody);

  const heading = createText('Bilging', 18, HUD_INK);
  const score = createLabelledValue('Score', PANEL_INNER_WIDTH);
  const moves = createLabelledValue('Moves', PANEL_INNER_WIDTH);
  const starLevel = createLabelledValue('Star level', PANEL_INNER_WIDTH);
  const rating = createLabelledValue('Duty rating', PANEL_INNER_WIDTH);
  const bilge = createMeterBar('Bilge', PANEL_INNER_WIDTH, HUD_WATER);
  const caption = createText('', 14, HUD_ACCENT);
  const hint = createParagraph(
    'Click a tile to swap it with the tile on its right. The last column cannot start a swap. Click a puffer to pop it.',
    12,
    HUD_DIM_INK,
    PANEL_INNER_WIDTH,
  );
  const keys = createParagraph(
    'Arrows move the cursor  ·  Space or Enter swaps  ·  Escape leaves the duty.',
    12,
    HUD_DIM_INK,
    PANEL_INNER_WIDTH,
  );
  const leaveButton = createButton({
    label: 'Leave duty (Esc)',
    width: PANEL_INNER_WIDTH,
    height: HUD_BUTTON_HEIGHT,
    onTap: leave,
  });

  heading.y = HEADING_Y;
  score.view.y = SCORE_Y;
  moves.view.y = MOVES_Y;
  starLevel.view.y = STAR_LEVEL_Y;
  rating.view.y = RATING_Y;
  bilge.view.y = BILGE_Y;
  caption.y = CAPTION_Y;
  leaveButton.view.y = LEAVE_Y;
  hint.y = HINT_Y;
  keys.y = HINT_Y + hint.height + 10;
  panelBody.addChild(
    heading,
    score.view,
    moves.view,
    starLevel.view,
    rating.view,
    bilge.view,
    caption,
    leaveButton.view,
    hint,
    keys,
  );

  view.addChild(boardLayer, panel);

  let placement: BoardPlacement = { cellSize: 28, originX: 0, originY: 0 };
  let sceneWidth = 960;
  let sceneHeight = 600;
  let hovered: number | null = null;
  let cursorX = 0;
  let cursorY = 0;
  let cascade: CascadeStep[] = [];
  let cascadeIndex = 0;
  let cascadeElapsedMs = 0;
  let surfaceElapsedMs = 0;
  let renderedSignature = '';
  let leaveLabel = '';

  boardLayer.eventMode = 'static';
  boardLayer.on('pointermove', onPointerMove);
  boardLayer.on('pointerleave', onPointerLeave);
  boardLayer.on('pointertap', onPointerTap);
  window.addEventListener('keydown', onKeyDown);

  function boardOf(): Board | null {
    return client.state.puzzle?.board ?? null;
  }

  function layout(): void {
    const board = boardOf();
    const columns = board?.width ?? DEFAULT_BOARD_WIDTH;
    const rows = board?.height ?? DEFAULT_BOARD_HEIGHT;
    const panelWidth = Math.max(
      160,
      Math.min(PANEL_INNER_WIDTH + PANEL_PADDING * 2, sceneWidth * 0.34),
    );
    const across = Math.max(120, sceneWidth - panelWidth - SCENE_MARGIN * 3);
    const down = Math.max(120, sceneHeight - SCENE_MARGIN * 2);
    const cellSize = Math.max(10, Math.floor(Math.min(across / columns, down / rows)));
    const boardPixelWidth = cellSize * columns;
    const boardPixelHeight = cellSize * rows;
    placement = {
      cellSize,
      originX: Math.round(SCENE_MARGIN + Math.max(0, (across - boardPixelWidth) / 2)),
      originY: Math.round(Math.max(SCENE_MARGIN, (sceneHeight - boardPixelHeight) / 2)),
    };
    boardLayer.position.set(placement.originX, placement.originY);
    boardLayer.hitArea = new Rectangle(0, 0, boardPixelWidth, boardPixelHeight);

    panel.position.set(sceneWidth - panelWidth - SCENE_MARGIN, SCENE_MARGIN);
    panelBody.position.set(PANEL_PADDING, PANEL_PADDING);
    panelBody.scale.set(Math.min(1, (panelWidth - PANEL_PADDING * 2) / PANEL_INNER_WIDTH));
    replaceBackdrop(panelWidth);
    renderedSignature = '';
  }

  function replaceBackdrop(panelWidth: number): void {
    const previous = panel.children[0];
    if (previous !== undefined && previous !== panelBody) {
      panel.removeChild(previous);
      previous.destroy();
    }
    panel.addChildAt(createPanelBackdrop(panelWidth, sceneHeight - SCENE_MARGIN * 2), 0);
  }

  function displayedCells(board: Board): number[] {
    return cascade[cascadeIndex]?.boardCells ?? board.cells;
  }

  function signatureOf(puzzle: PuzzleState): string {
    return [
      puzzle.moves,
      puzzle.starLevel,
      cascadeIndex,
      cascade.length,
      placement.cellSize,
    ].join(':');
  }

  function renderCells(board: Board): void {
    const size = placement.cellSize;
    const cells = displayedCells(board);
    cellsGraphic.clear();
    cellsGraphic.rect(0, 0, size * board.width, size * board.height).fill({ color: SEA_BACKDROP });
    for (let y = 0; y < board.height; y += 1) {
      for (let x = 0; x < board.width; x += 1) {
        drawCell(cellsGraphic, cells[flatIndexOf(board, x, y)] ?? EMPTY_CELL, x, y, size);
      }
    }
  }

  function renderWater(board: Board, puzzle: PuzzleState): void {
    const size = placement.cellSize;
    const surfaceY = puzzle.waterLineRow * size;
    const width = size * board.width;
    waterGraphic.clear();
    if (puzzle.waterLineRow >= board.height) return;
    waterGraphic
      .rect(0, surfaceY, width, size * board.height - surfaceY)
      .fill({ color: HUD_WATER, alpha: 0.36 });
    drawSurfaceLine(waterGraphic, width, surfaceY, surfaceElapsedMs);
  }

  function renderHighlight(board: Board): void {
    const size = placement.cellSize;
    highlightGraphic.clear();
    const step = cascade[cascadeIndex];
    if (step !== undefined) {
      drawCascadeFlash(highlightGraphic, board, step, size, cascadeElapsedMs);
      return;
    }
    drawPair(highlightGraphic, board, hovered, size);
    drawCursor(highlightGraphic, board, cursorX, cursorY, size);
  }

  function renderPanel(puzzle: PuzzleState): void {
    const balance = client.state.balance;
    score.set(`${puzzle.totalScore}`);
    moves.set(`${puzzle.moves}`);
    starLevel.set(`${puzzle.starLevel}`);
    bilge.set(puzzle.bilgePerMille, `${percentOf(puzzle.bilgePerMille)}%`);
    rating.setShown(balance !== null);
    if (balance !== null) rating.set(ratingOf(puzzle.dutyOutputPerMille, balance.bilging));
    caption.text = cascade[cascadeIndex]?.caption ?? '';
    const wanted = client.canEnter('deck') ? 'Leave duty (Esc)' : 'To the battle (Esc)';
    if (wanted === leaveLabel) return;
    leaveLabel = wanted;
    leaveButton.setLabel(wanted);
  }

  function render(): void {
    const puzzle = client.state.puzzle;
    const board = boardOf();
    if (puzzle === null || board === null) {
      cellsGraphic.clear();
      waterGraphic.clear();
      highlightGraphic.clear();
      return;
    }
    const signature = signatureOf(puzzle);
    if (signature !== renderedSignature) {
      renderedSignature = signature;
      renderCells(board);
    }
    renderWater(board, puzzle);
    renderHighlight(board);
    renderPanel(puzzle);
  }

  function performAt(x: number, y: number): void {
    const board = boardOf();
    if (board === null) return;
    const pokes = board.cells[flatIndexOf(board, x, y)] === PUFFER_CELL;
    if (!pokes && !isSwapOrigin(board, x, y)) return;
    const before = [...board.cells];
    const result = client.dispatch(
      pokes ? { op: 'bilge.poke', x, y } : { op: 'bilge.swap', x, y },
    );
    if (result.status === 'rejected') return;
    cascade = cascadeStepsOf(before, result.events, board);
    cascadeIndex = 0;
    cascadeElapsedMs = 0;
  }

  function advanceCascade(elapsedMs: number): void {
    if (cascade.length === 0) return;
    cascadeElapsedMs += elapsedMs;
    let step = cascade[cascadeIndex];
    while (step !== undefined && cascadeElapsedMs >= step.durationMs) {
      cascadeElapsedMs -= step.durationMs;
      cascadeIndex += 1;
      step = cascade[cascadeIndex];
    }
    if (step !== undefined) return;
    cascade = [];
    cascadeIndex = 0;
    cascadeElapsedMs = 0;
  }

  function cellUnder(event: FederatedPointerEvent): number | null {
    const board = boardOf();
    if (board === null) return null;
    const local = event.getLocalPosition(boardLayer);
    const x = Math.floor(local.x / placement.cellSize);
    const y = Math.floor(local.y / placement.cellSize);
    if (!isSwapOrigin(board, x, y)) return null;
    return flatIndexOf(board, x, y);
  }

  function tileUnder(event: FederatedPointerEvent): BoardPosition | null {
    const board = boardOf();
    if (board === null) return null;
    const local = event.getLocalPosition(boardLayer);
    const x = Math.floor(local.x / placement.cellSize);
    const y = Math.floor(local.y / placement.cellSize);
    if (x < 0 || y < 0 || x >= board.width || y >= board.height) return null;
    return { x, y };
  }

  function onPointerMove(event: FederatedPointerEvent): void {
    hovered = cellUnder(event);
  }

  function onPointerLeave(): void {
    hovered = null;
  }

  function onPointerTap(event: FederatedPointerEvent): void {
    const tile = tileUnder(event);
    if (tile === null) return;
    performAt(tile.x, tile.y);
  }

  function moveCursor(dx: number, dy: number): boolean {
    const board = boardOf();
    if (board === null) return true;
    cursorX = clamp(cursorX + dx, 0, board.width - 2);
    cursorY = clamp(cursorY + dy, 0, board.height - 1);
    return true;
  }

  function swapAtCursor(): boolean {
    performAt(cursorX, cursorY);
    return true;
  }

  function leaveByKey(): boolean {
    leave();
    return true;
  }

  function handleKey(key: string): boolean {
    if (key === 'ArrowLeft') return moveCursor(-1, 0);
    if (key === 'ArrowRight') return moveCursor(1, 0);
    if (key === 'ArrowUp') return moveCursor(0, -1);
    if (key === 'ArrowDown') return moveCursor(0, 1);
    if (key === ' ' || key === 'Enter') return swapAtCursor();
    if (key === 'Escape') return leaveByKey();
    return false;
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (handleKey(event.key)) event.preventDefault();
  }

  function leave(): void {
    const scene = client.canEnter('deck') ? 'deck' : 'battle';
    context.emit({ kind: 'enter-scene', scene });
  }

  function resize(width: number, height: number): void {
    sceneWidth = width;
    sceneHeight = height;
    layout();
  }

  function update(elapsedMs: number): void {
    surfaceElapsedMs = (surfaceElapsedMs + elapsedMs) % SURFACE_WAVE_MS;
    advanceCascade(elapsedMs);
    render();
  }

  function destroy(): void {
    window.removeEventListener('keydown', onKeyDown);
    view.destroy({ children: true });
  }

  layout();

  return { id: 'puzzle', view, resize, update, destroy };
}

function isSwapOrigin(board: Board, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= board.width || y >= board.height) return false;
  const partner = swapPartnerOf(BILGE_RULES, x, y);
  return partner.x < board.width && partner.y < board.height;
}

function cascadeStepsOf(before: number[], events: SimEvent[], board: Board): CascadeStep[] {
  const steps: CascadeStep[] = [];
  let cells = before;
  for (const event of events) {
    if (event.type === 'bilge.swapped') {
      const partner = swapPartnerOf(BILGE_RULES, event.x, event.y);
      const from = flatIndexOf(board, event.x, event.y);
      const to = flatIndexOf(board, partner.x, partner.y);
      steps.push({
        boardCells: cells,
        highlight: [from, to],
        caption: 'Swap',
        durationMs: CASCADE_SWAP_MS,
      });
      cells = exchanged(cells, from, to);
    }
    if (event.type === 'bilge.cleared') {
      steps.push({
        boardCells: cells,
        highlight: event.cells,
        caption: `Chain ${event.chain + 1}   +${event.points}`,
        durationMs: CASCADE_CHAIN_MS,
      });
    }
  }
  return steps;
}

function exchanged(cells: number[], from: number, to: number): number[] {
  const next = [...cells];
  next[from] = cells[to] ?? EMPTY_CELL;
  next[to] = cells[from] ?? EMPTY_CELL;
  return next;
}

function drawCell(graphic: Graphics, colour: number, x: number, y: number, size: number): void {
  const left = x * size + CELL_GAP / 2;
  const top = y * size + CELL_GAP / 2;
  const side = size - CELL_GAP;
  const corner = Math.max(3, side * 0.18);
  if (colour === EMPTY_CELL) {
    graphic.roundRect(left, top, side, side, corner).fill({ color: EMPTY_FILL, alpha: 0.7 });
    return;
  }
  const critter = CRITTER_ART[colour];
  if (critter !== undefined) {
    graphic.roundRect(left, top, side, side, corner).fill({ color: critter.fill });
    graphic
      .roundRect(left, top, side, side, corner)
      .stroke({ width: 2, color: SEA_BACKDROP, alpha: 0.9 });
    drawMarker(graphic, critter.shape, left + side / 2, top + side / 2, side * 0.3, inkOn(critter.fill));
    return;
  }
  const fill = CELL_COLOURS[colour % CELL_COLOURS.length] ?? SEA_BACKDROP;
  graphic.roundRect(left, top, side, side, corner).fill({ color: fill });
  graphic
    .roundRect(left, top, side, side, corner)
    .stroke({ width: 1, color: SEA_BACKDROP, alpha: 0.7 });
  const shape = CELL_MARKERS[colour % CELL_MARKERS.length] ?? 'circle';
  drawMarker(graphic, shape, left + side / 2, top + side / 2, side * 0.26, inkOn(fill));
}

function drawMarker(
  graphic: Graphics,
  shape: MarkerShape,
  cx: number,
  cy: number,
  radius: number,
  ink: number,
): void {
  const thickness = Math.max(1.5, radius * 0.42);
  switch (shape) {
    case 'circle':
      graphic.circle(cx, cy, radius).fill({ color: ink });
      return;
    case 'square':
      graphic.rect(cx - radius, cy - radius, radius * 2, radius * 2).fill({ color: ink });
      return;
    case 'diamond':
      graphic.poly(regularPoints(cx, cy, radius * 1.25, 4, 0)).fill({ color: ink });
      return;
    case 'triangle-up':
      graphic.poly(regularPoints(cx, cy, radius * 1.2, 3, 0)).fill({ color: ink });
      return;
    case 'triangle-down':
      graphic.poly(regularPoints(cx, cy, radius * 1.2, 3, Math.PI)).fill({ color: ink });
      return;
    case 'triangle-left':
      graphic.poly(regularPoints(cx, cy, radius * 1.2, 3, -Math.PI / 2)).fill({ color: ink });
      return;
    case 'triangle-right':
      graphic.poly(regularPoints(cx, cy, radius * 1.2, 3, Math.PI / 2)).fill({ color: ink });
      return;
    case 'plus':
      graphic.rect(cx - radius, cy - thickness / 2, radius * 2, thickness).fill({ color: ink });
      graphic.rect(cx - thickness / 2, cy - radius, thickness, radius * 2).fill({ color: ink });
      return;
    case 'cross':
      strokeSegment(graphic, cx - radius, cy - radius, cx + radius, cy + radius, thickness, ink);
      strokeSegment(graphic, cx - radius, cy + radius, cx + radius, cy - radius, thickness, ink);
      return;
    case 'ring':
      graphic.circle(cx, cy, radius).stroke({ width: thickness, color: ink });
      return;
    case 'bar-horizontal':
      graphic
        .rect(cx - radius * 1.2, cy - thickness / 2, radius * 2.4, thickness)
        .fill({ color: ink });
      return;
    case 'bar-vertical':
      graphic
        .rect(cx - thickness / 2, cy - radius * 1.2, thickness, radius * 2.4)
        .fill({ color: ink });
      return;
    case 'chevron-up':
      strokeSegment(graphic, cx - radius, cy + radius * 0.5, cx, cy - radius * 0.6, thickness, ink);
      strokeSegment(graphic, cx, cy - radius * 0.6, cx + radius, cy + radius * 0.5, thickness, ink);
      return;
    case 'chevron-down':
      strokeSegment(graphic, cx - radius, cy - radius * 0.5, cx, cy + radius * 0.6, thickness, ink);
      strokeSegment(graphic, cx, cy + radius * 0.6, cx + radius, cy - radius * 0.5, thickness, ink);
      return;
    case 'hexagon':
      graphic.poly(regularPoints(cx, cy, radius * 1.15, 6, 0)).fill({ color: ink });
      return;
    case 'star':
      graphic.poly(starPoints(cx, cy, radius * 1.3, radius * 0.55)).fill({ color: ink });
      return;
  }
}

function strokeSegment(
  graphic: Graphics,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  thickness: number,
  ink: number,
): void {
  graphic
    .moveTo(fromX, fromY)
    .lineTo(toX, toY)
    .stroke({ width: thickness, color: ink, cap: 'round' });
}

function regularPoints(
  cx: number,
  cy: number,
  radius: number,
  sides: number,
  rotation: number,
): number[] {
  const points: number[] = [];
  for (let corner = 0; corner < sides; corner += 1) {
    const angle = rotation - Math.PI / 2 + (corner * Math.PI * 2) / sides;
    points.push(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  }
  return points;
}

function starPoints(cx: number, cy: number, outer: number, inner: number): number[] {
  const points: number[] = [];
  for (let corner = 0; corner < 10; corner += 1) {
    const radius = corner % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (corner * Math.PI) / 5;
    points.push(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  }
  return points;
}

function drawSurfaceLine(
  graphic: Graphics,
  width: number,
  surfaceY: number,
  elapsedMs: number,
): void {
  const phase = (elapsedMs / SURFACE_WAVE_MS) * Math.PI * 2;
  graphic.moveTo(0, surfaceY);
  for (let segment = 1; segment <= SURFACE_SEGMENTS; segment += 1) {
    const across = (width * segment) / SURFACE_SEGMENTS;
    const wave = Math.sin(phase + (segment / SURFACE_SEGMENTS) * Math.PI * 4) * 3;
    graphic.lineTo(across, surfaceY + wave);
  }
  graphic.stroke({ width: 2, color: 0x9fd8f2, alpha: 0.9 });
}

function drawPair(
  graphic: Graphics,
  board: Board,
  origin: number | null,
  size: number,
): void {
  if (origin === null) return;
  const x = origin % board.width;
  const y = Math.floor(origin / board.width);
  const partner = swapPartnerOf(BILGE_RULES, x, y);
  outlineCell(graphic, x, y, size, HUD_ACCENT, 0.85);
  outlineCell(graphic, partner.x, partner.y, size, HUD_ACCENT, 0.85);
  graphic
    .moveTo(x * size + size / 2, y * size + size / 2)
    .lineTo(partner.x * size + size / 2, partner.y * size + size / 2)
    .stroke({ width: 2, color: HUD_ACCENT, alpha: 0.6 });
}

function drawCursor(graphic: Graphics, board: Board, x: number, y: number, size: number): void {
  const partner = swapPartnerOf(BILGE_RULES, x, y);
  if (partner.x >= board.width) return;
  outlineCell(graphic, x, y, size, HUD_INK, 0.9);
  outlineCell(graphic, partner.x, partner.y, size, HUD_INK, 0.4);
}

function drawCascadeFlash(
  graphic: Graphics,
  board: Board,
  step: CascadeStep,
  size: number,
  elapsedMs: number,
): void {
  const alpha = 0.85 * (1 - Math.min(elapsedMs / step.durationMs, 1)) + 0.15;
  for (const index of step.highlight) {
    const x = index % board.width;
    const y = Math.floor(index / board.width);
    graphic
      .roundRect(x * size + 1, y * size + 1, size - 2, size - 2, 4)
      .fill({ color: 0xfff4d0, alpha });
    outlineCell(graphic, x, y, size, HUD_ALARM, alpha);
  }
}

function outlineCell(
  graphic: Graphics,
  x: number,
  y: number,
  size: number,
  colour: number,
  alpha: number,
): void {
  graphic
    .roundRect(x * size + 1, y * size + 1, size - 2, size - 2, 4)
    .stroke({ width: 2, color: colour, alpha });
}

function inkOn(fill: number): number {
  const red = (fill >> 16) & 0xff;
  const green = (fill >> 8) & 0xff;
  const blue = fill & 0xff;
  return (red * 299 + green * 587 + blue * 114) / 1000 > 140 ? 0x101820 : 0xf3f6fa;
}

function percentOf(perMille: number): number {
  return Math.round((perMille * 100) / FULL_METER);
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), Math.max(low, high));
}
