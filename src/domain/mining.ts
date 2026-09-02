export const GRID_SIZE_METERS = 100;
export const MINE_DEPTH_METERS = 72;
export const BASE_MINING_SPEED = 1;
export const TEST_MINING_SPEED = MINE_DEPTH_METERS * 3_600 / 5;
export const AD_ACTIVE_HOURS = 24;
export const MINE_INACTIVITY_DAYS = 7;
export const KING_WHALE_REWARD_PER_GRID = 800_000_000;
export const KING_WHALE_GRID_COUNT = 1;
export const WHALE_REWARD_PER_GRID = 100_000_000;
export const WHALE_GRID_COUNT = 888;
export const SHRIMP_REWARD_PER_GRID = 8;
export const SHRIMP_GRID_COUNT = 11_111_111;
export const TOTAL_REWARD_GRID_COUNT = KING_WHALE_GRID_COUNT + WHALE_GRID_COUNT + SHRIMP_GRID_COUNT;
export const TOTAL_MINE_COUNT = 100_000_000;
export const ANCHOVY_REWARD_PER_GRID = 1;
export const ANCHOVY_GRID_COUNT = TOTAL_MINE_COUNT - TOTAL_REWARD_GRID_COUNT;
export const TOTAL_PSL_RESERVES = KING_WHALE_REWARD_PER_GRID * KING_WHALE_GRID_COUNT
  + WHALE_REWARD_PER_GRID * WHALE_GRID_COUNT
  + SHRIMP_REWARD_PER_GRID * SHRIMP_GRID_COUNT
  + ANCHOVY_REWARD_PER_GRID * ANCHOVY_GRID_COUNT;
export const GRID_COLUMN_COUNT = 12_500;
export const GRID_ROW_COUNT = 8_000;

const FEISTEL_HALF_BITS = 14n;
const FEISTEL_MASK = (1n << FEISTEL_HALF_BITS) - 1n;
const REWARD_ROUND_KEYS = [0x12F3Dn, 0x0A7C9n, 0x1D5B1n, 0x06E83n, 0x19347n, 0x0C2FDn];

function rewardRound(value: bigint, key: bigint) {
  let mixed = (value ^ key) * 0x1E35An + 0x0B79Fn;
  mixed ^= mixed >> 7n;
  mixed *= 0x15A4Dn;
  mixed ^= mixed >> 9n;
  return mixed & FEISTEL_MASK;
}

function permuteRewardIndex(value: bigint) {
  let left = (value >> FEISTEL_HALF_BITS) & FEISTEL_MASK;
  let right = value & FEISTEL_MASK;
  for (const key of REWARD_ROUND_KEYS) {
    [left, right] = [right, left ^ rewardRound(right, key)];
  }
  return (left << FEISTEL_HALF_BITS) | right;
}

function invertRewardIndex(value: bigint) {
  let left = (value >> FEISTEL_HALF_BITS) & FEISTEL_MASK;
  let right = value & FEISTEL_MASK;
  for (let index = REWARD_ROUND_KEYS.length - 1; index >= 0; index -= 1) {
    const previousRight = left;
    const previousLeft = right ^ rewardRound(previousRight, REWARD_ROUND_KEYS[index]);
    [left, right] = [previousLeft, previousRight];
  }
  return (left << FEISTEL_HALF_BITS) | right;
}

function rewardRank(index: bigint) {
  let rank = index;
  do rank = permuteRewardIndex(rank); while (rank >= BigInt(TOTAL_MINE_COUNT));
  return rank;
}

function rewardIndexForRank(rank: bigint) {
  let index = rank;
  do index = invertRewardIndex(index); while (index >= BigInt(TOTAL_MINE_COUNT));
  return index;
}

export type Pickaxe = 'bareHands' | 'iron' | 'steel' | 'titanium' | 'tungstenCarbide' | 'diamond' | 'rhodium' | 'graphite' | 'carbyne' | 'neutronium' | 'nuclearPasta';
export type RewardType = 'hidden' | 'empty' | 'kingWhale' | 'whale' | 'shrimp' | 'anchovy';

export type GridMine = {
  id: string;
  latitude: number;
  longitude: number;
  depthMeters: number;
  ownerId: string | null;
  ownerName: string | null;
  miningSpeed: number | null;
  activeUntil: string | null;
  abandonmentAt: string | null;
  lastCalculatedAt: string | null;
  completed: boolean;
  completedByUserId?: string | null;
  reward: RewardType;
};

