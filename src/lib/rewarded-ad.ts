import mobileAds, {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

const LOAD_TIMEOUT_MS = 30_000;
const SHOW_TIMEOUT_MS = 10 * 60_000;
const PRELOADED_AD_TTL_MS = 50 * 60_000;
const INITIAL_RETRY_MS = 5_000;
const MAX_RETRY_MS = 60_000;

type AdSlot = {
  ad: RewardedAd;
  loaded: boolean;
  earnedReward: boolean;
  subscriptions: (() => void)[];
  loadedAt?: number;
  loadTimeout?: ReturnType<typeof setTimeout>;
  showTimeout?: ReturnType<typeof setTimeout>;
  rejectLoad?: (error: Error) => void;
  resolveLoad?: () => void;
  rejectShow?: (error: Error) => void;
  resolveShow?: () => void;
};

let initializationPromise: ReturnType<ReturnType<typeof mobileAds>['initialize']> | null = null;
let activeSlot: AdSlot | null = null;
let loadingPromise: Promise<void> | null = null;
let showingPromise: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelayMs = INITIAL_RETRY_MS;

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function initializeAds() {
  initializationPromise ??= mobileAds().initialize().catch((error) => {
    initializationPromise = null;
    throw error;
  });
  return initializationPromise;
}

function disposeSlot(slot: AdSlot) {
  if (slot.loadTimeout) clearTimeout(slot.loadTimeout);
  if (slot.showTimeout) clearTimeout(slot.showTimeout);
  slot.subscriptions.forEach((unsubscribe) => unsubscribe());
  if (activeSlot === slot) activeSlot = null;
}

function schedulePreload() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void prepareRewardedAd().catch(() => undefined);
  }, retryDelayMs);
  retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_MS);
}

export function prepareRewardedAd(): Promise<void> {
  if (activeSlot?.resolveShow || activeSlot?.rejectShow) return Promise.resolve();
  if (activeSlot?.loaded && activeSlot.loadedAt && Date.now() - activeSlot.loadedAt < PRELOADED_AD_TTL_MS) {
    return Promise.resolve();
  }
  if (activeSlot) disposeSlot(activeSlot);
  if (loadingPromise) return loadingPromise;

  loadingPromise = initializeAds().then(() => new Promise<void>((resolve, reject) => {
    const adUnitId = process.env.EXPO_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID?.trim() || TestIds.REWARDED;
    const slot: AdSlot = {
      ad: RewardedAd.createForAdRequest(adUnitId, { requestNonPersonalizedAdsOnly: true }),
      loaded: false,
      earnedReward: false,
      subscriptions: [],
      resolveLoad: resolve,
      rejectLoad: reject,
    };
    activeSlot = slot;

    const fail = (error: Error) => {
      slot.rejectLoad?.(error);
      slot.rejectShow?.(error);
      slot.rejectLoad = undefined;
      slot.resolveLoad = undefined;
      slot.rejectShow = undefined;
      slot.resolveShow = undefined;
      disposeSlot(slot);
      schedulePreload();
    };

    slot.subscriptions = [
      slot.ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        if (slot.loadTimeout) clearTimeout(slot.loadTimeout);
        slot.loaded = true;
        slot.loadedAt = Date.now();
        retryDelayMs = INITIAL_RETRY_MS;
        slot.resolveLoad?.();
        slot.resolveLoad = undefined;
        slot.rejectLoad = undefined;
      }),
      slot.ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        slot.earnedReward = true;
      }),
      slot.ad.addAdEventListener(AdEventType.CLOSED, () => {
        if (slot.earnedReward) slot.resolveShow?.();
        else slot.rejectShow?.(new Error('광고를 끝까지 시청해야 채굴을 시작할 수 있습니다.'));
        slot.resolveShow = undefined;
        slot.rejectShow = undefined;
        disposeSlot(slot);
        void prepareRewardedAd().catch(() => undefined);
      }),
      slot.ad.addAdEventListener(AdEventType.ERROR, (error) => fail(new Error(error.message))),
    ];

    slot.loadTimeout = setTimeout(() => {
      fail(new Error('광고를 불러오는 데 시간이 너무 오래 걸립니다. 네트워크 상태를 확인한 후 다시 시도해 주세요.'));
    }, LOAD_TIMEOUT_MS);
    slot.ad.load();
  })).catch((error) => {
    schedulePreload();
    throw error;
  }).finally(() => {
    loadingPromise = null;
  });

  return loadingPromise;
}

export function showRewardedAd(): Promise<void> {
  if (showingPromise) return Promise.reject(new Error('광고가 이미 준비 중이거나 표시되고 있습니다.'));

  showingPromise = (async () => {
    await prepareRewardedAd();
    const slot = activeSlot;
    if (!slot?.loaded) throw new Error('광고가 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.');

    slot.loaded = false;
    slot.earnedReward = false;
    await new Promise<void>((resolve, reject) => {
      slot.resolveShow = resolve;
      slot.rejectShow = reject;
      slot.showTimeout = setTimeout(() => {
        reject(new Error('광고 시청 확인 시간이 초과되었습니다. 다시 시도해 주세요.'));
        slot.resolveShow = undefined;
        slot.rejectShow = undefined;
        disposeSlot(slot);
        schedulePreload();
      }, SHOW_TIMEOUT_MS);
      slot.ad.show().catch((error) => {
        reject(toError(error));
        slot.resolveShow = undefined;
        slot.rejectShow = undefined;
        disposeSlot(slot);
        schedulePreload();
      });
    });
  })().finally(() => {
    showingPromise = null;
  });

  return showingPromise;
}
