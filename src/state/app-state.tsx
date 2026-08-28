import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import {
  activateWithAd,
  createGrid,
  GENERAL_REWARD_PER_GRID,
  GridMine,
  leaveMine,
  miningSpeed,
  pickaxeForReferrals,
  PSL_PER_WINNING_GRID,
  releaseIfAbandoned,
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
};

type State = {
  user: User | null;
  selectedGrid: GridMine;
  mines: Record<string, GridMine>;
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
  leave: () => void;
  setWallet: (address: string) => void;
  withdrawAll: () => Promise<void>;
};

const STORAGE_KEY = 'psl-mining-mvp-state-v1';
const initialGrid = createGrid(37.5665, 126.978);
const initialState: State = { user: null, selectedGrid: initialGrid, mines: {} };
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
          return { ...mine, id: canonical.id, latitude: canonical.latitude, longitude: canonical.longitude, ownerName: mine.ownerName ?? null };
        };
        const mines = Object.fromEntries(Object.values(stored.mines ?? {}).map((mine) => {
          const migrated = migrateMine(mine);
          return [migrated.id, migrated];
        }));
        setState({ ...stored, selectedGrid: migrateMine(stored.selectedGrid), mines });
      })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  useEffect(() => {
    if (!hydrated) return;
    const releaseStaleMines = () => {
      setState((previous) => {
        if (!previous.user) return previous;
        const currentSpeed = miningSpeed(previous.user.level, pickaxeForReferrals(previous.user.referrals));
        let changed = false;
        const mines = Object.fromEntries(Object.entries(previous.mines).map(([id, mine]) => {
          const released = releaseIfAbandoned(mine, currentSpeed);
          if (released !== mine) changed = true;
          return [id, released];
        }));
        return changed ? { ...previous, mines } : previous;
      });
    };
    releaseStaleMines();
    const timer = setInterval(releaseStaleMines, 60_000);
    return () => clearInterval(timer);
  }, [hydrated]);

  const currentMine = useMemo(() => {
    if (!state.user) return null;
    return Object.values(state.mines).find((mine) => mine.ownerId === state.user?.id) ?? null;
  }, [state.mines, state.user]);

  const speed = state.user ? miningSpeed(state.user.level, pickaxeForReferrals(state.user.referrals)) : 1;

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
    if (stored.ownerId && stored.ownerId !== state.user.id) throw new Error('다른 광부가 채굴 중인 막장입니다.');
    if (stored.completed) throw new Error('이미 채굴 완료된 막장입니다.');

    const now = new Date();
    const next = {
      ...stored,
      ownerId: state.user.id,
      ownerName: state.user.name,
      abandonmentAt: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
    };
    setState((previous) => {
      const mines = { ...previous.mines };
      const activeMine = Object.values(mines).find((mine) => mine.ownerId === previous.user?.id);
      if (activeMine && activeMine.id !== next.id) {
        const settled = leaveMine(activeMine, speed, now);
        mines[settled.id] = settled;
      }
      mines[next.id] = next;
      return { ...previous, selectedGrid: next, mines };
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

  function syncProgress() {
    if (!currentMine || !state.user) return;
    const next = settleMine(currentMine, speed);
    const newlyCompleted = !currentMine.completed && next.completed;
    const completedMine = newlyCompleted
      ? { ...next, reward: rewardForGridId(next.id), ownerId: null, activeUntil: null, abandonmentAt: null }
      : next;
    setState((previous) => ({
      ...previous,
      selectedGrid: completedMine,
      mines: { ...previous.mines, [completedMine.id]: completedMine },
      user: previous.user && newlyCompleted ? {
        ...previous.user,
        level: Math.min(10, previous.user.level + 1),
        completedMines: previous.user.completedMines + 1,
        pslBalance: previous.user.pslBalance + (completedMine.reward === 'psl' ? PSL_PER_WINNING_GRID : completedMine.reward === 'general' ? GENERAL_REWARD_PER_GRID : 0),
      } : previous.user,
    }));
  }

  function leave() {
    if (!currentMine) return;
    const next = leaveMine(currentMine, speed);
    setState((previous) => ({ ...previous, selectedGrid: next, mines: { ...previous.mines, [next.id]: next } }));
    router.push('/(tabs)/map');
  }

  function setWallet(walletAddress: string) {
    setState((previous) => previous.user ? { ...previous, user: { ...previous.user, walletAddress } } : previous);
  }

  async function withdrawAll() {
    if (!state.user?.walletAddress || state.user.pslBalance <= 0) throw new Error('출금 가능한 잔액 또는 지갑 주소가 없습니다.');
    throw new Error('PSL_Wallet 서명 연동은 백엔드 및 지갑 딥링크 설정 후 활성화됩니다.');
  }

  return (
    <AppContext.Provider value={{ state, hydrated, currentMine, login, logout, selectGrid, startMining, watchAd, syncProgress, leave, setWallet, withdrawAll }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useAppState must be used inside AppStateProvider');
  return value;
}
