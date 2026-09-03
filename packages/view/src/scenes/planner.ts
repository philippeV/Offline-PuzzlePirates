import { Container, Text } from 'pixi.js';

import type { GameClient } from '../client/client.ts';
import { refusalOf } from '../client/log.ts';
import {
  DISENGAGE_COUNTER_START_TURNS,
  MOVE_TOKENS,
  PHASES_PER_TURN,
  battleShipOf,
  findShip,
  heldTokensOf,
  idlePlan,
  planRejectionOf,
  shipClassOf,
} from '../client/rules.ts';
import type {
  BattlePhasePlan,
  EntityId,
  MoveToken,
  PhaseFire,
  PhaseMove,
  TokenPool,
} from '../client/rules.ts';
import {
  HUD_ACCENT,
  HUD_ALARM,
  HUD_BUTTON_HEIGHT,
  HUD_DIM_INK,
  HUD_INK,
  createButton,
  createLabelledValue,
  createMeterBar,
  createParagraph,
  createText,
  type Button,
} from './hud.ts';

export type BeamSide = Extract<PhaseFire, { kind: 'grapple' }>['side'];

export type FirePick =
  | { kind: 'none' }
  | { kind: 'guns'; side: BeamSide }
  | { kind: 'grapple'; side: BeamSide };

export interface Planner {
  view: Container;
  readonly width: number;
  readonly height: number;
  refresh(shipId: EntityId | null): void;
  destroy(): void;
}

interface PhaseRow {
  view: Container;
  moveButtons: Button[];
  fireButtons: Button[];
  fewer: Button;
  more: Button;
  count: Text;
}

const PLANNER_WIDTH = 360;
const ROW_HEIGHT = 58;
const LABEL_WIDTH = 46;
const MOVE_BUTTON_WIDTH = 40;
const FIRE_BUTTON_WIDTH = 44;
const BUTTON_GAP = 4;
const SMALL_BUTTON_WIDTH = 20;
const ROW_BUTTON_HEIGHT = 22;
const ROWS_HEIGHT = ROW_HEIGHT * PHASES_PER_TURN;
const TOKENS_Y = ROWS_HEIGHT + 6;
const GUNS_Y = TOKENS_Y + 20;
const BREAK_OFF_Y = GUNS_Y + 24;
const ACTIONS_Y = BREAK_OFF_Y + 40;
const REFUSAL_Y = ACTIONS_Y + HUD_BUTTON_HEIGHT + 10;
const NOTE_Y = REFUSAL_Y + 18;
const PLANNER_HEIGHT = NOTE_Y + 34;
const ACTION_BUTTON_WIDTH = (PLANNER_WIDTH - BUTTON_GAP) / 2;
const FULL_METER = 1000;

const MOVE_OPTIONS: { label: string; move: PhaseMove }[] = [
  { label: '—', move: { kind: 'none' } },
  { label: 'Rest', move: { kind: 'rest' } },
  { label: '◄', move: { kind: 'move', token: 'left' } },
  { label: '▲', move: { kind: 'move', token: 'forward' } },
  { label: '►', move: { kind: 'move', token: 'right' } },
];

const FIRE_OPTIONS: { label: string; pick: FirePick }[] = [
  { label: '—', pick: { kind: 'none' } },
  { label: 'P gun', pick: { kind: 'guns', side: 'port' } },
  { label: 'S gun', pick: { kind: 'guns', side: 'starboard' } },
  { label: 'P grp', pick: { kind: 'grapple', side: 'port' } },
  { label: 'S grp', pick: { kind: 'grapple', side: 'starboard' } },
];

const TOKEN_GLYPHS: Record<MoveToken, string> = {
  left: '◄',
  forward: '▲',
  right: '►',
};

