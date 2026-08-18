import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activateWithAd,
  createGrid,
  gridIdFromCoordinate,
  leaveMine,
  miningSpeed,
  pickaxeForReferrals,
  releaseIfAbandoned,
  settleMine,
} from './mining.ts';

test('level and referral bonuses follow the confirmed balance table', () => {
  assert.equal(miningSpeed(0, pickaxeForReferrals(0)), 1);
  assert.equal(miningSpeed(1, pickaxeForReferrals(0)), 1.1);
  assert.equal(miningSpeed(10, pickaxeForReferrals(0)), 2);
  assert.equal(miningSpeed(10, pickaxeForReferrals(10)), 3);
});

test('the same coordinate always resolves to the same 1m grid id', () => {
  assert.equal(gridIdFromCoordinate(37.5665, 126.978), gridIdFromCoordinate(37.5665, 126.978));
  assert.notEqual(gridIdFromCoordinate(37.5665, 126.978), gridIdFromCoordinate(37.56652, 126.978));
});

test('a level 10 solo miner completes 48m in one 24 hour activation', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  const mine = activateWithAd(createGrid(37.5, 127), 'miner-a', start);
  const completed = settleMine(mine, 2, new Date('2026-01-02T00:00:00.000Z'));
  assert.equal(completed.depthMeters, 48);
  assert.equal(completed.completed, true);
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