const PICKAXE_BONUS: Record<Pickaxe, number> = {
  bareHands: 0, iron: 0.5, steel: 1, titanium: 1.5, tungstenCarbide: 2,
  diamond: 2.5, rhodium: 3, graphite: 3.5, carbyne: 4, neutronium: 4.5, nuclearPasta: 5,
};

export const PICKAXE_NAMES: Record<Pickaxe, string> = {
  bareHands: '숟가락', iron: '철', steel: '강철', titanium: '티타늄', tungstenCarbide: '텅스텐 카바이드',
  diamond: '다이아몬드', rhodium: '로스트레이트', graphite: '그래핀', carbyne: '카르빈', neutronium: '뉴트로늄', nuclearPasta: '뉴클리어 파스타',
};

export function levelSpeed(level: number) {
  return BASE_MINING_SPEED + Math.max(0, level) * 0.1;
}

export function miningSpeed(level: number, pickaxe: Pickaxe, testMiner = false) {
  return testMiner ? TEST_MINING_SPEED : levelSpeed(level) + PICKAXE_BONUS[pickaxe];
}

export function referralSpeedBonus(referrals: number) {
  return Math.min(10, Math.max(0, referrals)) * 0.5;
}

export function pickaxeForReferrals(referrals: number): Pickaxe {
  return (['bareHands', 'iron', 'steel', 'titanium', 'tungstenCarbide', 'diamond', 'rhodium', 'graphite', 'carbyne', 'neutronium', 'nuclearPasta'] as const)[Math.min(10, Math.max(0, Math.floor(referrals)))];
}

export function gridIdFromCoordinate(latitude: number, longitude: number) {
  const clampedLatitude = Math.max(-90, Math.min(90, latitude));
  const wrappedLongitude = ((longitude + 180) % 360 + 360) % 360 - 180;
  const column = Math.min(GRID_COLUMN_COUNT - 1, Math.floor((wrappedLongitude + 180) / 360 * GRID_COLUMN_COUNT));
  const row = Math.min(GRID_ROW_COUNT - 1, Math.floor((Math.sin(clampedLatitude * Math.PI / 180) + 1) / 2 * GRID_ROW_COUNT));
  return `G-${column}-${row}`;
}

export function gridCenterFromId(id: string) {
  const match = /^G-(\d+)-(\d+)$/.exec(id);
  if (!match) throw new Error('올바르지 않은 막장 ID입니다.');
  const column = Number(match[1]);
  const row = Number(match[2]);
  if (column >= GRID_COLUMN_COUNT || row >= GRID_ROW_COUNT) throw new Error('막장 범위를 벗어난 ID입니다.');
  return {
    latitude: Math.asin((row + 0.5) / GRID_ROW_COUNT * 2 - 1) * 180 / Math.PI,
    longitude: (column + 0.5) / GRID_COLUMN_COUNT * 360 - 180,
  };
}

export function gridIndexFromId(id: string) {
  const match = /^G-(\d+)-(\d+)$/.exec(id);
  if (!match) throw new Error('올바르지 않은 막장 ID입니다.');
  const column = Number(match[1]);
  const row = Number(match[2]);
  if (column >= GRID_COLUMN_COUNT || row >= GRID_ROW_COUNT) throw new Error('막장 범위를 벗어난 ID입니다.');
  return row * GRID_COLUMN_COUNT + column;
}

export function rewardForGridId(id: string): 'kingWhale' | 'whale' | 'shrimp' | 'anchovy' {
  const index = BigInt(gridIndexFromId(id));
  const rank = rewardRank(index);
  if (rank < BigInt(KING_WHALE_GRID_COUNT)) return 'kingWhale';
  if (rank < BigInt(KING_WHALE_GRID_COUNT + WHALE_GRID_COUNT)) return 'whale';
  if (rank < BigInt(TOTAL_REWARD_GRID_COUNT)) return 'shrimp';
  return 'anchovy';
}

