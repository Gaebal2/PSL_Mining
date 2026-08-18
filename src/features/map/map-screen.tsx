import { router } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { MineMap } from '@/features/map/mine-map';
import { useAppState } from '@/state/app-state';
import { Button, Card, Header, Screen } from '@/ui/components';
import { palette } from '@/ui/theme';

export function MapScreen() {
  const { state, currentMine, selectGrid, startMining } = useAppState();
  const grid = state.selectedGrid;

  function handleStart() {
    try { startMining(); } catch (error) { Alert.alert('입장할 수 없습니다', error instanceof Error ? error.message : '다시 시도해 주세요.'); }
  }

  return (
    <Screen>
      <Header eyebrow="GLOBAL GOLD MAP" title="금광 지도" right={<View style={styles.live}><View style={styles.dot} /><Text style={styles.liveText}>LIVE</Text></View>} />
      <MineMap latitude={grid.latitude} longitude={grid.longitude} onSelect={selectGrid} />
      <Card>
        <View style={styles.gridRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>선택한 막장</Text>
            <Text numberOfLines={1} style={styles.gridId}>{grid.id}</Text>
          </View>
          <View style={styles.badge}><Text style={styles.badgeText}>{grid.depthMeters.toFixed(1)} / 48m</Text></View>
        </View>
        <Text style={styles.description}>
          {grid.completed
            ? grid.reward === 'psl' ? '광맥 발견! 이 막장에는 1억 PSL이 있었습니다.' : '채굴 완료. 이 막장에는 PSL이 없었습니다.'
            : '결과는 48m 채굴 완료 후 공개됩니다. 이전 광부의 깊이는 이 막장에 그대로 보존됩니다.'}
        </Text>
        {currentMine && currentMine.id !== grid.id ? (
          <Button title="현재 막장으로 이동" onPress={() => router.push('/(tabs)/mine')} />
        ) : (
          <Button title={grid.ownerId ? '이 막장 이어서 보기' : '이 막장에 입장하기'} onPress={handleStart} disabled={grid.completed || Boolean(grid.ownerId && grid.ownerId !== state.user?.id)} />
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  live: { flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: palette.surface, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.green },
  liveText: { color: palette.green, fontSize: 11, fontWeight: '900' },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { color: palette.muted, fontSize: 11, marginBottom: 5 },
  gridId: { color: palette.text, fontSize: 16, fontWeight: '900' },
  badge: { backgroundColor: palette.surface2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  badgeText: { color: palette.gold, fontWeight: '900', fontSize: 12 },
  description: { color: palette.muted, fontSize: 13, lineHeight: 20 },
});
