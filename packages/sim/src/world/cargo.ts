import { commodityOf, type CommodityId } from './commodities.ts';
import type { CargoLot } from './state.ts';

const GRAMS_PER_KG = 1000;

export function massKgOf(commodityId: CommodityId, units: number): number {
  return Math.floor((units * commodityOf(commodityId).massGramsPerUnit) / GRAMS_PER_KG);
}

export function cargoLotsMassKgOf(cargo: CargoLot[]): number {
  return Math.floor(cargoLotsMassGramsOf(cargo) / GRAMS_PER_KG);
}

export function stowedMassKgOf(hold: CargoLot[], chest: CargoLot[]): number {
  return Math.floor((cargoLotsMassGramsOf(hold) + cargoLotsMassGramsOf(chest)) / GRAMS_PER_KG);
}

export function lotOf(cargo: CargoLot[], commodityId: CommodityId): CargoLot | undefined {
  return cargo.find((lot) => lot.commodityId === commodityId);
}

export function stowLot(cargo: CargoLot[], commodityId: CommodityId, units: number): void {
  const lot = lotOf(cargo, commodityId);
  if (lot !== undefined) {
    lot.units += units;
    return;
  }
  cargo.push({ commodityId, units });
  cargo.sort((first, second) => (first.commodityId < second.commodityId ? -1 : 1));
}

export function releaseLot(cargo: CargoLot[], lot: CargoLot, units: number): void {
  lot.units -= units;
  if (lot.units === 0) cargo.splice(cargo.indexOf(lot), 1);
}

export function transferLots(from: CargoLot[], to: CargoLot[]): number {
  let moved = 0;
  for (const lot of from) {
    stowLot(to, lot.commodityId, lot.units);
    moved += lot.units;
  }
  from.length = 0;
  return moved;
}

function cargoLotsMassGramsOf(cargo: CargoLot[]): number {
  let grams = 0;
  for (const lot of cargo) {
    grams += lot.units * commodityOf(lot.commodityId).massGramsPerUnit;
  }
  return grams;
}