export function gridIdForRewardRank(rank: number) {
  if (!Number.isInteger(rank) || rank < 0 || rank >= TOTAL_MINE_COUNT) throw new Error('보상 순위 범위를 벗어났습니다.');
  const index = Number(rewardIndexForRank(BigInt(rank)));
  const row = Math.floor(index / GRID_COLUMN_COUNT);
  const column = index % GRID_COLUMN_COUNT;
  return `G-${column}-${row}`;
}

export function rewardAmount(reward: GridMine['reward']) {
  if (reward === 'kingWhale') return KING_WHALE_REWARD_PER_GRID;
  if (reward === 'whale') return WHALE_REWARD_PER_GRID;
  if (reward === 'shrimp') return SHRIMP_REWARD_PER_GRID;
  if (reward === 'anchovy') return ANCHOVY_REWARD_PER_GRID;
  return 0;
}

export function createGrid(latitude: number, longitude: number): GridMine {
  const id = gridIdFromCoordinate(latitude, longitude);
  const center = gridCenterFromId(id);
  return {
    id,
    ...center,
    depthMeters: 0,
    ownerId: null,
    ownerName: null,
    miningSpeed: null,
    activeUntil: null,
    abandonmentAt: null,
    lastCalculatedAt: null,
    completed: false,
    completedByUserId: null,
    reward: 'hidden',
  };
}

export function settleMine(mine: GridMine, speed: number, now = new Date()): GridMine {
  if (!mine.ownerId || !mine.lastCalculatedAt || !mine.activeUntil || mine.completed) return mine;
  const last = new Date(mine.lastCalculatedAt).getTime();
  const end = Math.min(now.getTime(), new Date(mine.activeUntil).getTime());
  if (end <= last) return mine;
  const mined = (end - last) / 3_600_000 * speed;
  const depthMeters = Math.min(MINE_DEPTH_METERS, mine.depthMeters + mined);
  return { ...mine, depthMeters, completed: depthMeters >= MINE_DEPTH_METERS, lastCalculatedAt: new Date(end).toISOString() };
}

export function activateWithAd(mine: GridMine, userId: string, now = new Date()): GridMine {
  if (mine.ownerId && mine.ownerId !== userId) throw new Error('다른 광부가 채굴 중인 막장입니다.');
  if (mine.completed) throw new Error('이미 채굴 완료된 막장입니다.');
  const activeUntil = new Date(now.getTime() + AD_ACTIVE_HOURS * 3_600_000);
  const abandonmentAt = new Date(now.getTime() + MINE_INACTIVITY_DAYS * 24 * 3_600_000);
  return {
    ...mine,
    ownerId: userId,
    activeUntil: activeUntil.toISOString(),
    abandonmentAt: abandonmentAt.toISOString(),
    lastCalculatedAt: now.toISOString(),
  };
}

export function abandonInactiveMine(mine: GridMine, now = new Date()): GridMine {
  if (mine.completed || !mine.ownerId || !mine.abandonmentAt || now.getTime() < new Date(mine.abandonmentAt).getTime()) return mine;
  return {
    ...mine,
    depthMeters: 0,
    ownerId: null,
    ownerName: null,
    miningSpeed: null,
    activeUntil: null,
    abandonmentAt: null,
    lastCalculatedAt: null,
    reward: 'hidden',
  };
}

export function resetMine(mine: GridMine): GridMine {
  return {
    ...mine,
    depthMeters: 0,
    ownerId: null,
    ownerName: null,
    miningSpeed: null,
    activeUntil: null,
    abandonmentAt: null,
    lastCalculatedAt: null,
    completed: false,
    completedByUserId: null,
    reward: 'hidden',
  };
}

export function leaveMine(mine: GridMine, speed: number, now = new Date()): GridMine {
  const settled = settleMine(mine, speed, now);
  if (!settled.completed) throw new Error('72m 채굴을 완료하기 전에는 막장에서 나갈 수 없습니다.');
  return { ...settled, ownerId: null, activeUntil: null, abandonmentAt: null, lastCalculatedAt: null };
}

export function remainingTimeLabel(mine: GridMine, now = new Date()) {
  if (!mine.activeUntil) return '광고 시청 필요';
  const milliseconds = new Date(mine.activeUntil).getTime() - now.getTime();
  if (milliseconds <= 0) return '일시정지됨';
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor(milliseconds % 3_600_000 / 60_000);
  return `${hours}시간 ${minutes}분 활성`;
}
