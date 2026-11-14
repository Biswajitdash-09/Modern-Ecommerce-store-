import test from 'node:test';
import assert from 'node:assert/strict';
import { GARMENTS, INITIAL_CART, RAIL_ORDER, SHEET_URLS } from './garments';
import {
  addItemToCart,
  computeCartTotals,
  computeCropLayout,
  computeMaxScroll,
  computeMobileQvScale,
  computeNeighborOffset,
  computeRailPath,
  computeRailY,
  computeScaleUnit,
  formatCurrency,
  getRailParams,
  removeCartItem,
  stepScroll,
  stepSway,
  updateCartQty,
} from './rail-math';

test('scale unit matches desktop and mobile breakpoints', () => {
  assert.equal(computeScaleUnit(1440, 900), 1);
  assert.equal(computeScaleUnit(2880, 1800), 2);
  assert.equal(computeScaleUnit(1440, 720), 0.8);
  assert.equal(computeScaleUnit(390, 844), 1);
  assert.equal(computeScaleUnit(375, 667), 667 / 780);
  assert.equal(computeScaleUnit(844, 390), 390 / 900);
  assert.equal(computeScaleUnit(0, 900), 0);
  assert.equal(computeScaleUnit(1440, 0), 0);
});

test('rail curve evaluates to 270 at edges and 344 at center on 1440x900', () => {
  const u = computeScaleUnit(1440, 900);
  const { railTop, sag } = getRailParams(1440);
  assert.equal(computeRailY(0, 1440, railTop, sag, u), 270);
  assert.equal(computeRailY(720, 1440, railTop, sag, u), 344);
  assert.equal(computeRailY(1440, 1440, railTop, sag, u), 270);

  const path = computeRailPath(1440, railTop, sag, u);
  assert.equal(path, 'M0 270.00 Q 720.00 418.00 1440.00 270.00');
});

test('maxScroll leaves symmetric start margin on last garment', () => {
  const { start, gap } = getRailParams(1440);
  const maxScroll = computeMaxScroll(start, gap, RAIL_ORDER.length, 1, 1440);
  assert.equal(maxScroll, 2 * 113 + 19 * 121 - 1440);
  assert.equal(maxScroll, 1085);
});

test('crop layout centers hookX at 0 and preserves aspect', () => {
  const crop = GARMENTS[0].crops.side;
  const layout = computeCropLayout(crop, 0.455);
  assert.equal(layout.width, 340 * 0.455);
  assert.equal(layout.height, (619 + 6) * 0.455);
  assert.equal(layout.left, -170 * 0.455);
  assert.equal(layout.bgWidth, 1360 * 0.455);
  assert.equal(layout.bgPosX, -(185 - 170) * 0.455);
  assert.equal(layout.bgPosY, -44 * 0.455);
});

test('neighbor offsets part adjacent garments symmetrically and vanish at distance >= 4', () => {
  assert.equal(computeNeighborOffset(5, 5, 0.455, 1), 0);
  const d1 = computeNeighborOffset(6, 5, 0.48, 1);
  const dMinus1 = computeNeighborOffset(4, 5, 0.48, 1);
  assert.equal(d1, 50);
  assert.equal(dMinus1, -50);
  assert.equal(computeNeighborOffset(7, 5, 0.48, 1), 24);
  assert.equal(computeNeighborOffset(8, 5, 0.48, 1), 9);
  assert.equal(computeNeighborOffset(9, 5, 0.48, 1), 0);
});

test('scroll easing and sway spring behave deterministically and respect reduced motion', () => {
  const s = stepScroll(0, 100, 1);
  assert.ok(Math.abs(s.cur - 8.5) < 1e-6);
  assert.ok(Math.abs(s.vel - 8.5) < 1e-6);

  const sw = stepSway(0, 0, 10, 1, false);
  assert.ok(sw.angle < 0);
  assert.ok(sw.angVel < 0);

  const swReduced = stepSway(3, 1, 10, 1, true);
  assert.equal(swReduced.angle, 0);
  assert.equal(swReduced.angVel, 0);
});

test('mobile quick-view scale caps at 0.46u and fits taller crop', () => {
  assert.equal(computeMobileQvScale(552, 515, 600, 1), 0.46);
  const tallScale = computeMobileQvScale(938, 934, 300, 1);
  assert.ok(Math.abs(tallScale - 300 / 944) < 1e-6);
});

test('cart state operations update counts and totals accurately', () => {
  assert.equal(RAIL_ORDER.length, 20);
  assert.ok(SHEET_URLS.side.includes('https://images.higgs.ai/?default=1&output=webp&url='));

  const initialTotals = computeCartTotals(INITIAL_CART);
  assert.equal(initialTotals.count, 3);
  assert.equal(initialTotals.total, 2070);
  assert.equal(formatCurrency(2760), '$2,760.00');

  const added = addItemToCart(INITIAL_CART, GARMENTS[0], 'S');
  assert.equal(added[0].name, 'Noir Tailored Blazer');
  assert.equal(added[0].size, 'S');
  assert.equal(added[0].qty, 1);
  assert.equal(computeCartTotals(added).count, 4);
  assert.equal(computeCartTotals(added).total, 2760);

  const incremented = updateCartQty(added, added[0].id, 1);
  assert.equal(incremented[0].qty, 2);
  assert.equal(computeCartTotals(incremented).count, 5);

  const decrementedToZero = updateCartQty(added, added[0].id, -1);
  assert.equal(decrementedToZero.length, 3);

  const removed = removeCartItem(added, '3-M');
  assert.equal(removed.length, 3);
  assert.equal(computeCartTotals(removed).count, 3);
});
