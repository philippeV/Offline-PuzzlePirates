export interface PanelView {
  readonly root: HTMLElement;
  refresh(): void;
  destroy(): void;
}

let nextFieldNumber = 0;

export function fieldId(prefix: string): string {
  nextFieldNumber += 1;
  return `${prefix}-${nextFieldNumber}`;
}

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const control = element('button', `pp-button ${className}`, label);
  control.type = 'button';
  control.addEventListener('click', onClick);
  return control;
}

export function section(title: string): HTMLElement {
  const node = element('section', 'pp-section');
  node.append(element('h3', 'pp-section-title', title));
  return node;
}

export function actionRow(controls: HTMLElement[]): HTMLElement {
  const row = element('div', 'pp-actions');
  row.append(...controls);
  return row;
}

export function factRow(label: string, value: string): HTMLElement {
  const row = element('div', 'pp-fact');
  row.append(element('span', 'pp-fact-label', label), element('span', 'pp-fact-value', value));
  return row;
}

export function note(text: string): HTMLElement {
  return element('p', 'pp-note', text);
}

export function barRow(label: string, filledPerMille: number, valueText: string): HTMLElement {
  const row = element('div', 'pp-bar');
  const track = element('div', 'pp-bar-track');
  const fill = element('div', 'pp-bar-fill');
  fill.style.width = `${percentOf(filledPerMille)}%`;
  track.append(fill);
  track.setAttribute('role', 'img');
  track.setAttribute('aria-label', `${label}: ${valueText}`);
  row.append(
    element('span', 'pp-bar-label', label),
    track,
    element('span', 'pp-bar-value', valueText),
  );
  return row;
}

export function meterRow(label: string, perMille: number, band: number): HTMLElement {
  return barRow(label, perMille, `${band} of 10`);
}

export function numberField(
  labelText: string,
  value: number,
  onChange: (value: number) => void,
): HTMLElement {
  const id = fieldId('pp-number');
  const wrap = element('div', 'pp-field');
  const label = element('label', 'pp-field-label', labelText);
  label.htmlFor = id;
  const input = element('input', 'pp-field-input');
  input.type = 'number';
  input.id = id;
  input.value = String(value);
  input.addEventListener('input', () => onChange(integerOf(input.value)));
  wrap.append(label, input);
  return wrap;
}

export function integerOf(text: string): number {
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function clear(host: HTMLElement): void {
  host.replaceChildren();
}

function percentOf(perMille: number): number {
  return Math.max(0, Math.min(100, Math.round(perMille / 10)));
}
