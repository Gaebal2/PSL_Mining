import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { ClipPath, Defs, Image as SvgImage, Path } from 'react-native-svg';

import { AD_ACTIVE_HOURS, BASE_MINING_SPEED, levelSpeed, MINE_DEPTH_METERS, miningSpeed, PICKAXE_NAMES, pickaxeForReferrals, settleMine } from '@/domain/mining';
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
  const activationProgress = isActive ? Math.min(1, 1 - remainingMilliseconds / (AD_ACTIVE_HOURS * 3_600_000)) : 1;
  const swing = useSharedValue(0);

  const raisedAnimation = useAnimatedStyle(() => ({ opacity: 1 - swing.value }));
  const impactPoseAnimation = useAnimatedStyle(() => ({ opacity: swing.value }));
  const impactAnimation = useAnimatedStyle(() => ({ opacity: swing.value, transform: [{ scale: 0.7 + swing.value * 0.55 }] }));

  // Run once per screen focus; the provider action intentionally reads the latest persisted snapshot.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { setClock(Date.now()); syncProgress(); }, []));
  useEffect(() => {
    const timer = setInterval(() => { setClock(Date.now()); syncProgress(); }, 15_000);
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
              <Text style={styles.progressText}>{(progress * 100).toFixed(1)}%</Text>
            </View>
            <Card style={styles.infoCard}>
              <View style={styles.infoCopy}>
                <InfoPill label="막장 ID" value={displayed.id} />
                <InfoPill label="기본 채굴속도" value={`${BASE_MINING_SPEED.toFixed(1)}m/hr`} />
                <InfoPill label="숙련도" value={`Lv${user.level} (+${(skillSpeed - BASE_MINING_SPEED).toFixed(1)}m/hr)`} />
                <InfoPill label="도구" value={`${PICKAXE_NAMES[pickaxe]} (+${toolBonus.toFixed(1)}m/hr) · 초대 ${user.referrals}명`} />
                <InfoPill label="현재 채굴속도" value={`${speed.toFixed(1)}m/hr`} accent />
              </View>
              <Pressable disabled={isActive} onPress={handleActivation} style={({ pressed }) => [styles.pieButton, isActive && styles.pieDisabled, pressed && styles.piePressed]}>
                <MiningActivationIcon progress={activationProgress} />
                <Text style={[styles.pieStatus, !isActive && styles.pieStatusReady]}>{isActive ? `${remainingHours}h ${remainingMinutes}m` : '광고 보고 재개'}</Text>
              </Pressable>
            </Card>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

function InfoPill({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <View style={[styles.infoPill, accent && styles.infoPillAccent]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text numberOfLines={1} style={[styles.infoValue, accent && styles.infoValueAccent]}>{value}</Text>
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
  miner: { position: 'absolute', width: '70%', height: '70%', left: '15%', top: '13%' },
  waitingMiner: { position: 'absolute', width: '58%', height: '58%', left: '21%', top: '18%' },
  impact: { position: 'absolute', left: '49%', top: '70%', width: 28, height: 28 },
  sparkLarge: { position: 'absolute', width: 13, height: 4, borderRadius: 2, backgroundColor: palette.gold, transform: [{ rotate: '-28deg' }] },
  sparkSmall: { position: 'absolute', left: 13, top: 11, width: 7, height: 3, borderRadius: 2, backgroundColor: '#FFF0A3', transform: [{ rotate: '24deg' }] },
  floatingArea: { position: 'absolute', left: 14, right: 14, bottom: 14, gap: 5 },
  progressTrack: { height: 12, marginHorizontal: 4, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.9)', overflow: 'hidden', justifyContent: 'center' },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: palette.gold },
  progressText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.65)', textShadowRadius: 2 },
  infoCard: { paddingHorizontal: 9, paddingVertical: 9, flexDirection: 'row', alignItems: 'stretch', gap: 7, borderColor: '#3B2A20', borderWidth: 2, backgroundColor: 'rgba(250,244,229,0.96)' },
  infoCopy: { flex: 1, gap: 4 },
  infoPill: { minHeight: 26, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, borderWidth: 1.5, borderColor: '#6A4A31', backgroundColor: '#FFF9E9', flexDirection: 'row', alignItems: 'center', gap: 7 },
  infoPillAccent: { borderColor: '#C77B17', backgroundColor: '#FFF1C5' },
  infoLabel: { width: 66, color: '#765B45', fontSize: 8, fontWeight: '800' },
  infoValue: { flex: 1, color: '#2E241E', fontSize: 9, fontWeight: '900' },
  infoValueAccent: { color: '#9B5C08' },
  pieButton: { width: 78, alignItems: 'center', justifyContent: 'center', borderRadius: 15, paddingVertical: 5, borderWidth: 2, borderColor: '#6A4A31', backgroundColor: '#FFF1C5' },
  pieDisabled: { opacity: 0.52, borderColor: palette.border, backgroundColor: palette.surface2 },
  piePressed: { transform: [{ scale: 0.96 }], backgroundColor: 'rgba(240,185,11,0.22)' },
  foodIconWrap: { width: 48, height: 48 },
  foodIcon: { width: 48, height: 48 },
  foodIconDim: { opacity: 0.18 },
  pieStatus: { color: palette.muted, fontSize: 8, fontWeight: '900', marginTop: 1 },
  pieStatusReady: { color: palette.goldDark },
  copy: { color: palette.muted, fontSize: 13, lineHeight: 20 },
  emptyIcon: { fontSize: 56, textAlign: 'center' },
  emptyTitle: { color: palette.text, fontSize: 19, fontWeight: '900', textAlign: 'center' },
});
