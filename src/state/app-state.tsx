import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  abandonInactiveMine,
  activateWithAd,
  createGrid,
  GridMine,
  gridCenterFromId,
  MINE_DEPTH_METERS,
  miningSpeed,
  pickaxeForReferrals,
  rewardAmount,
  rewardForGridId,
  settleMine,
} from '@/domain/mining';

type User = {
  id: string;
  name: string;
  provider: 'google' | 'apple' | 'pi';
  piVerified: boolean;
  level: number;
  referrals: number;
  pslBalance: number;
  walletAddress: string;
  completedMines: number;
  testMiner: boolean;
  lastCompletedMineId: string | null;
  lastRewardAmount: number | null;
};

type State = {
  user: User | null;
  selectedGrid: GridMine;
  mines: Record<string, GridMine>;
  abandonmentNotice: boolean;
};

type AppContextValue = {
  state: State;
  hydrated: boolean;
  currentMine: GridMine | null;
  login: (provider: User['provider']) => void;
  logout: () => void;
  selectGrid: (latitude: number, longitude: number) => void;
  startMining: (latitude?: number, longitude?: number) => void;
  watchAd: () => void;
  syncProgress: () => void;
  setWallet: (address: string) => void;
  setTestMiner: (enabled: boolean) => void;
  withdrawAll: () => Promise<void>;
  clearAbandonmentNotice: () => void;
};

