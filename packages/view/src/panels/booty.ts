import { commodityOf } from '../client/rules.ts';
import type { CargoLot, ShipState } from '../client/rules.ts';
import {
  actionRow,
  button,
  clear,
  element,
  factRow,
  note,
  section,
  type PanelView,
} from './dom.ts';
import type { PanelContext } from './panels.ts';

export function createBootyPanel(context: PanelContext, host: HTMLElement): PanelView {
  const root = element('div', 'pp-panel');
  host.append(root);
  refresh();

  function refresh(): void {
    clear(root);
    const ship = context.playerShip();
    if (ship === undefined) {
      root.append(note('Ye hold no ship, so ye hold no booty.'));
      return;
    }
    root.append(chestSection(ship, divide), holdSection(ship), storesSection(ship));
  }

  function divide(): void {
    const ship = context.playerShip();
    if (ship === undefined) return;
    context.client.dispatch({ op: 'booty.divide', shipId: ship.id });
  }

  return {
    root,
    refresh,
    destroy(): void {
      root.remove();
    },
  };
}

function chestSection(ship: ShipState, divide: () => void): HTMLElement {
  const chest = section('Booty chest');
  chest.append(
    factRow('Plundered coin', `${ship.bootyPoe} PoE`),
    factRow('Plundered goods', `${ship.bootyCargoUnits} units`),
    lotList(ship.bootyCargo, 'The chest be empty.'),
    note('Plunder cannot be sold until it be divided.'),
    actionRow([button('Divide the booty', 'pp-divide', divide)]),
  );
  return chest;
}

function holdSection(ship: ShipState): HTMLElement {
  const hold = section('Cargo hold');
  hold.append(
    factRow("Ship's coffers", `${ship.poe} PoE`),
    factRow('Tradeable goods', `${unitsOf(ship.cargo)} units`),
    lotList(ship.cargo, 'The hold be empty.'),
    note('Only hold goods may be sold at a market.'),
  );
  return hold;
}

function storesSection(ship: ShipState): HTMLElement {
  const stores = section('Stores');
  stores.append(
    factRow('Cannonballs', String(ship.cannonballs)),
    factRow('Rum', String(ship.rum)),
  );
  return stores;
}

function unitsOf(lots: CargoLot[]): number {
  return lots.reduce((total, lot) => total + lot.units, 0);
}

function lotList(lots: CargoLot[], emptyText: string): HTMLElement {
  if (lots.length === 0) return note(emptyText);
  const list = element('ul', 'pp-list');
  for (const lot of lots) {
    list.append(element('li', 'pp-lot', `${commodityOf(lot.commodityId).name} — ${lot.units}`));
  }
  return list;
}
