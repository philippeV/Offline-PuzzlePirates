import './panels.css';

import type { GameClient } from '../client/client.ts';
import type { ShipState } from '../client/rules.ts';
import type { PanelId } from '../scenes/scene.ts';
import { createBootyPanel } from './booty.ts';
import { createChatBar } from './chat.ts';
import { button, clear, element, factRow, type PanelView } from './dom.ts';
import { createLocationPanel, locationTabLabelOf } from './location.ts';
import { createMarketPanel } from './market.ts';
import { createMinimap } from './minimap.ts';
import { createYePanel } from './ye.ts';

export type WidgetTab = 'ye' | 'location' | 'booty' | 'market';

export interface PanelContext {
  readonly client: GameClient;
  playerShip(): ShipState | undefined;
  open(panel: PanelId): void;
}

export interface PanelDeck {
  readonly root: HTMLElement;
  open(panel: PanelId): void;
  close(): void;
  refresh(): void;
  destroy(): void;
}

const TAB_ORDER: WidgetTab[] = ['ye', 'location', 'booty', 'market'];

const TAB_LABELS: Record<WidgetTab, string> = {
  ye: 'Ye',
  location: 'Location',
  booty: 'Booty',
  market: 'Market',
};

export function createPanelDeck(client: GameClient, host: HTMLElement): PanelDeck {
  const root = element('div', 'pp-overlay');
  const widget = element('aside', 'pp-widget');
  const tabStrip = element('nav', 'pp-tabs');
  const body = element('div', 'pp-panel-body');
  const money = element('footer', 'pp-money');
  const minimapSlot = element('div', 'pp-minimap-slot');
  const chatSlot = element('div', 'pp-chat-slot');
  const reopen = button('Panels', 'pp-reopen', () => open(active));

  let active: WidgetTab = 'ye';
  let isOpen = true;

  const context: PanelContext = { client, playerShip, open };

  widget.setAttribute('aria-label', 'Sunshine widget');
  tabStrip.setAttribute('role', 'tablist');
  money.setAttribute('aria-label', 'Money report');

  const tabs = new Map<WidgetTab, HTMLButtonElement>();
  for (const tab of TAB_ORDER) {
    const control = button(TAB_LABELS[tab], 'pp-tab', () => open(tab));
    control.setAttribute('role', 'tab');
    control.setAttribute('aria-controls', `pp-panel-${tab}`);
    tabs.set(tab, control);
    tabStrip.append(control);
  }
  tabStrip.append(button('Close', 'pp-close', close));

  const views = new Map<WidgetTab, PanelView>([
    ['ye', createYePanel(context, body)],
    ['location', createLocationPanel(context, body)],
    ['booty', createBootyPanel(context, body)],
    ['market', createMarketPanel(context, body)],
  ]);
  for (const [tab, view] of views) {
    view.root.id = `pp-panel-${tab}`;
    view.root.setAttribute('role', 'tabpanel');
    view.root.setAttribute('aria-label', TAB_LABELS[tab]);
  }

  const minimap = createMinimap(context, minimapSlot);
  const chat = createChatBar(context, chatSlot);

  widget.append(tabStrip, body, money);
  root.append(minimapSlot, widget, reopen, chatSlot);
  host.append(root);

  const unsubscribe = client.subscribe(refresh);
  refresh();

  function playerShip(): ShipState | undefined {
    return client.state.ships.find((ship) => ship.allegiance === 'player');
  }

  function open(panel: PanelId): void {
    if (panel === 'minimap') {
      minimap.root.focus();
      return;
    }
    if (panel === 'duty') return;
    active = panel;
    isOpen = true;
    refresh();
  }

  function close(): void {
    isOpen = false;
    refresh();
  }

  function refresh(): void {
    widget.hidden = !isOpen;
    reopen.hidden = isOpen;
    const locationTab = tabs.get('location');
    if (locationTab !== undefined) locationTab.textContent = locationTabLabelOf(client);
    for (const [tab, control] of tabs) {
      const selected = isOpen && tab === active;
      control.setAttribute('aria-selected', String(selected));
      control.classList.toggle('pp-tab-active', selected);
    }
    for (const [tab, view] of views) {
      view.root.hidden = tab !== active;
      if (tab === active) view.refresh();
    }
    renderMoney();
    minimap.refresh();
    chat.refresh();
  }

  function renderMoney(): void {
    clear(money);
    const pirate = client.state.pirate;
    money.append(factRow('Pieces of eight', pirate === null ? '—' : String(pirate.poe)));
  }

  function destroy(): void {
    unsubscribe();
    for (const view of views.values()) view.destroy();
    minimap.destroy();
    chat.destroy();
    root.remove();
  }

  return { root, open, close, refresh, destroy };
}
