import { router, useFocusEffect } from 'expo-router';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { AppState, Image, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { ClipPath, Defs, Image as SvgImage, Path } from 'react-native-svg';

import { AD_ACTIVE_HOURS, BASE_MINING_SPEED, levelSpeed, MINE_DEPTH_METERS, miningSpeed, pickaxeForReferrals, settleMine } from '@/domain/mining';
import { useAppState } from '@/state/app-state';
import { useLocale } from '@/state/locale';
import { Button, Card, Header, Screen } from '@/ui/components';
import { useAppDialog } from '@/ui/app-dialog';
import { palette } from '@/ui/theme';
import { showRewardedAd } from '@/lib/rewarded-ad';

export function MineScreen() {
  const { state, currentMine, watchAd, syncProgress, leaveCurrentMine } = useAppState();
  const [clock, setClock] = useState(() => Date.now());
  const user = state.user!;
  const showDialog = useAppDialog();
  const { t } = useLocale();
  const pickaxe = pickaxeForReferrals(user.referrals);
  const skillSpeed = levelSpeed(user.level);
  const speed = miningSpeed(user.level, pickaxe, user.testMiner);
  const loyaltyBonus = speed - skillSpeed;
  const displayed = currentMine ? settleMine(currentMine, speed, new Date(clock)) : null;
  const activeUntil = displayed?.activeUntil ? new Date(displayed.activeUntil).getTime() : 0;
  const isActive = Boolean(displayed && !displayed.completed && activeUntil > clock);
  const remainingMilliseconds = Math.max(0, activeUntil - clock);
  const remainingHours = Math.floor(remainingMilliseconds / 3_600_000);
  const remainingMinutes = Math.floor(remainingMilliseconds % 3_600_000 / 60_000);
  const progress = displayed ? displayed.depthMeters / MINE_DEPTH_METERS : 0;
  const meatMilestones = Array.from(
    { length: Math.max(0, Math.ceil(MINE_DEPTH_METERS / (speed * AD_ACTIVE_HOURS)) - 1) },
    (_, index) => (index + 1) * speed * AD_ACTIVE_HOURS / MINE_DEPTH_METERS,
  );
  const activationProgress = isActive ? Math.min(1, 1 - remainingMilliseconds / (AD_ACTIVE_HOURS * 3_600_000)) : 1;
  const swing = useSharedValue(0);

  const raisedAnimation = useAnimatedStyle(() => ({ opacity: 1 - swing.value }));
  const impactPoseAnimation = useAnimatedStyle(() => ({ opacity: swing.value }));
  const impactAnimation = useAnimatedStyle(() => ({ opacity: swing.value, transform: [{ scale: 0.7 + swing.value * 0.55 }] }));

  // Run once per screen focus; the provider action intentionally reads the latest persisted snapshot.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { setClock(Date.now()); syncProgress(); }, []));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      setClock(Date.now());
      syncProgress();
    });
    return () => subscription.remove();
  }, [syncProgress]);
  useEffect(() => {
    const timer = setInterval(() => { setClock(Date.now()); syncProgress(); }, 250);
    return () => clearInterval(timer);
  }, [syncProgress]);
  useEffect(() => {
    if (!isActive) {
      cancelAnimation(swing);
      // eslint-disable-next-line react-hooks/immutability
      swing.value = 0;
      return;
    }
    swing.value = withRepeat(withSequence(
      withTiming(0, { duration: 260 }),
      withTiming(1, { duration: 150, easing: Easing.in(Easing.quad) }),
      withTiming(1, { duration: 90 }),
      withTiming(0, { duration: 330, easing: Easing.out(Easing.cubic) }),
    ), -1);
    return () => cancelAnimation(swing);
  }, [isActive, swing]);

  if (!displayed) {
    if (user.lastCompletedMineId && user.lastRewardAmount !== null) {
      return (
        <Screen>
          <Header eyebrow="MINING COMPLETE" title={t('채굴 완료', 'Mining Complete')} />
          <Card style={styles.completeCard}>
            <View style={styles.completeMinerWrap}><Image source={require('../../../assets/images/miner-waiting.png')} resizeMode="contain" style={styles.completeMinerImage} /></View>
            <Text style={styles.completeTitle}>{t('채굴을 완료했습니다.', 'Mining is complete.')}</Text>
            <Text style={styles.completeMineId}>{user.lastCompletedMineId}</Text>
            <View style={styles.rewardPanel}>
              <Text style={styles.rewardLabel}>{t('획득 보상', 'REWARD EARNED')}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={styles.rewardValue}>{user.lastRewardAmount.toLocaleString()}</Text>
              <Text style={styles.rewardSymbol}>PSL</Text>
            </View>
            <Text style={styles.completeCopy}>{t('막장(Grid) 1개를 모두 채굴하여 숙련도 레벨 1증가 하였습니다.', 'You fully mined one Grid and increased your skill level by 1.')}</Text>
            <Button title={t('맵 화면에서 다음 막장 선택', 'Choose the next mine on the map')} onPress={() => router.push('/(tabs)/map')} />
          </Card>
        </Screen>
      );
    }
    return (
      <Screen>
        <Header eyebrow="YOUR MINE" title={t('입장한 막장이 없어요', 'No active mine')} />
        <Card>
          <Text style={styles.emptyIcon}>⛏</Text>
          <Text style={styles.emptyTitle}>{t('맵 화면에서 채굴 할 막장을 선택 해 주세요', 'Choose a mine from the map')}</Text>
          <Button title={t('맵 화면으로 이동', 'Go to Map')} onPress={() => router.push('/(tabs)/map')} />
        </Card>
      </Screen>
    );
  }

  function handleActivation() {
    if (isActive) return;
    showDialog({
      title: t('리워드 광고', 'Rewarded ad'),
      message: t('광고를 끝까지 시청하면 이 막장에서 24시간 채굴을 다시 시작합니다.', 'Watch the full ad to restart 24 hours of mining in this mine.'),
      actions: [
        { text: t('취소', 'Cancel'), style: 'cancel' },
        { text: t('광고 시청', 'Watch ad'), onPress: async () => {
          try {
            await showRewardedAd();
            await watchAd();
            setClock(Date.now());
          } catch (error) {
            showDialog({ title: t('활성화 실패', 'Activation failed'), message: error instanceof Error ? error.message : String(error) });
          }
        } },
      ],
    });
  }

  function handleLeaveMine() {
    showDialog({
      title: t('채굴장 나가기', 'Leave mine'),
      message: t('채굴장을 나가면 채굴률은 초기화 되고, 이 막장(Grid)에서 다시 채굴해도 처음부터 다시 시작됩니다. 진짜 나가시겠습니까?', 'Leaving resets your mining progress. If you mine this Grid again, you will start from the beginning. Are you sure you want to leave?'),
      actions: [
        { text: t('취소', 'Cancel'), style: 'cancel' },
        { text: t('나가기', 'Leave'), style: 'destructive', onPress: () => { leaveCurrentMine().catch((error) => showDialog({ title: t('나가기 실패', 'Unable to leave'), message: String(error) })); } },
      ],
    });
  }

  return (
    <View style={styles.screen}>
      <ImageBackground source={require('../../../assets/images/mine-shaft-background-v2.png')} resizeMode="cover" style={StyleSheet.absoluteFill}>
        <SafeAreaView style={styles.scene} edges={['top']}>
          <Pressable accessibilityRole="button" onPress={handleLeaveMine} style={({ pressed }) => [styles.leaveButton, pressed && styles.leaveButtonPressed]}><Text style={styles.leaveButtonText}>{t('채굴장 나가기', 'Leave mine')}</Text></Pressable>
          <View pointerEvents="none" style={styles.mineIdBoard}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.mineIdText}>{displayed.id}</Text>
          </View>
          {isActive ? (
            <>
              <Animated.Image source={require('../../../assets/images/miner-strike-raised.png')} resizeMode="contain" style={[styles.miner, raisedAnimation]} />
              <Animated.Image source={require('../../../assets/images/miner-strike-impact.png')} resizeMode="contain" style={[styles.miner, impactPoseAnimation]} />
              <Animated.View style={[styles.impact, impactAnimation]}>
                <View style={styles.impactCore} />
                <View style={[styles.spark, styles.sparkOne]} /><View style={[styles.spark, styles.sparkTwo]} />
                <View style={[styles.spark, styles.sparkThree]} /><View style={[styles.spark, styles.sparkFour]} />
                <View style={[styles.sparkDot, styles.sparkDotOne]} /><View style={[styles.sparkDot, styles.sparkDotTwo]} />
              </Animated.View>
            </>
          ) : (
            <Image source={require('../../../assets/images/miner-waiting.png')} resizeMode="contain" style={styles.waitingMiner} />
          )}

          <View style={styles.floatingArea}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              {meatMilestones.map((milestone) => (
                <Image key={milestone} source={require('../../../assets/images/mining-food.png')} resizeMode="contain" style={[styles.progressFood, { left: `${milestone * 100}%` }]} />
              ))}
              <Text style={[styles.progressText, { left: `${Math.max(8, progress * 100)}%` }]}>{(progress * 100).toFixed(1)}%</Text>
            </View>
            <Card style={styles.infoCard}>
              <MetricColumn label="24hr">
                <Pressable disabled={isActive} onPress={handleActivation} style={[styles.metricBox, styles.activationBox, isActive && styles.pieDisabled]}>
                  <MiningActivationIcon progress={activationProgress} />
                  <Text style={[styles.pieStatus, !isActive && styles.pieStatusReady]}>{isActive ? `${remainingHours}h ${remainingMinutes}m` : t('채굴', 'Mine')}</Text>
                </Pressable>
              </MetricColumn>
              <MetricColumn label={t('기본속도', 'Base')} value={BASE_MINING_SPEED.toFixed(1)} tone="base" />
              <MetricColumn label={t('숙련도', 'Skill')} value={`+${(skillSpeed - BASE_MINING_SPEED).toFixed(1)}`} tone="skill" />
              <MetricColumn label={t('충성도', 'Loyalty')} value={`+${loyaltyBonus.toFixed(1)}`} tone="loyalty" />
              <MetricColumn label={t('채굴속도', 'Speed')} value={speed.toFixed(1)} accent tone="total" />
            </Card>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