const STORAGE_KEY = 'psl-mining-mvp-state-v1';
const initialGrid = createGrid(37.5665, 126.978);
const demoCompletedMines = Object.fromEntries(Array.from({ length: 20 }, (_, index) => {
  const id = `G-${10293 + index % 5}-${4693 + Math.floor(index / 5)}`;
  const center = gridCenterFromId(id);
  const mine: GridMine = {
    id,
    ...center,
    depthMeters: MINE_DEPTH_METERS,
    ownerId: null,
    ownerName: `테스트 광부 ${index + 1}`,
    miningSpeed: 1 + index % 5 * 0.5,
    activeUntil: null,
    abandonmentAt: null,
    lastCalculatedAt: '2026-09-01T00:00:00.000Z',
    completed: true,
    reward: 'anchovy',
  };
  return [id, mine];
}));
const initialState: State = { user: null, selectedGrid: initialGrid, mines: demoCompletedMines, abandonmentNotice: false };
const AppContext = createContext<AppContextValue | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<State>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!value) return;
        const stored = JSON.parse(value) as State;
        const migrateMine = (mine: GridMine) => {
          const canonical = createGrid(mine.latitude, mine.longitude);
          return { ...mine, id: canonical.id, latitude: canonical.latitude, longitude: canonical.longitude, ownerName: mine.ownerName ?? null, miningSpeed: mine.miningSpeed ?? null };
        };
        const mines = Object.fromEntries(Object.values(stored.mines ?? {}).map((mine) => {
          const migrated = migrateMine(mine);
          return [migrated.id, migrated];
        }));
        setState({ ...stored, abandonmentNotice: false, user: stored.user ? { ...stored.user, testMiner: stored.user.testMiner ?? false, lastCompletedMineId: stored.user.lastCompletedMineId ?? null, lastRewardAmount: stored.user.lastRewardAmount ?? null } : null, selectedGrid: migrateMine(stored.selectedGrid), mines: { ...mines, ...demoCompletedMines } });
      })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const currentMine = useMemo(() => {
    if (!state.user) return null;
    return Object.values(state.mines).find((mine) => mine.ownerId === state.user?.id) ?? null;
  }, [state.mines, state.user]);

  const speed = state.user ? miningSpeed(state.user.level, pickaxeForReferrals(state.user.referrals), state.user.testMiner) : 1;

  function login(provider: User['provider']) {
    setState((previous) => ({
      ...previous,
      user: {
        id: provider === 'pi' ? 'pi-demo-uid' : `${provider}-demo-uid`,
        name: provider === 'pi' ? 'Pioneer 888' : '새로운 광부',
        provider,
        piVerified: provider === 'pi',
        level: 0,
        referrals: 0,
        pslBalance: 0,
        walletAddress: '',
        completedMines: 0,
        testMiner: false,
        lastCompletedMineId: null,
        lastRewardAmount: null,
      },
    }));
    router.replace('/(tabs)/map');
  }

  function logout() {
    setState(initialState);
    router.replace('/');
  }

  function selectGrid(latitude: number, longitude: number) {
    const grid = createGrid(latitude, longitude);
    setState((previous) => ({ ...previous, selectedGrid: previous.mines[grid.id] ?? grid }));
  }

  function startMining(latitude?: number, longitude?: number) {
    if (!state.user) return;
    const requested = latitude !== undefined && longitude !== undefined
      ? createGrid(latitude, longitude)
      : state.selectedGrid;
    const stored = state.mines[requested.id] ?? requested;
    const activeMine = Object.values(state.mines).find((mine) => mine.ownerId === state.user?.id && !mine.completed);
    if (activeMine && activeMine.id !== stored.id) throw new Error(`현재 막장 ${activeMine.id}를 72m까지 완료해야 다른 Grid에서 채굴할 수 있습니다.`);
    if (stored.ownerId && stored.ownerId !== state.user.id) throw new Error('다른 광부가 채굴 중인 막장입니다.');
    if (stored.completed) throw new Error('이미 채굴 완료된 막장입니다.');

    const next = activateWithAd({
      ...stored,
      ownerId: state.user.id,
      ownerName: state.user.name,
      miningSpeed: speed,
      abandonmentAt: null,
    }, state.user.id);
    setState((previous) => {
      const mines = { ...previous.mines };
      mines[next.id] = next;
      return { ...previous, selectedGrid: next, mines, user: previous.user ? { ...previous.user, lastCompletedMineId: null, lastRewardAmount: null } : null };
    });
    router.push('/(tabs)/mine');
  }

  function watchAd() {
    if (!state.user) return;
    const mine = currentMine ?? state.selectedGrid;
    const settled = settleMine(mine, speed);
    const next = activateWithAd(settled, state.user.id);
    setState((previous) => ({ ...previous, selectedGrid: next, mines: { ...previous.mines, [next.id]: next } }));
  }

  const syncProgress = useCallback(() => {
    setState((previous) => {
      if (!previous.user) return previous;

      const mine = Object.values(previous.mines).find((candidate) => candidate.ownerId === previous.user?.id);
      if (!mine || mine.completed) return previous;

      const abandonedMine = abandonInactiveMine(mine);
      if (abandonedMine !== mine) {
        return {
          ...previous,
          abandonmentNotice: true,
          selectedGrid: abandonedMine,
          mines: { ...previous.mines, [abandonedMine.id]: abandonedMine },
        };
      }

      const currentSpeed = miningSpeed(
        previous.user.level,
        pickaxeForReferrals(previous.user.referrals),
        previous.user.testMiner,
      );
      const next = settleMine(mine, currentSpeed);
      const newlyCompleted = !mine.completed && next.completed;
      const completedMine = newlyCompleted
        ? { ...next, reward: rewardForGridId(next.id), ownerId: null, activeUntil: null, abandonmentAt: null }
        : next;

      if (!newlyCompleted && completedMine === mine) return previous;

      const earnedReward = newlyCompleted ? rewardAmount(completedMine.reward) : 0;
      return {
        ...previous,
        selectedGrid: completedMine,
        mines: { ...previous.mines, [completedMine.id]: completedMine },
        user: newlyCompleted ? {
          ...previous.user,
          level: Math.min(10, previous.user.level + 1),
          completedMines: previous.user.completedMines + 1,
          pslBalance: previous.user.pslBalance + earnedReward,
          lastCompletedMineId: completedMine.id,
          lastRewardAmount: earnedReward,
        } : previous.user,
      };
    });
  }, []);

  function setWallet(walletAddress: string) {
    setState((previous) => previous.user ? { ...previous, user: { ...previous.user, walletAddress } } : previous);
  }

  function setTestMiner(testMiner: boolean) {
    setState((previous) => previous.user ? { ...previous, user: { ...previous.user, testMiner } } : previous);
  }

  async function withdrawAll() {
    if (!state.user?.walletAddress || state.user.pslBalance <= 0) throw new Error('출금 가능한 잔액 또는 지갑 주소가 없습니다.');
    throw new Error('PSL_Wallet 서명 연동은 백엔드 및 지갑 딥링크 설정 후 활성화됩니다.');
  }

  function clearAbandonmentNotice() {
    setState((previous) => ({ ...previous, abandonmentNotice: false }));
  }

  return (
    <AppContext.Provider value={{ state, hydrated, currentMine, login, logout, selectGrid, startMining, watchAd, syncProgress, setWallet, setTestMiner, withdrawAll, clearAbandonmentNotice }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useAppState must be used inside AppStateProvider');
  return value;
}