export function createPlanner(client: GameClient): Planner {
  const view = new Container();
  const rows: PhaseRow[] = [];

  let draft: BattlePhasePlan[] = idlePlan();
  let currentShipId: EntityId | null = null;
  let plannedTurnIndex = -1;
  let maximumShotsPerSide = 1;

  for (let phase = 0; phase < PHASES_PER_TURN; phase += 1) {
    const row = createPhaseRow(phase);
    row.view.y = phase * ROW_HEIGHT;
    rows.push(row);
    view.addChild(row.view);
  }

  const tokens = createLabelledValue('Move tokens', PLANNER_WIDTH);
  const guns = createLabelledValue('Guns', PLANNER_WIDTH);
  const breakOff = createMeterBar('Break off', PLANNER_WIDTH, HUD_ACCENT);
  const submitButton = createButton({
    label: 'Set the turn',
    width: ACTION_BUTTON_WIDTH,
    height: HUD_BUTTON_HEIGHT,
    onTap: submit,
  });
  const disengageButton = createButton({
    label: 'Break off',
    width: ACTION_BUTTON_WIDTH,
    height: HUD_BUTTON_HEIGHT,
    onTap: disengage,
  });
  const refusal = createParagraph('', 12, HUD_ALARM, PLANNER_WIDTH);
  const note = createParagraph('', 12, HUD_DIM_INK, PLANNER_WIDTH);

  tokens.view.y = TOKENS_Y;
  guns.view.y = GUNS_Y;
  breakOff.view.y = BREAK_OFF_Y;
  submitButton.view.y = ACTIONS_Y;
  disengageButton.view.position.set(ACTION_BUTTON_WIDTH + BUTTON_GAP, ACTIONS_Y);
  refusal.y = REFUSAL_Y;
  note.y = NOTE_Y;
  view.addChild(
    tokens.view,
    guns.view,
    breakOff.view,
    submitButton.view,
    disengageButton.view,
    refusal,
    note,
  );

  function createPhaseRow(phase: number): PhaseRow {
    const rowView = new Container();
    const label = createText(`Phase ${phase + 1}`, 12, HUD_DIM_INK);
    label.y = 4;
    rowView.addChild(label);

    const moveButtons = MOVE_OPTIONS.map((option, index) =>
      placeButton(rowView, option.label, MOVE_BUTTON_WIDTH, index, 0, () =>
        chooseMove(phase, option.move),
      ),
    );
    const fireButtons = FIRE_OPTIONS.map((option, index) =>
      placeButton(rowView, option.label, FIRE_BUTTON_WIDTH, index, 26, () =>
        chooseFire(phase, option.pick),
      ),
    );

    const stepperX = LABEL_WIDTH + BUTTON_GAP + FIRE_OPTIONS.length * (FIRE_BUTTON_WIDTH + BUTTON_GAP);
    const fewer = createButton({
      label: '−',
      width: SMALL_BUTTON_WIDTH,
      height: ROW_BUTTON_HEIGHT,
      onTap: () => stepShots(phase, -1),
    });
    const more = createButton({
      label: '+',
      width: SMALL_BUTTON_WIDTH,
      height: ROW_BUTTON_HEIGHT,
      onTap: () => stepShots(phase, 1),
    });
    const count = createText('', 12, HUD_INK);
    count.anchor.set(0.5, 0);
    fewer.view.position.set(stepperX, 26);
    count.position.set(stepperX + SMALL_BUTTON_WIDTH + 12, 30);
    more.view.position.set(stepperX + SMALL_BUTTON_WIDTH + 24, 26);
    rowView.addChild(fewer.view, count, more.view);

    return { view: rowView, moveButtons, fireButtons, fewer, more, count };
  }

  function chooseMove(phase: number, move: PhaseMove): void {
    const current = draft[phase];
    if (current === undefined) return;
    draft[phase] = { move: clonedMove(move), fire: current.fire };
  }

  function chooseFire(phase: number, pick: FirePick): void {
    const current = draft[phase];
    if (current === undefined) return;
    draft[phase] = { move: current.move, fire: firedFrom(pick, current.fire, maximumShotsPerSide) };
  }

  function stepShots(phase: number, delta: number): void {
    const current = draft[phase];
    if (current === undefined || current.fire.kind !== 'guns') return;
    const count = clamp(current.fire.count + delta, 1, maximumShotsPerSide);
    draft[phase] = {
      move: current.move,
      fire: { kind: 'guns', side: current.fire.side, count },
    };
  }

  function submit(): void {
    if (currentShipId === null) return;
    client.dispatch({ op: 'battle.plan', shipId: currentShipId, plan: clonedPlan(draft) });
  }

  function disengage(): void {
    if (currentShipId === null) return;
    client.dispatch({ op: 'battle.disengage', shipId: currentShipId });
  }

  function refresh(shipId: EntityId | null): void {
    const state = client.state;
    const battle = state.battle;
    const ship = battle === null || shipId === null ? undefined : battleShipOf(battle, shipId);
    const hull = shipId === null ? undefined : findShip(state.ships, shipId);
    if (battle === null || shipId === null || ship === undefined || hull === undefined) {
      view.visible = false;
      return;
    }
    view.visible = true;
    if (shipId !== currentShipId || battle.turnIndex !== plannedTurnIndex) {
      currentShipId = shipId;
      plannedTurnIndex = battle.turnIndex;
      draft = idlePlan();
    }
    maximumShotsPerSide = shipClassOf(hull.shipClass).shotsPerSidePerPhase;

    for (let phase = 0; phase < rows.length; phase += 1) refreshRow(rows[phase], draft[phase]);

    tokens.set(MOVE_TOKENS.map((token) => tokenTallyOf(ship.tokens, token)).join('   '));
    guns.set(`${hull.cannonsLoaded} loaded · ${hull.cannonballs} shot`);

    const ready = ship.disengageCounter <= 0;
    breakOff.set(readinessOf(ship.disengageCounter), ready ? 'ready' : `${ship.disengageCounter}`);
    disengageButton.setEnabled(ready && battle.outcome === 'running');

    const rejection = planRejectionOf(hull.shipClass, draft);
    submitButton.setEnabled(rejection === null && battle.outcome === 'running');
    refusal.text = rejection === null ? '' : refusalOf(rejection);
    note.text = ready
      ? 'She may break off from the fight.'
      : `She may break off after ${ship.disengageCounter} more turns.`;
  }

  function refreshRow(row: PhaseRow | undefined, phase: BattlePhasePlan | undefined): void {
    if (row === undefined || phase === undefined) return;
    MOVE_OPTIONS.forEach((option, index) => {
      row.moveButtons[index]?.setSelected(isMoveChosen(phase.move, option.move));
    });
    FIRE_OPTIONS.forEach((option, index) => {
      row.fireButtons[index]?.setSelected(isFireChosen(phase.fire, option.pick));
    });
    const fire = phase.fire;
    row.count.text = fire.kind === 'guns' ? `${fire.count}` : '–';
    row.fewer.setEnabled(fire.kind === 'guns' && fire.count > 1);
    row.more.setEnabled(fire.kind === 'guns' && fire.count < maximumShotsPerSide);
  }

  function destroy(): void {
    view.destroy({ children: true });
  }

  return { view, width: PLANNER_WIDTH, height: PLANNER_HEIGHT, refresh, destroy };
}

