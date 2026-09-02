import { commodityOf } from './commodities.ts';
import type { CargoLot } from './state.ts';

const GRAMS_PER_KG = 1000;

export function cargoLotsMassKgOf(cargo: CargoLot[]): number {
  let grams = 0;
  for (const lot of cargo) {
    grams += lot.units * commodityOf(lot.commodityId).massGramsPerUnit;
  }
  return Math.floor(grams / GRAMS_PER_KG);
}

export function lotOf(cargo: CargoLot[], commodityId: CargoLot['commodityId']): CargoLot | undefined {
  return cargo.find((lot) => lot.commodityId === commodityId);
}
