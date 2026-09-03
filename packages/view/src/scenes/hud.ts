import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js';

export const HUD_INK = 0xe9e3d3;
export const HUD_DIM_INK = 0x93a1b0;
export const HUD_PANEL_FILL = 0x111a22;
export const HUD_PANEL_STROKE = 0x2b3a49;
export const HUD_ACCENT = 0xe0b64a;
export const HUD_ALARM = 0xd9584a;
export const HUD_WATER = 0x2f6f9f;

export const HUD_LINE_HEIGHT = 18;
export const HUD_METER_HEIGHT = 12;
export const HUD_METER_BLOCK_HEIGHT = HUD_LINE_HEIGHT + HUD_METER_HEIGHT;
export const HUD_BUTTON_HEIGHT = 26;

const FULL_METER = 1000;
const SERIF_STACK = 'Georgia, "Times New Roman", serif';

export interface LabelledValue {
  view: Container;
  set(value: string): void;
  setShown(shown: boolean): void;
}

export interface MeterBar {
  view: Container;
  set(perMille: number, caption: string): void;
}

export interface ButtonOptions {
  label: string;
  width: number;
  height: number;
  onTap(): void;
}

export interface Button {
  view: Container;
  setLabel(label: string): void;
  setEnabled(enabled: boolean): void;
  setSelected(selected: boolean): void;
}

export function textStyleOf(size: number, colour: number): TextStyleOptions {
  return { fontFamily: SERIF_STACK, fontSize: size, fill: colour };
}

export function createText(value: string, size: number, colour: number): Text {
  return new Text({ text: value, style: textStyleOf(size, colour) });
}

export function createParagraph(value: string, size: number, colour: number, width: number): Text {
  return new Text({
    text: value,
    style: { ...textStyleOf(size, colour), wordWrap: true, wordWrapWidth: width, lineHeight: 16 },
  });
}

export function createPanelBackdrop(width: number, height: number): Graphics {
  const backdrop = new Graphics();
  backdrop.roundRect(0, 0, width, height, 8).fill({ color: HUD_PANEL_FILL, alpha: 0.92 });
  backdrop.roundRect(0, 0, width, height, 8).stroke({ width: 1, color: HUD_PANEL_STROKE });
  return backdrop;
}

export function createLabelledValue(label: string, width: number): LabelledValue {
  const view = new Container();
  const name = createText(label, 13, HUD_DIM_INK);
  const value = createText('', 13, HUD_INK);
  value.anchor.set(1, 0);
  value.x = width;
  view.addChild(name, value);
  return {
    view,
    set(next: string): void {
      value.text = next;
    },
    setShown(shown: boolean): void {
      view.visible = shown;
    },
  };
}

export function createMeterBar(label: string, width: number, colour: number): MeterBar {
  const view = new Container();
  const name = createText(label, 13, HUD_DIM_INK);
  const caption = createText('', 13, HUD_INK);
  caption.anchor.set(1, 0);
  caption.x = width;
  const bar = new Graphics();
  bar.y = HUD_LINE_HEIGHT;
  view.addChild(name, caption, bar);
  return {
    view,
    set(perMille: number, text: string): void {
      caption.text = text;
      paintMeter(bar, width, colour, perMille);
    },
  };
}

export function createButton(options: ButtonOptions): Button {
  const view = new Container();
  const face = new Graphics();
  const label = createText(options.label, 12, HUD_INK);
  label.anchor.set(0.5);
  label.x = options.width / 2;
  label.y = options.height / 2;
  view.addChild(face, label);
  view.eventMode = 'static';

  let enabled = true;
  let selected = false;

  function paint(): void {
    face.clear();
    face.roundRect(0, 0, options.width, options.height, 4);
    face.fill({ color: selected ? HUD_ACCENT : HUD_PANEL_FILL, alpha: enabled ? 1 : 0.4 });
    face.roundRect(0, 0, options.width, options.height, 4);
    face.stroke({ width: 1, color: selected ? HUD_ACCENT : HUD_PANEL_STROKE, alpha: 0.9 });
    label.style.fill = faceInkOf(selected, enabled);
    label.alpha = enabled ? 1 : 0.55;
    view.cursor = enabled ? 'pointer' : 'default';
  }

  view.on('pointertap', () => {
    if (enabled) options.onTap();
  });
  paint();

  return {
    view,
    setLabel(next: string): void {
      label.text = next;
      paint();
    },
    setEnabled(next: boolean): void {
      if (next === enabled) return;
      enabled = next;
      paint();
    },
    setSelected(next: boolean): void {
      if (next === selected) return;
      selected = next;
      paint();
    },
  };
}

function paintMeter(bar: Graphics, width: number, colour: number, perMille: number): void {
  const filled = Math.round((width * clampedPerMille(perMille)) / FULL_METER);
  bar.clear();
  bar.roundRect(0, 0, width, HUD_METER_HEIGHT, 3).fill({ color: 0x0a1118 });
  if (filled > 0) bar.roundRect(0, 0, filled, HUD_METER_HEIGHT, 3).fill({ color: colour });
  bar.roundRect(0, 0, width, HUD_METER_HEIGHT, 3).stroke({ width: 1, color: HUD_PANEL_STROKE });
}

function clampedPerMille(perMille: number): number {
  return Math.min(Math.max(perMille, 0), FULL_METER);
}

function faceInkOf(selected: boolean, enabled: boolean): number {
  if (selected) return 0x101820;
  return enabled ? HUD_INK : HUD_DIM_INK;
}
