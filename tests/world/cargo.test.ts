import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FIRST_ENTITY_ID } from '../../packages/sim/src/ids.ts';
import type { ShipClassId } from '../../packages/sim/src/ship/classes.ts';
import { createShip, type ShipState } from '../../packages/sim/src/ship/state.ts';
import { magazineMassKgOf } from '../../packages/sim/src/world/cargo.ts';

const SMALL_GUNNED_CLASS: ShipClassId = 'sloop';
const LARGE_GUNNED_CLASS: ShipClassId = 'war-galleon';

const A_FEW_BALLS = 10;
const A_FEW_RUMS = 10;
const A_FEW_SMALL_BALLS_MASS_KG = 71;
const A_FEW_LARGE_BALLS_MASS_KG = 213;

function armed(shipClass: ShipClassId, cannonballs: number, rum: number): ShipState {
  return createShip(
    { nextEntityId: FIRST_ENTITY_ID },
    { shipClass, allegiance: 'player', cannonballs, rum },
  );
}

test('an empty magazine weighs nothing', () => {
  assert.equal(magazineMassKgOf(armed(SMALL_GUNNED_CLASS, 0, 0)), 0);
});

test('a magazine weighs its balls at the ball mass its own cannons fire', () => {
  assert.equal(
    magazineMassKgOf(armed(SMALL_GUNNED_CLASS, A_FEW_BALLS, 0)),
    A_FEW_SMALL_BALLS_MASS_KG,
  );
  assert.equal(
    magazineMassKgOf(armed(LARGE_GUNNED_CLASS, A_FEW_BALLS, 0)),
    A_FEW_LARGE_BALLS_MASS_KG,
  );
});

test('rum weighs a kilogram a unit alongside the shot', () => {
  assert.equal(magazineMassKgOf(armed(SMALL_GUNNED_CLASS, 0, A_FEW_RUMS)), A_FEW_RUMS);
  assert.equal(
    magazineMassKgOf(armed(SMALL_GUNNED_CLASS, A_FEW_BALLS, A_FEW_RUMS)),
    A_FEW_SMALL_BALLS_MASS_KG + A_FEW_RUMS,
  );
});
