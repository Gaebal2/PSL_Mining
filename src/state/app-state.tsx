import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import {
  activateWithAd,
  createGrid,
  GENERAL_REWARD_PER_GRID,
  GridMine,
  miningSpeed,
  pickaxeForReferrals,
  PSL_PER_WINNING_GRID,
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
          return { ...mine, id: canonical.id, latitude: canonical.latitude, longitude: canonical.longitude, ownerName: mine.ownerName ?? null, miningSpeed: mine.miningSpeed ?? null };
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

  function setWallet(walletAddress: string) {
    setState((previous) => previous.user ? { ...previous, user: { ...previous.user, walletAddress } } : previous);
  }

  async function withdrawAll() {
    if (!state.user?.walletAddress || state.user.pslBalance <= 0) throw new Error('출금 가능한 잔액 또는 지갑 주소가 없습니다.');
    throw new Error('PSL_Wallet 서명 연동은 백엔드 및 지갑 딥링크 설정 후 활성화됩니다.');
  }

  return (
    <AppContext.Provider value={{ state, hydrated, currentMine, login, logout, selectGrid, startMining, watchAd, syncProgress, setWallet, withdrawAll }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useAppState must be used inside AppStateProvider');
  return value;
}
