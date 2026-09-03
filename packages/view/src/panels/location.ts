import { bandOf, damagePerMilleOf, islandOf, marketOf, shipClassOf } from '../client/rules.ts';
import type { IslandId, ShipState } from '../client/rules.ts';
import type { GameClient } from '../client/client.ts';
import {
  actionRow,
  button,
  clear,
  element,
  factRow,
  meterRow,
  note,
  section,
  type PanelView,
} from './dom.ts';
import type { PanelContext } from './panels.ts';

export function locationTabLabelOf(client: GameClient): string {
  if (isAboard(client)) return 'Vessel';
  return (client.state.pirate?.atIslandId ?? null) === null ? 'Location' : 'Island';
}

export function createLocationPanel(context: PanelContext, host: HTMLElement): PanelView {
  const client = context.client;
  const root = element('div', 'pp-panel');
  host.append(root);
  refresh();

  function refresh(): void {
    clear(root);
    const islandId = client.state.pirate?.atIslandId ?? null;
    if (!isAboard(client) && islandId !== null) {
      root.append(islandSection(context, islandId));
      return;
    }
    root.append(vesselSection(context));
  }

  return {
    root,
    refresh,
    destroy(): void {
      root.remove();
    },
  };
}

function isAboard(client: GameClient): boolean {
  return client.atSea || client.scene !== 'port';
}

function islandSection(context: PanelContext, islandId: IslandId): HTMLElement {
  const island = islandOf(islandId);
  const panel = section(island.name);
  panel.append(
    factRow('Size', island.size),
    factRow('Colonized', island.isColonized ? 'Aye' : 'Nay'),
  );
  const controls: HTMLElement[] = [];
  if (marketOf(context.client.state.markets, islandId) !== undefined) {
    controls.push(button('Go to the market', 'pp-to-market', () => context.open('market')));
  }
  if (context.playerShip() !== undefined) {
    controls.push(
      button('Board the ship', 'pp-board', () => {
        context.client.enterScene('deck');
      }),
    );
  }
  if (controls.length === 0) panel.append(note('Nothing stirs on this shore.'));
  else panel.append(actionRow(controls));
  return panel;
}

function vesselSection(context: PanelContext): HTMLElement {
  const ship = context.playerShip();
  if (ship === undefined) {
    const empty = section('Vessel');
    empty.append(note('Ye hold no ship.'));
    return empty;
  }
  const panel = section(shipClassOf(ship.shipClass).name);
  panel.append(
    meterRow('Speed', ship.speedPerMille, bandOf(ship.speedPerMille)),
    meterRow('Damage', damagePerMilleOf(ship), bandOf(damagePerMilleOf(ship))),
    meterRow('Bilge', ship.bilgePerMille, bandOf(ship.bilgePerMille)),
    factRow('Cannons loaded', String(ship.cannonsLoaded)),
    factRow('Rum', String(ship.rum)),
    factRow('Crew', String(ship.crewCount)),
    factRow('Duty station', ship.playerStation ?? 'Idle on deck'),
    vesselActions(context, ship),
  );
  return panel;
}

function vesselActions(context: PanelContext, ship: ShipState): HTMLElement {
  const client = context.client;
  if (client.inBattle) {
    const fighting = element('div', 'pp-vessel-actions');
    fighting.append(
      note('The guns be out. Break off if she cannot be taken.'),
      actionRow([
        button('Disengage', 'pp-disengage', () => {
          client.dispatch({ op: 'battle.disengage', shipId: ship.id });
        }),
      ]),
    );
    return fighting;
  }
  if (client.atSea) {
    const sailing = element('div', 'pp-vessel-actions');
    sailing.append(
      note('Port her once the last league be astern.'),
      actionRow([
        button('Port', 'pp-port', () => {
          client.dispatch({ op: 'voyage.port' });
        }),
      ]),
    );
    return sailing;
  }
  const moored = element('div', 'pp-vessel-actions');
  moored.append(
    note('Chart a course on the map to set sail.'),
    actionRow([
      button('Disembark', 'pp-disembark', () => {
        client.enterScene('port');
      }),
    ]),
  );
  return moored;
}
