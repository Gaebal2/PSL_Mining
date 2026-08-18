export const MINE_DEPTH_METERS = 48;
export const AD_ACTIVE_HOURS = 24;
export const ABANDONMENT_DAYS = 7;
export const PSL_PER_WINNING_GRID = 100_000_000;
export const WINNING_GRID_COUNT = 888;

export type Pickaxe = 'iron' | 'bronze' | 'silver' | 'gold' | 'diamond';

export type GridMine = {
  id: string;
  latitude: number;
  longitude: number;
  depthMeters: number;
  ownerId: string | null;
  activeUntil: string | null;
  abandonmentAt: string | null;
  lastCalculatedAt: string | null;
  completed: boolean;
  reward: 'hidden' | 'empty' | 'psl';
};

const PICKAXE_BONUS: Record<Pickaxe, number> = {
  iron: 0,
  bronze: 0.2,
  silver: 0.3,
  gold: 0.5,
  diamond: 1,
};

export function levelSpeed(level: number) {
  return 1 + Math.min(10, Math.max(0, level)) * 0.1;
}

export function miningSpeed(level: number, pickaxe: Pickaxe) {
  return levelSpeed(level) + PICKAXE_BONUS[pickaxe];
}

export function pickaxeForReferrals(referrals: number): Pickaxe {
  if (referrals >= 10) return 'diamond';
  if (referrals >= 5) return 'gold';
  if (referrals >= 3) return 'silver';
  if (referrals >= 1) return 'bronze';
  return 'iron';
}

export function gridIdFromCoordinate(latitude: number, longitude: number) {
  const clampedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const radius = 6378137;
  const x = radius * longitude * Math.PI / 180;
  const y = radius * Math.log(Math.tan(Math.PI / 4 + clampedLatitude * Math.PI / 360));
  return `G-${Math.floor(x)}-${Math.floor(y)}`;
}

export function createGrid(latitude: number, longitude: number): GridMine {
  return {
    id: gridIdFromCoordinate(latitude, longitude),
    latitude,
    longitude,
    depthMeters: 0,
    ownerId: null,
    activeUntil: null,
    abandonmentAt: null,
    lastCalculatedAt: null,
    completed: false,
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
  const abandonmentAt = new Date(activeUntil.getTime() + ABANDONMENT_DAYS * 86_400_000);
  return {
    ...mine,
    ownerId: userId,
    activeUntil: activeUntil.toISOString(),
    abandonmentAt: abandonmentAt.toISOString(),
    lastCalculatedAt: now.toISOString(),
  };
}

export function leaveMine(mine: GridMine, speed: number, now = new Date()): GridMine {
  const settled = settleMine(mine, speed, now);
  return { ...settled, ownerId: null, activeUntil: null, abandonmentAt: null, lastCalculatedAt: null };
}

export function releaseIfAbandoned(mine: GridMine, speed: number, now = new Date()): GridMine {
  if (!mine.abandonmentAt || now.getTime() < new Date(mine.abandonmentAt).getTime()) return mine;
  return leaveMine(mine, speed, now);
}

export function remainingTimeLabel(mine: GridMine, now = new Date()) {
  if (!mine.activeUntil) return '광고 시청 필요';
  const milliseconds = new Date(mine.activeUntil).getTime() - now.getTime();
  if (milliseconds <= 0) return '일시정지됨';
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor(milliseconds % 3_600_000 / 60_000);
  return `${hours}시간 ${minutes}분 활성`;
}
