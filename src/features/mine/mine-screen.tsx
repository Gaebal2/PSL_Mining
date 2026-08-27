import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { MINE_DEPTH_METERS, miningSpeed, PICKAXE_NAMES, pickaxeForReferrals, remainingTimeLabel, settleMine } from '@/domain/mining';
import { useAppState } from '@/state/app-state';
import { Button, Card, Header, Metric, Screen } from '@/ui/components';
import { palette } from '@/ui/theme';

export function MineScreen() {
  const { state, currentMine, watchAd, syncProgress, leave } = useAppState();
  const [, setClock] = useState(0);
  const user = state.user!;
  const pickaxe = pickaxeForReferrals(user.referrals);
  const speed = miningSpeed(user.level, pickaxe);
  const displayed = currentMine ? settleMine(currentMine, speed) : null;

  // Run once per screen focus; the provider action intentionally reads the latest persisted snapshot.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { syncProgress(); }, []));
  useEffect(() => {
    const timer = setInterval(() => { setClock((value) => value + 1); syncProgress(); }, 15_000);
    return () => clearInterval(timer);
  }, [syncProgress]);

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

  const progress = displayed.depthMeters / MINE_DEPTH_METERS;

  function confirmLeave() {
    Alert.alert('막장에서 나갈까요?', '현재 깊이는 막장 ID에 보존되며 다음 광부가 이어서 채굴합니다.', [
      { text: '계속 채굴', style: 'cancel' },
      { text: '막장 나가기', style: 'destructive', onPress: leave },
    ]);
  }

  return (
    <Screen>
      <Header eyebrow="MINING IN PROGRESS" title="막장 안" right={<View style={styles.status}><Text style={styles.statusText}>{remainingTimeLabel(displayed)}</Text></View>} />
      <Card style={styles.mineCard}>
        <View style={styles.depthTop}>
          <View><Text style={styles.label}>현재 깊이</Text><Text style={styles.depth}>{displayed.depthMeters.toFixed(2)}m</Text></View>
          <Text style={styles.target}>목표 {MINE_DEPTH_METERS}m</Text>
        </View>
        <View style={styles.shaft}>
          <View style={[styles.dug, { height: `${Math.max(4, progress * 100)}%` }]} />
          <View style={[styles.miner, { top: `${Math.min(91, progress * 91)}%` }]}><Text style={styles.minerText}>⛏</Text></View>
          <View style={styles.ore}><Text style={styles.oreText}>?</Text></View>
        </View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>
        <Text style={styles.progressText}>{(progress * 100).toFixed(1)}% 완료</Text>
      </Card>

      <Card>
        <View style={styles.metrics}>
          <Metric label="숙련도" value={`Lv.${user.level}`} />
          <Metric label="도구" value={PICKAXE_NAMES[pickaxe]} />
          <Metric label="채굴속도" value={`${speed.toFixed(1)}m/hr`} accent />
        </View>
        <Button title="광고 보고 24시간 채굴" onPress={() => { try { watchAd(); } catch (error) { Alert.alert('활성화 실패', String(error)); } }} />
        <Button title="막장에서 나가기" secondary onPress={confirmLeave} />
      </Card>

      <Card>
        <Text style={styles.gridLabel}>막장 ID</Text>
        <Text style={styles.gridId}>{displayed.id}</Text>
        <Text style={styles.copy}>광고 활성 시간이 끝나면 진행이 멈춥니다. 이후 7일 이내 광고를 보면 같은 깊이부터 재개됩니다.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: { backgroundColor: palette.surface2, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 8 },
  statusText: { color: palette.green, fontSize: 11, fontWeight: '900' },
  mineCard: { alignItems: 'stretch' },
  depthTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  label: { color: palette.muted, fontSize: 12 },
  depth: { color: palette.text, fontSize: 34, fontWeight: '900', marginTop: 3 },
  target: { color: palette.muted, fontSize: 12, paddingBottom: 6 },
  shaft: { height: 270, backgroundColor: '#1B1811', borderRadius: 18, overflow: 'hidden', position: 'relative', borderWidth: 1, borderColor: '#40351F' },
  dug: { position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: '#2B2418' },
  miner: { position: 'absolute', alignSelf: 'center', left: '44%', zIndex: 2 },
  minerText: { fontSize: 34 },
  ore: { position: 'absolute', bottom: 12, left: '50%', marginLeft: -28, width: 56, height: 56, borderRadius: 28, backgroundColor: '#302813', borderColor: palette.gold, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  oreText: { color: palette.gold, fontSize: 25, fontWeight: '900' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: palette.surface2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: palette.gold },
  progressText: { color: palette.muted, textAlign: 'right', fontSize: 11 },
  metrics: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  gridLabel: { color: palette.muted, fontSize: 11 },
  gridId: { color: palette.text, fontSize: 15, fontWeight: '800' },
  copy: { color: palette.muted, fontSize: 13, lineHeight: 20 },
  emptyIcon: { fontSize: 56, textAlign: 'center' },
  emptyTitle: { color: palette.text, fontSize: 19, fontWeight: '900', textAlign: 'center' },
});
