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
  resetMine,
  settleMine,
} from '@/domain/mining';
import { backendEnabled, leaveBackendMine, loadBackendSnapshot, registerLoginDevice, savePslWalletAddress, signInBackend, signOutBackend, startBackendMine, syncBackendMine } from '@/data/mining-backend';

type User = {
  id: string;
  name: string;
  provider: 'google' | 'apple' | 'pi';
  piVerified: boolean;
  level: number;
  referrals: number;
  pslBalance: number;
  walletAddress: string;
  pslWalletAddress: string;
  completedMines: number;
  testMiner: boolean;
  lastCompletedMineId: string | null;
  lastRewardAmount: number | null;
  invitedFriends: string[];
};

type State = {
  user: User | null;
  selectedGrid: GridMine;
  mines: Record<string, GridMine>;
  abandonmentNotice: boolean;
  concurrentLoginNotice: boolean;
};

type AppContextValue = {
  state: State;
  hydrated: boolean;
  currentMine: GridMine | null;
  login: (provider: User['provider']) => Promise<void>;
  logout: () => Promise<void>;
  selectGrid: (latitude: number, longitude: number) => void;
  startMining: (latitude?: number, longitude?: number) => Promise<void>;
  watchAd: () => Promise<void>;
  syncProgress: () => void;
  setWallet: (address: string) => void;
  setVerifiedWallet: (address: string) => void;
  setPslWallet: (address: string) => Promise<void>;
  setTestMiner: (enabled: boolean) => void;
  withdrawAll: () => Promise<void>;
  clearAbandonmentNotice: () => void;
  clearConcurrentLoginNotice: () => void;
  leaveCurrentMine: () => Promise<void>;
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
const initialState: State = { user: null, selectedGrid: initialGrid, mines: demoCompletedMines, abandonmentNotice: false, concurrentLoginNotice: false };
const AppContext = createContext<AppContextValue | null>(null);
let lastBackendSyncAt = 0;

function userFromRemote(profile: Awaited<ReturnType<typeof signInBackend>>, balance = 0): User | null {
  if (!profile) return null;
  return { id:profile.id, name:profile.display_name, provider:profile.auth_provider, piVerified:profile.pi_verified, level:profile.skill_level, referrals:0, pslBalance:balance, walletAddress:profile.wallet_address, pslWalletAddress:profile.psl_wallet_address ?? '', completedMines:profile.completed_mines, testMiner:false, lastCompletedMineId:null, lastRewardAmount:null, invitedFriends:[] };
}

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
          return { ...mine, id: canonical.id, latitude: canonical.latitude, longitude: canonical.longitude, ownerName: mine.ownerName ?? null, miningSpeed: mine.miningSpeed ?? null, completedByUserId: mine.completedByUserId ?? null };
        };
        const mines = Object.fromEntries(Object.values(stored.mines ?? {}).map((mine) => {
          const migrated = migrateMine(mine);
          return [migrated.id, migrated];
        }));
        setState({ ...stored, abandonmentNotice: false, concurrentLoginNotice: false, user: stored.user ? { ...stored.user, pslWalletAddress: stored.user.pslWalletAddress ?? '', testMiner: stored.user.testMiner ?? false, lastCompletedMineId: stored.user.lastCompletedMineId ?? null, lastRewardAmount: stored.user.lastRewardAmount ?? null, invitedFriends: stored.user.invitedFriends ?? [] } : null, selectedGrid: migrateMine(stored.selectedGrid), mines: { ...mines, ...demoCompletedMines } });
      })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  useEffect(() => {
    if (!hydrated || !backendEnabled) return;
    loadBackendSnapshot().then(async (initialSnapshot) => {
      if (!initialSnapshot) return { forcedExitGridId: null, snapshot: null };
      const forcedExitGridId = await registerLoginDevice();
      return { forcedExitGridId, snapshot: forcedExitGridId ? await loadBackendSnapshot() : initialSnapshot };
    }).then(({ forcedExitGridId, snapshot }) => {
      if (!snapshot) {
        setState(initialState);
        return;
      }
      setState((previous) => ({ ...previous, user:userFromRemote(snapshot.profile,snapshot.balance), mines:snapshot.mines, selectedGrid:snapshot.mines[previous.selectedGrid.id] ?? previous.selectedGrid, concurrentLoginNotice: Boolean(forcedExitGridId) }));
    }).catch(console.warn);
  }, [hydrated]);

  const currentMine = useMemo(() => {
    if (!state.user) return null;
    return Object.values(state.mines).find((mine) => mine.ownerId === state.user?.id) ?? null;
  }, [state.mines, state.user]);

  const speed = state.user ? miningSpeed(state.user.level, pickaxeForReferrals(state.user.referrals), state.user.testMiner) : 1;

  async function login(provider: User['provider']) {
    if (backendEnabled) {
      const profile = await signInBackend(provider);
      const forcedExitGridId = await registerLoginDevice();
      const snapshot = await loadBackendSnapshot();
      setState((previous) => ({ ...previous, user:userFromRemote(profile,snapshot?.balance), mines:snapshot?.mines ?? {}, selectedGrid:snapshot?.mines[previous.selectedGrid.id] ?? previous.selectedGrid, concurrentLoginNotice: Boolean(forcedExitGridId) }));
      router.replace('/(tabs)/map');
      return;
    }
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
        pslWalletAddress: '',
        completedMines: 0,
        testMiner: false,
        lastCompletedMineId: null,
        lastRewardAmount: null,
        invitedFriends: [],
      },
    }));
    router.replace('/(tabs)/map');
  }

  async function logout() {
    await signOutBackend();
    await AsyncStorage.removeItem(STORAGE_KEY);
    setState(initialState);
    router.replace('/');
  }

  function selectGrid(latitude: number, longitude: number) {
    const grid = createGrid(latitude, longitude);
    setState((previous) => ({ ...previous, selectedGrid: previous.mines[grid.id] ?? grid }));
  }

  async function startMining(latitude?: number, longitude?: number) {
    if (!state.user) return;
    if (!state.user.piVerified) throw new Error('Pi 지갑 소유권이 인증되어야 채굴이 가능합니다.');
    const requested = latitude !== undefined && longitude !== undefined
      ? createGrid(latitude, longitude)
      : state.selectedGrid;
    const stored = state.mines[requested.id] ?? requested;
    const activeMine = Object.values(state.mines).find((mine) => mine.ownerId === state.user?.id && !mine.completed);
    if (activeMine && activeMine.id !== stored.id) throw new Error(`현재 막장 ${activeMine.id}를 72m까지 완료해야 다른 Grid에서 채굴할 수 있습니다.`);
    if (stored.ownerId && stored.ownerId !== state.user.id) throw new Error('다른 광부가 채굴 중인 막장입니다.');
    if (stored.completed) throw new Error('이미 채굴 완료된 막장입니다.');

    const localNext = activateWithAd({
      ...stored,
      ownerId: state.user.id,
      ownerName: state.user.name,
      miningSpeed: speed,
      abandonmentAt: null,
    }, state.user.id);
    const next = await startBackendMine(stored, speed) ?? localNext;
    setState((previous) => {
      const mines = { ...previous.mines };
      mines[next.id] = next;
      return { ...previous, selectedGrid: next, mines, user: previous.user ? { ...previous.user, lastCompletedMineId: null, lastRewardAmount: null } : null };
    });
    router.push('/(tabs)/mine');
  }

  async function watchAd() {
    if (!state.user) return;
    const mine = currentMine ?? state.selectedGrid;
    const settled = settleMine(mine, speed);
    const localNext = activateWithAd(settled, state.user.id);
    // Reflect the new 24-hour session immediately. The server result then
    // reconciles the optimistic local state without leaving a stale ready UI
    // on screen while the request is in flight.
    setState((previous) => ({ ...previous, selectedGrid: localNext, mines: { ...previous.mines, [localNext.id]: localNext } }));
    try {
      const remoteNext = await startBackendMine(settled, speed);
      if (remoteNext) {
        setState((previous) => ({ ...previous, selectedGrid: remoteNext, mines: { ...previous.mines, [remoteNext.id]: remoteNext } }));
      }
    } catch (error) {
      setState((previous) => ({ ...previous, selectedGrid: settled, mines: { ...previous.mines, [settled.id]: settled } }));
      throw error;
    }
  }

  async function leaveCurrentMine() {
    if (!state.user || !currentMine || currentMine.completed) return;
    const reset = await leaveBackendMine(currentMine.id) ?? resetMine(currentMine);
    setState((previous) => ({ ...previous, selectedGrid: reset, mines: { ...previous.mines, [reset.id]: reset } }));
    router.replace({ pathname: '/(tabs)/map', params: { selectedGridId: reset.id } });
  }

  const syncProgress = useCallback(() => {
    if (backendEnabled && Date.now() - lastBackendSyncAt >= 30_000) {
      lastBackendSyncAt = Date.now();
      syncBackendMine().then((snapshot) => {
        if (!snapshot) return;
        setState((previous) => ({ ...previous, user:userFromRemote(snapshot.profile,snapshot.balance), mines:snapshot.mines, selectedGrid:snapshot.mines[previous.selectedGrid.id] ?? previous.selectedGrid }));
      }).catch(console.warn);
    }
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
        ? { ...next, reward: rewardForGridId(next.id), completedByUserId: previous.user.id, ownerId: null, activeUntil: null, abandonmentAt: null }
        : next;

      if (!newlyCompleted && completedMine === mine) return previous;

      const earnedReward = newlyCompleted ? rewardAmount(completedMine.reward) : 0;
      return {
        ...previous,
        selectedGrid: completedMine,
        mines: { ...previous.mines, [completedMine.id]: completedMine },
        user: newlyCompleted ? {
          ...previous.user,
          level: previous.user.level + 1,
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

  function setVerifiedWallet(walletAddress: string) {
    setState((previous) => previous.user ? { ...previous, user: { ...previous.user, walletAddress, piVerified: true } } : previous);
  }

  async function setPslWallet(pslWalletAddress: string) {
    await savePslWalletAddress(pslWalletAddress);
    setState((previous) => previous.user ? { ...previous, user: { ...previous.user, pslWalletAddress } } : previous);
  }

  function setTestMiner(testMiner: boolean) {
    setState((previous) => previous.user ? { ...previous, user: { ...previous.user, testMiner } } : previous);
  }

  async function withdrawAll() {
    if (!state.user?.piVerified) throw new Error('Pi 지갑 소유권 인증을 완료해야 출금을 신청할 수 있습니다.');
    if (!state.user.pslWalletAddress || state.user.pslBalance <= 0) throw new Error('출금 가능한 잔액 또는 저장된 PSL 토큰 지갑 주소가 없습니다.');
    throw new Error('PSL_Wallet 서명 연동은 백엔드 및 지갑 딥링크 설정 후 활성화됩니다.');
  }

  function clearAbandonmentNotice() {
    setState((previous) => ({ ...previous, abandonmentNotice: false }));
  }

  function clearConcurrentLoginNotice() {
    setState((previous) => ({ ...previous, concurrentLoginNotice: false }));
  }

  return (
    <AppContext.Provider value={{ state, hydrated, currentMine, login, logout, selectGrid, startMining, watchAd, syncProgress, setWallet, setVerifiedWallet, setPslWallet, setTestMiner, withdrawAll, clearAbandonmentNotice, clearConcurrentLoginNotice, leaveCurrentMine }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useAppState must be used inside AppStateProvider');
  return value;
}