function MetricColumn({ label, value, accent = false, tone, children }: { label: string; value?: string; accent?: boolean; tone?: 'base' | 'skill' | 'loyalty' | 'total'; children?: ReactNode }) {
  return <View style={styles.metricColumn}>
    <Text numberOfLines={1} style={styles.metricLabel}>{label}</Text>
    {children ?? <View style={[styles.metricBox, tone && styles[`${tone}MetricBox`], accent && styles.metricBoxAccent]}>
      <View style={styles.metricRivetLeft} /><View style={styles.metricRivetRight} />
      <Text style={[styles.metricValue, tone && styles[`${tone}MetricValue`], accent && styles.metricValueAccent]}>{value}</Text>
      <Text style={styles.metricUnit}>m/hr</Text>
    </View>}
  </View>;
}

function MiningActivationIcon({ progress }: { progress: number }) {
  const size = 44;
  const center = size / 2;
  const radius = 31;
  const angle = Math.PI * 2 * Math.min(1, Math.max(0, progress)) - Math.PI / 2;
  const endX = center + radius * Math.cos(angle);
  const endY = center + radius * Math.sin(angle);
  const wedge = progress >= 1
    ? `M ${center} ${center} L ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius} Z`
    : progress <= 0
      ? ''
      : `M ${center} ${center} L ${center} ${center - radius} A ${radius} ${radius} 0 ${progress > 0.5 ? 1 : 0} 1 ${endX} ${endY} Z`;

  if (progress >= 0.999) {
    return <View style={styles.foodIconWrap}><Image source={require('../../../assets/images/mining-food.png')} resizeMode="contain" style={styles.foodIcon} /></View>;
  }

  return <View style={styles.foodIconWrap}>
    <Image source={require('../../../assets/images/mining-food.png')} resizeMode="contain" style={[styles.foodIcon, styles.foodIconDim]} />
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Defs><ClipPath id="activation-wedge"><Path d={wedge} /></ClipPath></Defs>
      <SvgImage href={require('../../../assets/images/mining-food.png')} width={44} height={44} preserveAspectRatio="xMidYMid meet" clipPath="url(#activation-wedge)" />
    </Svg>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111722' },
  scene: { flex: 1 },
  mineIdBoard: { position: 'absolute', top: '17.7%', left: '13%', right: '13%', height: 56, zIndex: 5, alignItems: 'center', justifyContent: 'center' },
  mineIdText: { color: '#FFF0B5', fontSize: 32, fontWeight: '900', letterSpacing: 1.1, textShadowColor: '#3A1C08', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 2 },
  miner: { position: 'absolute', width: '42%', height: '42%', left: '29%', top: '43%' },
  waitingMiner: { position: 'absolute', width: '36%', height: '36%', left: '32%', top: '47%' },
  impact: { position: 'absolute', left: '47.5%', top: '76%', width: 42, height: 34, zIndex: 4 },
  impactCore: { position: 'absolute', left: 15, top: 15, width: 13, height: 8, borderRadius: 7, backgroundColor: '#FFF4A8', shadowColor: '#FF8A00', shadowOpacity: 1, shadowRadius: 9, elevation: 8 },
  spark: { position: 'absolute', width: 17, height: 4, borderRadius: 2, backgroundColor: '#FFB000', shadowColor: '#FF5A00', shadowOpacity: 0.9, shadowRadius: 4 },
  sparkOne: { left: 1, top: 7, transform: [{ rotate: '34deg' }] },
  sparkTwo: { right: 0, top: 5, transform: [{ rotate: '-36deg' }] },
  sparkThree: { left: 3, bottom: 2, width: 13, backgroundColor: '#FFF0A3', transform: [{ rotate: '-28deg' }] },
  sparkFour: { right: 2, bottom: 3, width: 12, backgroundColor: '#FFF0A3', transform: [{ rotate: '30deg' }] },
  sparkDot: { position: 'absolute', width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFFFFF' },
  sparkDotOne: { left: 8, top: 1 },
  sparkDotTwo: { right: 8, top: 16 },
  floatingArea: { position: 'absolute', left: 14, right: 14, bottom: 14, gap: 5 },
  progressTrack: { height: 22, marginHorizontal: 4, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.9)', overflow: 'hidden', justifyContent: 'center' },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: palette.gold },
  progressText: { position: 'absolute', zIndex: 3, width: 40, marginLeft: -40, color: '#FFFFFF', fontSize: 8, fontWeight: '900', textAlign: 'right', paddingRight: 4, textShadowColor: 'rgba(0,0,0,0.65)', textShadowRadius: 2 },
  progressFood: { position: 'absolute', zIndex: 2, top: 2, width: 20, height: 18, marginLeft: -10 },
  infoCard: { paddingHorizontal: 7, paddingTop: 8, paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 3, borderColor: '#3E2A21', borderWidth: 2, borderRadius: 20, backgroundColor: 'rgba(244,238,222,0.98)', shadowColor: '#180C08', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 7 },
  leaveButton: { position: 'absolute', zIndex: 10, top: 48, alignSelf: 'center', minHeight: 34, justifyContent: 'center', paddingHorizontal: 15, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,223,151,0.72)', backgroundColor: 'rgba(39,34,63,0.88)' },
  leaveButtonPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  leaveButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  metricColumn: { flex: 1, minWidth: 0, alignItems: 'center', gap: 5 },
  metricLabel: { color: '#3A2B22', fontSize: 9, lineHeight: 12, fontWeight: '900' },
  metricBox: { width: '100%', maxWidth: 58, height: 58, borderRadius: 12, borderWidth: 2, borderColor: '#303746', backgroundColor: '#515A6E', alignItems: 'center', justifyContent: 'center', shadowColor: '#160C08', shadowOffset: { width: 2, height: 3 }, shadowOpacity: 0.32, shadowRadius: 3, elevation: 5, overflow: 'hidden' },
  metricBoxAccent: { borderColor: '#7A431C', backgroundColor: '#B96A24' },
  metricValue: { color: '#FFF1C7', fontSize: 17, lineHeight: 20, fontWeight: '900', letterSpacing: -0.4, textShadowColor: '#171A22', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  metricUnit: { marginTop: -2, color: '#D9DDE8', fontSize: 7, lineHeight: 9, fontWeight: '900', letterSpacing: 0.2 },
  metricRivetLeft: { position: 'absolute', left: 4, top: 4, width: 4, height: 4, borderRadius: 2, backgroundColor: '#BFC5D2', borderWidth: 1, borderColor: '#252B38' },
  metricRivetRight: { position: 'absolute', right: 4, top: 4, width: 4, height: 4, borderRadius: 2, backgroundColor: '#BFC5D2', borderWidth: 1, borderColor: '#252B38' },
  baseMetricBox: { borderTopColor: '#AEB6C7' },
  skillMetricBox: { borderTopColor: '#8F7AE8' },
  loyaltyMetricBox: { borderTopColor: '#70B890' },
  totalMetricBox: { borderTopColor: '#F3B64B' },
  baseMetricValue: { color: '#F0F2F7' },
  skillMetricValue: { color: '#D8D0FF' },
  loyaltyMetricValue: { color: '#C8F2D7' },
  totalMetricValue: { color: '#FFF0B5' },
  metricValueAccent: { color: '#FFF0B5', fontWeight: '900' },
  activationBox: { paddingTop: 2 },
  pieDisabled: { borderColor: palette.border, backgroundColor: palette.surface2 },
  foodIconWrap: { width: 44, height: 44 },
  foodIcon: { width: 44, height: 44 },
  foodIconDim: { opacity: 0.18 },
  pieStatus: { color: palette.muted, fontSize: 8, fontWeight: '900', marginTop: -3 },
  pieStatusReady: { color: palette.goldDark },
  copy: { color: palette.muted, fontSize: 13, lineHeight: 20 },
  emptyIcon: { fontSize: 56, textAlign: 'center' },
  emptyTitle: { color: palette.text, fontSize: 19, fontWeight: '900', textAlign: 'center' },
  completeCard: { alignItems: 'center', paddingVertical: 24, borderColor: '#E2C66D', backgroundColor: '#FFFDF5' },
  completeMinerWrap: { width: 150, height: 170, alignItems: 'center', justifyContent: 'center' },
  completeMinerImage: { width: 145, height: 165 },
  completeTitle: { color: palette.text, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  completeMineId: { color: palette.muted, fontSize: 12, fontWeight: '800' },
  rewardPanel: { width: '100%', alignItems: 'center', borderRadius: 20, paddingVertical: 16, backgroundColor: palette.hero },
  rewardLabel: { color: palette.mint, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  rewardValue: { color: palette.onHero, fontSize: 36, fontWeight: '900' },
  rewardSymbol: { color: '#AFA0FF', fontSize: 13, fontWeight: '900' },
  completeCopy: { color: palette.goldDark, fontSize: 14, lineHeight: 21, fontWeight: '900', textAlign: 'center' },
});
