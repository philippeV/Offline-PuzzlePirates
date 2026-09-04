import { COMMODITY_IDS, commodityOf, marketOf, stockOf } from '../client/rules.ts';
import type { CommodityId, IslandMarket } from '../client/rules.ts';
import { button, clear, element, integerOf, note, section, type PanelView } from './dom.ts';
import type { PanelContext } from './panels.ts';

const COLUMN_TITLES = ['Goods', 'Stock', 'Buy', 'Sell', 'Units', 'Trade'];

interface StockRow {
  readonly root: HTMLElement;
  readonly stockUnits: HTMLElement;
  readonly sellPrice: HTMLElement;
  readonly buyPrice: HTMLElement;
}

export function createMarketPanel(context: PanelContext, host: HTMLElement): PanelView {
  const client = context.client;
  const wantedUnits = new Map<CommodityId, number>();
  const root = element('div', 'pp-panel');
  const ashoreNote = note('Ye must be in port to trade.');
  const marketlessNote = note('That island keeps no market.');
  const shiplessNote = note('Ye need a hold before ye can trade.');
  const dock = section('Dock market');
  const table = element('table', 'pp-table');
  const head = element('thead');
  const headRow = element('tr');
  const body = element('tbody');
  const rows = new Map<CommodityId, StockRow>();
  let shown: HTMLElement | null = null;

  for (const title of COLUMN_TITLES) headRow.append(element('th', 'pp-th', title));
  head.append(headRow);
  for (const commodityId of COMMODITY_IDS) rows.set(commodityId, stockRow(commodityId));
  table.append(head, body);
  dock.append(table);

  host.append(root);
  refresh();

  function refresh(): void {
    const islandId = client.state.pirate?.atIslandId ?? null;
    if (islandId === null) {
      show(ashoreNote);
      return;
    }
    const market = marketOf(client.state.markets, islandId);
    if (market === undefined) {
      show(marketlessNote);
      return;
    }
    if (context.playerShip() === undefined) {
      show(shiplessNote);
      return;
    }
    fillRows(market);
    show(dock);
  }

  function show(node: HTMLElement): void {
    if (shown === node) return;
    clear(root);
    root.append(node);
    shown = node;
  }

  function fillRows(market: IslandMarket): void {
    const stocked: HTMLElement[] = [];
    for (const commodityId of COMMODITY_IDS) {
      const stock = stockOf(market, commodityId);
      const row = rows.get(commodityId);
      if (stock === undefined || row === undefined) continue;
      row.stockUnits.textContent = String(stock.units);
      row.sellPrice.textContent = String(stock.sellPricePoe);
      row.buyPrice.textContent = String(stock.buyPricePoe);
      stocked.push(row.root);
    }
    if (!bodyHolds(stocked)) body.replaceChildren(...stocked);
  }

  function bodyHolds(stocked: HTMLElement[]): boolean {
    return (
      stocked.length === body.children.length &&
      stocked.every((row, index) => body.children[index] === row)
    );
  }

  function stockRow(commodityId: CommodityId): StockRow {
    const name = commodityOf(commodityId).name;
    const row = element('tr', 'pp-tr');
    const stockUnits = element('td', 'pp-td');
    const sellPrice = element('td', 'pp-td');
    const buyPrice = element('td', 'pp-td');
    row.append(element('td', 'pp-td', name), stockUnits, sellPrice, buyPrice);

    const unitsCell = element('td', 'pp-td');
    const units = element('input', 'pp-field-input pp-units');
    units.type = 'number';
    units.min = '1';
    units.value = String(wantedUnits.get(commodityId) ?? 1);
    units.setAttribute('aria-label', `Units of ${name}`);
    units.addEventListener('input', () => {
      wantedUnits.set(commodityId, integerOf(units.value));
    });
    unitsCell.append(units);

    const tradeCell = element('td', 'pp-td');
    tradeCell.append(
      button('Buy', 'pp-buy', () => trade('market.buy', commodityId)),
      button('Sell', 'pp-sell', () => trade('market.sell', commodityId)),
    );

    row.append(unitsCell, tradeCell);
    return { root: row, stockUnits, sellPrice, buyPrice };
  }

  function trade(op: 'market.buy' | 'market.sell', commodityId: CommodityId): void {
    const ship = context.playerShip();
    if (ship === undefined) return;
    const units = wantedUnits.get(commodityId) ?? 1;
    const shipId = ship.id;
    if (op === 'market.buy') client.dispatch({ op: 'market.buy', shipId, commodityId, units });
    else client.dispatch({ op: 'market.sell', shipId, commodityId, units });
  }

  return {
    root,
    refresh,
    destroy(): void {
      root.remove();
    },
  };
}
