import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activateWithAd,
  createGrid,
  GENERAL_REWARD_GRID_COUNT,
  GRID_COLUMN_COUNT,
  GRID_ROW_COUNT,
  gridCenterFromId,
  gridIndexFromId,
  gridIdFromCoordinate,
  leaveMine,
  miningSpeed,
  pickaxeForReferrals,
  releaseIfAbandoned,
  rewardForGridId,
  settleMine,
  TOTAL_MINE_COUNT,
  WINNING_GRID_COUNT,
} from './mining.ts';

test('level and referral bonuses follow the confirmed balance table', () => {
  assert.equal(miningSpeed(0, pickaxeForReferrals(0)), 1);
  assert.equal(miningSpeed(0, pickaxeForReferrals(1)), 1.1);
  assert.equal(miningSpeed(0, pickaxeForReferrals(5)), 1.5);
  assert.equal(miningSpeed(1, pickaxeForReferrals(0)), 1.1);
  assert.equal(miningSpeed(10, pickaxeForReferrals(0)), 2);
  assert.equal(miningSpeed(10, pickaxeForReferrals(10)), 3);
});

test('coordinates resolve to 100m grid ids', () => {
  assert.equal(gridIdFromCoordinate(37.5665, 126.978), gridIdFromCoordinate(37.5665, 126.978));
  assert.equal(gridIdFromCoordinate(37.5665, 126.978), gridIdFromCoordinate(37.56652, 126.978));
  assert.notEqual(gridIdFromCoordinate(37.5665, 126.978), gridIdFromCoordinate(37.568, 126.978));
});

test('the finite global grid contains exactly every declared mine', () => {
  assert.equal(GRID_COLUMN_COUNT * GRID_ROW_COUNT, TOTAL_MINE_COUNT);
  assert.equal(gridIndexFromId('G-0-0'), 0);
  assert.equal(gridIndexFromId(`G-${GRID_COLUMN_COUNT - 1}-${GRID_ROW_COUNT - 1}`), TOTAL_MINE_COUNT - 1);
  const northEast = gridCenterFromId(`G-${GRID_COLUMN_COUNT - 1}-${GRID_ROW_COUNT - 1}`);
  assert.equal(gridIdFromCoordinate(northEast.latitude, northEast.longitude), `G-${GRID_COLUMN_COUNT - 1}-${GRID_ROW_COUNT - 1}`);
});

test('reward allocation reserves exact, non-overlapping rank ranges', () => {
  assert.equal(WINNING_GRID_COUNT, 888);
  assert.equal(GENERAL_REWARD_GRID_COUNT, 100_000_000);
  assert.ok(WINNING_GRID_COUNT + GENERAL_REWARD_GRID_COUNT < TOTAL_MINE_COUNT);
  assert.ok(['psl', 'general', 'empty'].includes(rewardForGridId('G-0-0')));
});

test('a level 10 solo miner reaches 48m of the 72m target in one activation', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  const mine = activateWithAd(createGrid(37.5, 127), 'miner-a', start);
  const completed = settleMine(mine, 2, new Date('2026-01-02T00:00:00.000Z'));
  assert.equal(completed.depthMeters, 48);
  assert.equal(completed.completed, false);
});

test('voluntary exit preserves depth for the next miner', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  const mine = activateWithAd(createGrid(37.5, 127), 'miner-a', start);
  const released = leaveMine(mine, 1, new Date('2026-01-01T05:00:00.000Z'));
  assert.equal(released.depthMeters, 5);
  assert.equal(released.ownerId, null);

  const resumed = activateWithAd(released, 'miner-b', new Date('2026-01-01T06:00:00.000Z'));
  const progressed = settleMine(resumed, 1, new Date('2026-01-01T07:00:00.000Z'));
  assert.equal(progressed.depthMeters, 6);
});

test('abandonment releases after active 24 hours plus 7 days without erasing depth', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  const mine = activateWithAd(createGrid(37.5, 127), 'miner-a', start);
  const beforeDeadline = releaseIfAbandoned(mine, 1, new Date('2026-01-08T23:59:59.000Z'));
  assert.equal(beforeDeadline.ownerId, 'miner-a');
  const released = releaseIfAbandoned(mine, 1, new Date('2026-01-09T00:00:00.000Z'));
  assert.equal(released.ownerId, null);
  assert.equal(released.depthMeters, 24);
});
