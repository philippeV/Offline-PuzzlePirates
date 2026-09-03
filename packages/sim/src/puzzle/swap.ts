import { BILGE_RULES } from './bilging.ts';
import {
  JELLY_CELL,
  PUFFER_CELL,
  cellAt,
  flatIndexOf,
  isColourCell,
  swapCells,
  swapPartnerOf,
  type Board,
  type BoardCell,
  type BoardPosition,
} from './board.ts';
import { colourCellsOf, detonationCellsOf } from './critters.ts';
import type { OpeningClear } from './resolve.ts';

interface SwapSide {
  position: BoardPosition;
  cell: BoardCell | undefined;
}

export function applyBilgeSwap(board: Board, x: number, y: number): OpeningClear | null {
  const partner = swapPartnerOf(BILGE_RULES, x, y);
  const here = sideOf(board, { x, y });
  const there = sideOf(board, partner);
  const opening = detonationOf(board, here, there) ?? colourSweepOf(board, here, there);
  if (opening !== null) return opening;
  swapCells(board, x, y, BILGE_RULES);
  return null;
}

function sideOf(board: Board, position: BoardPosition): SwapSide {
  return { position, cell: cellAt(board, position.x, position.y) };
}

function detonationOf(board: Board, here: SwapSide, there: SwapSide): OpeningClear | null {
  const puffer = pufferBesideJelly(here, there) ?? pufferBesideJelly(there, here);
  if (puffer === null) return null;
  return { kind: 'poke', cells: detonationCellsOf(board, puffer.x, puffer.y) };
}

function pufferBesideJelly(puffer: SwapSide, jelly: SwapSide): BoardPosition | null {
  if (puffer.cell !== PUFFER_CELL || jelly.cell !== JELLY_CELL) return null;
  return puffer.position;
}

function colourSweepOf(board: Board, here: SwapSide, there: SwapSide): OpeningClear | null {
  const sweep = sweptColourOf(here, there) ?? sweptColourOf(there, here);
  if (sweep === null) return null;
  const [jelly, colour] = sweep;
  const cells = [...colourCellsOf(board, colour), flatIndexOf(board, jelly.x, jelly.y)];
  return { kind: 'jelly', cells: cells.sort((left, right) => left - right) };
}

function sweptColourOf(jelly: SwapSide, colour: SwapSide): [BoardPosition, BoardCell] | null {
  if (jelly.cell !== JELLY_CELL || !isColourCell(colour.cell)) return null;
  return [jelly.position, colour.cell];
}
