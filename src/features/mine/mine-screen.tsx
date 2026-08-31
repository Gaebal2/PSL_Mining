import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BASE_MINING_SPEED, levelSpeed, MINE_DEPTH_METERS, miningSpeed, PICKAXE_NAMES, pickaxeForReferrals, settleMine } from '@/domain/mining';
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
                <Text style={styles.infoLine}>막장 ID : {displayed.id}</Text>
                <Text style={styles.infoLine}>기본속도 : {BASE_MINING_SPEED.toFixed(1)}m/hr</Text>
                <Text style={styles.infoLine}>숙련도 : Lv{user.level}(+{(skillSpeed - BASE_MINING_SPEED).toFixed(1)}m/hr)</Text>
                <Text style={styles.infoLine}>도구 : {PICKAXE_NAMES[pickaxe]}(+{toolBonus.toFixed(1)}m/hr), 초대인원 {user.referrals}명</Text>
                <Text style={styles.infoLine}>현재 채굴속도 : {speed.toFixed(1)}m/hr</Text>
              </View>
              <Pressable disabled={isActive} onPress={handleActivation} style={({ pressed }) => [styles.pieButton, isActive && styles.pieDisabled, pressed && styles.piePressed]}>
                <Image source={require('../../../assets/images/mining-food.png')} resizeMode="contain" style={styles.foodIcon} />
                <Text style={[styles.pieStatus, !isActive && styles.pieStatusReady]}>{isActive ? `${remainingHours}h ${remainingMinutes}m` : '광고 보고 재개'}</Text>
              </Pressable>
            </Card>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
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
  infoCard: { paddingHorizontal: 11, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  infoCopy: { flex: 1, gap: 1 },
  infoLine: { color: palette.text, fontSize: 10, lineHeight: 13, fontWeight: '600' },
  pieButton: { width: 68, minHeight: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 15, paddingVertical: 2, borderWidth: 2, borderColor: palette.gold, backgroundColor: 'rgba(240,185,11,0.12)' },
  pieDisabled: { opacity: 0.52, borderColor: palette.border, backgroundColor: palette.surface2 },
  piePressed: { transform: [{ scale: 0.96 }], backgroundColor: 'rgba(240,185,11,0.22)' },
  foodIcon: { width: 43, height: 33 },
  pieStatus: { color: palette.muted, fontSize: 8, fontWeight: '900', marginTop: 1 },
  pieStatusReady: { color: palette.goldDark },
  copy: { color: palette.muted, fontSize: 13, lineHeight: 20 },
  emptyIcon: { fontSize: 56, textAlign: 'center' },
  emptyTitle: { color: palette.text, fontSize: 19, fontWeight: '900', textAlign: 'center' },
});
