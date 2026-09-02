import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ANCHOVY_GRID_COUNT,
  ANCHOVY_REWARD_PER_GRID,
  abandonInactiveMine,
  activateWithAd,
  createGrid,
  GRID_COLUMN_COUNT,
  GRID_ROW_COUNT,
  gridCenterFromId,
  gridIndexFromId,
  gridIdFromCoordinate,
  gridIdForRewardRank,
  leaveMine,
  KING_WHALE_GRID_COUNT,
  miningSpeed,
  PICKAXE_NAMES,
  pickaxeForReferrals,
  rewardForGridId,
  referralSpeedBonus,
  settleMine,
  SHRIMP_GRID_COUNT,
  TEST_MINING_SPEED,
  TOTAL_MINE_COUNT,
  TOTAL_PSL_RESERVES,
  TOTAL_REWARD_GRID_COUNT,
  WHALE_GRID_COUNT,
} from './mining.ts';

test('normal and test miners use their respective speed rules', () => {
  assert.equal(PICKAXE_NAMES[pickaxeForReferrals(0)], '숟가락');
  assert.equal(TEST_MINING_SPEED, 51_840);
  assert.equal(miningSpeed(0, pickaxeForReferrals(0)), 1);
  assert.equal(miningSpeed(10, pickaxeForReferrals(10)), 7);
  assert.equal(miningSpeed(25, pickaxeForReferrals(10)), 8.5);
  assert.equal(referralSpeedBonus(1), 0.5);
  assert.equal(referralSpeedBonus(10), 5);
  assert.equal(referralSpeedBonus(11), 5);
  assert.equal(miningSpeed(0, pickaxeForReferrals(0), true), 51_840);
  assert.equal(miningSpeed(10, pickaxeForReferrals(10), true), 51_840);
});

test('the fixed test speed completes a 72m mine in five seconds', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  const mine = activateWithAd(createGrid(37.5, 127), 'miner-a', start);
  const speed = miningSpeed(0, pickaxeForReferrals(0), true);
  const beforeCompletion = settleMine(mine, speed, new Date(start.getTime() + 4_999));
  const completed = settleMine(mine, speed, new Date(start.getTime() + 5_000));
  assert.equal(beforeCompletion.completed, false);
  assert.equal(completed.depthMeters, 72);
  assert.equal(completed.completed, true);
});

test('coordinates resolve to 100m grid ids', () => {
  assert.equal(gridIdFromCoordinate(37.5665, 126.978), gridIdFromCoordinate(37.5665, 126.978));
  assert.equal(gridIdFromCoordinate(37.5665, 126.978), gridIdFromCoordinate(37.56652, 126.978));
  assert.notEqual(gridIdFromCoordinate(37.5665, 126.978), gridIdFromCoordinate(37.5865, 126.978));
});

test('the finite global grid contains exactly every declared mine', () => {
  assert.equal(TOTAL_MINE_COUNT, 100_000_000);
  assert.equal(GRID_COLUMN_COUNT * GRID_ROW_COUNT, TOTAL_MINE_COUNT);
  assert.equal(gridIndexFromId('G-0-0'), 0);
  assert.equal(gridIndexFromId(`G-${GRID_COLUMN_COUNT - 1}-${GRID_ROW_COUNT - 1}`), TOTAL_MINE_COUNT - 1);
  const northEast = gridCenterFromId(`G-${GRID_COLUMN_COUNT - 1}-${GRID_ROW_COUNT - 1}`);
  assert.equal(gridIdFromCoordinate(northEast.latitude, northEast.longitude), `G-${GRID_COLUMN_COUNT - 1}-${GRID_ROW_COUNT - 1}`);
});