function placeButton(
  rowView: Container,
  label: string,
  width: number,
  index: number,
  y: number,
  onTap: () => void,
): Button {
  const button = createButton({ label, width, height: ROW_BUTTON_HEIGHT, onTap });
  button.view.position.set(LABEL_WIDTH + BUTTON_GAP + index * (width + BUTTON_GAP), y);
  rowView.addChild(button.view);
  return button;
}

function tokenTallyOf(pool: TokenPool, token: MoveToken): string {
  return `${TOKEN_GLYPHS[token]} ${heldTokensOf(pool, token)}`;
}

function readinessOf(disengageCounter: number): number {
  const elapsed = DISENGAGE_COUNTER_START_TURNS - disengageCounter;
  return Math.round((clamp(elapsed, 0, DISENGAGE_COUNTER_START_TURNS) * FULL_METER) /
    DISENGAGE_COUNTER_START_TURNS);
}

function firedFrom(pick: FirePick, current: PhaseFire, maximumShots: number): PhaseFire {
  if (pick.kind === 'none') return { kind: 'none' };
  if (pick.kind === 'grapple') return { kind: 'grapple', side: pick.side };
  const held = current.kind === 'guns' ? current.count : 1;
  return { kind: 'guns', side: pick.side, count: clamp(held, 1, maximumShots) };
}

function isMoveChosen(chosen: PhaseMove, option: PhaseMove): boolean {
  if (chosen.kind !== option.kind) return false;
  if (chosen.kind !== 'move' || option.kind !== 'move') return true;
  return chosen.token === option.token;
}

function isFireChosen(chosen: PhaseFire, option: FirePick): boolean {
  if (chosen.kind !== option.kind) return false;
  if (chosen.kind === 'none' || option.kind === 'none') return true;
  return chosen.side === option.side;
}

function clonedPlan(plan: BattlePhasePlan[]): BattlePhasePlan[] {
  return plan.map((phase) => ({ move: clonedMove(phase.move), fire: clonedFire(phase.fire) }));
}

function clonedMove(move: PhaseMove): PhaseMove {
  if (move.kind === 'move') return { kind: 'move', token: move.token };
  if (move.kind === 'rest') return { kind: 'rest' };
  return { kind: 'none' };
}

function clonedFire(fire: PhaseFire): PhaseFire {
  if (fire.kind === 'guns') return { kind: 'guns', side: fire.side, count: fire.count };
  if (fire.kind === 'grapple') return { kind: 'grapple', side: fire.side };
  return { kind: 'none' };
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), Math.max(low, high));
}
