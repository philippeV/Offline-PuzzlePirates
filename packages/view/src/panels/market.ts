import { COMMODITY_IDS, commodityOf, marketOf, stockOf } from '../client/rules.ts';
import type { CommodityId, IslandMarket, MarketStock, ShipState } from '../client/rules.ts';
import { button, clear, element, integerOf, note, section, type PanelView } from './dom.ts';
import type { PanelContext } from './panels.ts';

const COLUMN_TITLES = ['Goods', 'Stock', 'Buy', 'Sell', 'Units', 'Trade'];

export function createMarketPanel(context: PanelContext, host: HTMLElement): PanelView {
  const client = context.client;
  const wantedUnits = new Map<CommodityId, number>();
  const root = element('div', 'pp-panel');
  host.append(root);
  refresh();

  function refresh(): void {
    clear(root);
    const islandId = client.state.pirate?.atIslandId ?? null;
    if (islandId === null) {
      root.append(note('Ye must be in port to trade.'));
      return;
    }
    const market = marketOf(client.state.markets, islandId);
    if (market === undefined) {
      root.append(note('That island keeps no market.'));
      return;
    }
    const ship = context.playerShip();
    if (ship === undefined) {
      root.append(note('Ye need a hold before ye can trade.'));
      return;
    }
    const dock = section('Dock market');
    dock.append(stockTable(market, ship));
    root.append(dock);
  }

  function stockTable(market: IslandMarket, ship: ShipState): HTMLElement {
    const table = element('table', 'pp-table');
    const head = element('thead');
    const headRow = element('tr');
    for (const title of COLUMN_TITLES) headRow.append(element('th', 'pp-th', title));
    head.append(headRow);
    const body = element('tbody');
    for (const commodityId of COMMODITY_IDS) {
      const stock = stockOf(market, commodityId);
      if (stock === undefined) continue;
      body.append(stockRow(stock, ship));
    }
    table.append(head, body);
    return table;
  }

  function stockRow(stock: MarketStock, ship: ShipState): HTMLElement {
    const name = commodityOf(stock.commodityId).name;
    const row = element('tr', 'pp-tr');
    row.append(
      element('td', 'pp-td', name),
      element('td', 'pp-td', String(stock.units)),
      element('td', 'pp-td', String(stock.sellPricePoe)),
      element('td', 'pp-td', String(stock.buyPricePoe)),
    );

    const unitsCell = element('td', 'pp-td');
    const units = element('input', 'pp-field-input pp-units');
    units.type = 'number';
    units.min = '1';
    units.value = String(wantedUnits.get(stock.commodityId) ?? 1);
    units.setAttribute('aria-label', `Units of ${name}`);
    units.addEventListener('input', () => {
      wantedUnits.set(stock.commodityId, integerOf(units.value));
    });
    unitsCell.append(units);

    const tradeCell = element('td', 'pp-td');
    tradeCell.append(
      button('Buy', 'pp-buy', () => trade('market.buy', ship, stock.commodityId)),
      button('Sell', 'pp-sell', () => trade('market.sell', ship, stock.commodityId)),
    );

    row.append(unitsCell, tradeCell);
    return row;
  }

  function trade(op: 'market.buy' | 'market.sell', ship: ShipState, commodityId: CommodityId): void {
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