test('reward allocation reserves exact, non-overlapping rank ranges', () => {
  assert.equal(KING_WHALE_GRID_COUNT, 1);
  assert.equal(WHALE_GRID_COUNT, 888);
  assert.equal(SHRIMP_GRID_COUNT, 11_111_111);
  assert.equal(TOTAL_REWARD_GRID_COUNT, 11_112_000);
  assert.equal(ANCHOVY_GRID_COUNT, 88_888_000);
  assert.equal(ANCHOVY_REWARD_PER_GRID, 1);
  assert.equal(TOTAL_REWARD_GRID_COUNT + ANCHOVY_GRID_COUNT, TOTAL_MINE_COUNT);
  assert.equal(TOTAL_PSL_RESERVES, 89_777_776_888);
  assert.ok(TOTAL_REWARD_GRID_COUNT < TOTAL_MINE_COUNT);
  assert.ok(['kingWhale', 'whale', 'shrimp', 'anchovy'].includes(rewardForGridId('G-0-0')));
  assert.equal(rewardForGridId(gridIdForRewardRank(0)), 'kingWhale');
  assert.equal(rewardForGridId(gridIdForRewardRank(KING_WHALE_GRID_COUNT)), 'whale');
  assert.equal(rewardForGridId(gridIdForRewardRank(KING_WHALE_GRID_COUNT + WHALE_GRID_COUNT)), 'shrimp');
  assert.equal(rewardForGridId(gridIdForRewardRank(TOTAL_REWARD_GRID_COUNT)), 'anchovy');
  const sampledIds = Array.from({ length: 2_000 }, (_, rank) => gridIdForRewardRank(rank));
  assert.equal(new Set(sampledIds).size, sampledIds.length);
});

test('a level 10 solo miner reaches 48m of the 72m target in one activation', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  const mine = activateWithAd(createGrid(37.5, 127), 'miner-a', start);
  const completed = settleMine(mine, 2, new Date('2026-01-02T00:00:00.000Z'));
  assert.equal(completed.depthMeters, 48);
  assert.equal(completed.completed, false);
});

test('a base-speed miner completes one grid after three 24-hour rewarded-ad sessions', () => {
  const firstStart = new Date('2026-01-01T00:00:00.000Z');
  const afterFirst = settleMine(
    activateWithAd(createGrid(37.5, 127), 'miner-a', firstStart),
    1,
    new Date('2026-01-02T00:00:00.000Z'),
  );
  assert.equal(afterFirst.depthMeters, 24);
  assert.equal(afterFirst.completed, false);

  const secondStart = new Date('2026-01-02T01:00:00.000Z');
  const afterSecond = settleMine(
    activateWithAd(afterFirst, 'miner-a', secondStart),
    1,
    new Date('2026-01-03T01:00:00.000Z'),
  );
  assert.equal(afterSecond.depthMeters, 48);
  assert.equal(afterSecond.completed, false);

  const thirdStart = new Date('2026-01-03T02:00:00.000Z');
  const completed = settleMine(
    activateWithAd(afterSecond, 'miner-a', thirdStart),
    1,
    new Date('2026-01-04T02:00:00.000Z'),
  );
  assert.equal(completed.depthMeters, 72);
  assert.equal(completed.completed, true);
});

test('a miner cannot leave before reaching the full 72m depth', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  const mine = activateWithAd(createGrid(37.5, 127), 'miner-a', start);
  assert.throws(
    () => leaveMine(mine, 1, new Date('2026-01-01T05:00:00.000Z')),
    /72m 채굴을 완료하기 전/,
  );
});

test('a completed 72m mine can be released', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  const mine = activateWithAd(createGrid(37.5, 127), 'miner-a', start);
  const released = leaveMine(mine, 3, new Date('2026-01-02T00:00:00.000Z'));
  assert.equal(released.ownerId, null);
  assert.equal(released.depthMeters, 72);
  assert.equal(released.completed, true);
});

test('an incomplete mine is reset and released after seven days without activity', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  const active = activateWithAd(createGrid(37.5, 127), 'miner-a', start);
  const progressed = settleMine(active, 1, new Date('2026-01-02T00:00:00.000Z'));
  assert.equal(abandonInactiveMine(progressed, new Date('2026-01-07T23:59:59.999Z')), progressed);
  const reset = abandonInactiveMine(progressed, new Date('2026-01-08T00:00:00.000Z'));
  assert.equal(reset.ownerId, null);
  assert.equal(reset.depthMeters, 0);
  assert.equal(reset.lastCalculatedAt, null);
  assert.equal(reset.completed, false);
});
