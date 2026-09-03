import { islandOf } from '../client/rules.ts';
import {
  actionRow,
  button,
  clear,
  element,
  factRow,
  fieldId,
  integerOf,
  note,
  section,
  type PanelView,
} from './dom.ts';
import type { PanelContext } from './panels.ts';

const PIRATE_NAME = 'Scurvy Jane';

export function createYePanel(context: PanelContext, host: HTMLElement): PanelView {
  const client = context.client;
  const root = element('div', 'pp-panel');
  const facts = element('div', 'pp-facts');
  const status = element('p', 'pp-status');
  const saveText = element('textarea', 'pp-save-text');
  const saveLabel = element('label', 'pp-field-label', 'Save text');
  const seedInput = element('input', 'pp-field-input');
  const seedLabel = element('label', 'pp-field-label', 'Seed for a new game');

  saveText.id = fieldId('pp-save');
  saveText.rows = 4;
  saveText.spellcheck = false;
  saveLabel.htmlFor = saveText.id;

  seedInput.id = fieldId('pp-seed');
  seedInput.type = 'number';
  seedInput.value = String(client.state.seed);
  seedLabel.htmlFor = seedInput.id;

  const keeping = section('Yer purse and papers');
  keeping.append(
    actionRow([
      button('Save game', 'pp-save-game', save),
      button('Load game', 'pp-load-game', load),
      button('New game', 'pp-new-game', begin),
    ]),
    saveLabel,
    saveText,
    seedLabel,
    seedInput,
    status,
    note('Copy the save text to keep it. Paste it back and press Load game.'),
  );

  root.append(facts, keeping);
  host.append(root);
  refresh();

  function save(): void {
    saveText.value = client.save();
    status.textContent = 'Yer voyage be written down. Copy the text.';
  }

  function load(): void {
    const text = saveText.value.trim();
    if (text === '') {
      status.textContent = 'Paste a save text first.';
      return;
    }
    try {
      client.restore(text);
      status.textContent = 'Yer voyage be restored.';
    } catch (error) {
      status.textContent = `That save be spoiled: ${messageOf(error)}`;
    }
  }

  function begin(): void {
    client.reset(integerOf(seedInput.value));
    status.textContent = 'A fresh ocean rolls out.';
  }

  function refresh(): void {
    clear(facts);
    facts.append(
      factRow('Pirate', PIRATE_NAME),
      factRow('Whereabouts', whereaboutsOf(context)),
      factRow('Duty station', stationOf(context)),
    );
  }

  return {
    root,
    refresh,
    destroy(): void {
      root.remove();
    },
  };
}

function whereaboutsOf(context: PanelContext): string {
  const pirate = context.client.state.pirate;
  if (pirate === null || pirate.atIslandId === null) return 'At sea';
  return islandOf(pirate.atIslandId).name;
}

function stationOf(context: PanelContext): string {
  const ship = context.playerShip();
  if (ship === undefined) return 'No ship';
  return ship.playerStation ?? 'Idle on deck';
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
