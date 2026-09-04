import {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

const LOAD_TIMEOUT_MS = 30_000;

export function showRewardedAd() {
  const adUnitId = process.env.EXPO_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID?.trim() || TestIds.REWARDED;

  return new Promise<void>((resolve, reject) => {
    const ad = RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });
    let earnedReward = false;
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      subscriptions.forEach((unsubscribe) => unsubscribe());
      if (error) reject(error);
      else resolve();
    };

    const subscriptions = [
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        ad.show().catch((error) => finish(error instanceof Error ? error : new Error(String(error))));
      }),
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earnedReward = true;
      }),
      ad.addAdEventListener(AdEventType.CLOSED, () => {
        finish(earnedReward ? undefined : new Error('광고 시청을 완료해야 채굴을 시작할 수 있습니다.'));
      }),
      ad.addAdEventListener(AdEventType.ERROR, (error) => {
        finish(new Error(error.message));
      }),
    ];
    const timeout = setTimeout(() => finish(new Error('광고를 불러오는 데 시간이 너무 오래 걸립니다. 다시 시도해 주세요.')), LOAD_TIMEOUT_MS);

    ad.load();
  });
}
