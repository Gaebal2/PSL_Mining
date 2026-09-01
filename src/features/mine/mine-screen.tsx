import { router, useFocusEffect } from 'expo-router';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { ClipPath, Defs, Image as SvgImage, Path } from 'react-native-svg';

import { AD_ACTIVE_HOURS, BASE_MINING_SPEED, levelSpeed, MINE_DEPTH_METERS, miningSpeed, pickaxeForReferrals, settleMine } from '@/domain/mining';
import { useAppState } from '@/state/app-state';
import { Button, Card, Header, Screen } from '@/ui/components';
import { useAppDialog } from '@/ui/app-dialog';
import { palette } from '@/ui/theme';

export function MineScreen() {
  const { state, currentMine, watchAd, syncProgress } = useAppState();
  const [clock, setClock] = useState(() => Date.now());
  const user = state.user!;
  const showDialog = useAppDialog();
  const pickaxe = pickaxeForReferrals(user.referrals);
  const skillSpeed = levelSpeed(user.level);
  const speed = miningSpeed(user.level, pickaxe);
  const toolBonus = speed - skillSpeed;
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
    return (
      <Screen>
        <Header eyebrow="YOUR MINE" title="입장한 막장이 없어요" />
        <Card>
          <Text style={styles.emptyIcon}>⛏</Text>
          <Text style={styles.emptyTitle}>금광 지도에서 Grid를 선택하세요</Text>
          <Text style={styles.copy}>세계 어디든 원하는 위치를 선택할 수 있습니다.</Text>
          <Button title="금광 지도 열기" onPress={() => router.push('/(tabs)/map')} />
        </Card>
      </Screen>
    );
  }

  function handleActivation() {
    if (isActive) return;
    try {
      watchAd();
      setClock(Date.now());
    } catch (error) {
      showDialog({ title: '활성화 실패', message: String(error) });
    }
  }

  return (
    <View style={styles.screen}>
      <ImageBackground source={require('../../../assets/images/mine-shaft-background-v2.png')} resizeMode="cover" style={StyleSheet.absoluteFill}>
        <SafeAreaView style={styles.scene} edges={['top']}>
          <View pointerEvents="none" style={styles.mineIdBoard}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.mineIdText}>{displayed.id}</Text>
          </View>
          {isActive ? (
            <>
              <Animated.Image source={require('../../../assets/images/miner-strike-raised.png')} resizeMode="contain" style={[styles.miner, raisedAnimation]} />
              <Animated.Image source={require('../../../assets/images/miner-strike-impact.png')} resizeMode="contain" style={[styles.miner, impactPoseAnimation]} />
              <Animated.View style={[styles.impact, impactAnimation]}><View style={styles.sparkLarge} /><View style={styles.sparkSmall} /></Animated.View>
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
              <Text style={styles.progressText}>{(progress * 100).toFixed(1)}%</Text>
            </View>
            <Card style={styles.infoCard}>
              <MetricColumn label="24hr">
                <Pressable disabled={isActive} onPress={handleActivation} style={({ pressed }) => [styles.metricBox, styles.activationBox, isActive && styles.pieDisabled, pressed && styles.piePressed]}>
                  <MiningActivationIcon progress={activationProgress} />
                  <Text style={[styles.pieStatus, !isActive && styles.pieStatusReady]}>{isActive ? `${remainingHours}h ${remainingMinutes}m` : '재개'}</Text>
                </Pressable>
              </MetricColumn>
              <MetricColumn label="기본속도" value={BASE_MINING_SPEED.toFixed(1)} />
              <MetricColumn label="숙련도" value={(skillSpeed - BASE_MINING_SPEED).toFixed(1)} />
              <MetricColumn label="채굴도구" value={toolBonus.toFixed(1)} />
              <MetricColumn label="채굴속도" value={speed.toFixed(1)} accent />
            </Card>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

function MetricColumn({ label, value, accent = false, children }: { label: string; value?: string; accent?: boolean; children?: ReactNode }) {
  return <View style={styles.metricColumn}>
    <Text numberOfLines={1} style={styles.metricLabel}>{label}</Text>
    {children ?? <View style={[styles.metricBox, accent && styles.metricBoxAccent]}>
      <Text style={[styles.metricValue, accent && styles.metricValueAccent]}>{value}</Text>
    </View>}
  </View>;
}

function MiningActivationIcon({ progress }: { progress: number }) {
  const size = 48;
  const center = size / 2;
  const radius = 36;
  const angle = Math.PI * 2 * Math.min(1, Math.max(0, progress)) - Math.PI / 2;
  const endX = center + radius * Math.cos(angle);
  const endY = center + radius * Math.sin(angle);
  const wedge = progress >= 1
    ? `M ${center} ${center} L ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius} Z`
    : progress <= 0
      ? ''
      : `M ${center} ${center} L ${center} ${center - radius} A ${radius} ${radius} 0 ${progress > 0.5 ? 1 : 0} 1 ${endX} ${endY} Z`;

  return <View style={styles.foodIconWrap}>
    <Image source={require('../../../assets/images/mining-food.png')} resizeMode="contain" style={[styles.foodIcon, styles.foodIconDim]} />
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Defs><ClipPath id="activation-wedge"><Path d={wedge} /></ClipPath></Defs>
      <SvgImage href={require('../../../assets/images/mining-food.png')} width={size} height={size} preserveAspectRatio="xMidYMid meet" clipPath="url(#activation-wedge)" />
    </Svg>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111722' },
  scene: { flex: 1 },
  mineIdBoard: { position: 'absolute', top: '17%', left: '13%', right: '13%', height: 56, zIndex: 5, alignItems: 'center', justifyContent: 'center' },
  mineIdText: { color: '#FFF0B5', fontSize: 32, fontWeight: '900', letterSpacing: 1.1, textShadowColor: '#3A1C08', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 2 },
  miner: { position: 'absolute', width: '42%', height: '42%', left: '29%', top: '43%' },
  waitingMiner: { position: 'absolute', width: '36%', height: '36%', left: '32%', top: '47%' },
  impact: { position: 'absolute', left: '54%', top: '72%', width: 24, height: 24 },
  sparkLarge: { position: 'absolute', width: 13, height: 4, borderRadius: 2, backgroundColor: palette.gold, transform: [{ rotate: '-28deg' }] },
  sparkSmall: { position: 'absolute', left: 13, top: 11, width: 7, height: 3, borderRadius: 2, backgroundColor: '#FFF0A3', transform: [{ rotate: '24deg' }] },
  floatingArea: { position: 'absolute', left: 14, right: 14, bottom: 14, gap: 5 },
  progressTrack: { height: 22, marginHorizontal: 4, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.9)', overflow: 'hidden', justifyContent: 'center' },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: palette.gold },
  progressText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.65)', textShadowRadius: 2 },
  progressFood: { position: 'absolute', zIndex: 2, top: 2, width: 20, height: 18, marginLeft: -10 },
  infoCard: { paddingHorizontal: 6, paddingTop: 7, paddingBottom: 9, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, borderColor: '#D9D9D9', borderWidth: 1, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.97)' },
  metricColumn: { flex: 1, minWidth: 0, alignItems: 'center', gap: 5 },
  metricLabel: { color: '#171717', fontSize: 9, lineHeight: 12, fontWeight: '700' },
  metricBox: { width: '100%', maxWidth: 58, height: 58, borderRadius: 10, borderWidth: 1, borderColor: '#D0D0D0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOffset: { width: 2, height: 3 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 4 },
  metricBoxAccent: { borderColor: '#B9A06A', backgroundColor: '#FFFDF5' },
  metricValue: { color: '#1F1F1F', fontSize: 14, fontWeight: '500' },
  metricValueAccent: { color: '#8A5A00', fontWeight: '900' },
  activationBox: { paddingTop: 2 },
  pieDisabled: { opacity: 0.52, borderColor: palette.border, backgroundColor: palette.surface2 },
  piePressed: { transform: [{ scale: 0.96 }], backgroundColor: 'rgba(240,185,11,0.22)' },
  foodIconWrap: { width: 44, height: 44 },
  foodIcon: { width: 44, height: 44 },
  foodIconDim: { opacity: 0.18 },
  pieStatus: { color: palette.muted, fontSize: 8, fontWeight: '900', marginTop: 1 },
  pieStatusReady: { color: palette.goldDark },
  copy: { color: palette.muted, fontSize: 13, lineHeight: 20 },
  emptyIcon: { fontSize: 56, textAlign: 'center' },
  emptyTitle: { color: palette.text, fontSize: 19, fontWeight: '900', textAlign: 'center' },
});
