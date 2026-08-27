import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MineMap } from '@/features/map/mine-map';
import { MINE_DEPTH_METERS } from '@/domain/mining';
import { useAppState } from '@/state/app-state';
import { Button, Card } from '@/ui/components';
import { palette } from '@/ui/theme';

export function MapScreen() {
  const { state, currentMine, selectGrid, startMining } = useAppState();
  const insets = useSafeAreaInsets();
  const [hasSelectedGrid, setHasSelectedGrid] = useState(false);
  const grid = state.selectedGrid;

  function handleStart(latitude?: number, longitude?: number) {
    try {
      startMining(latitude, longitude);
    } catch (error) {
      Alert.alert('입장할 수 없습니다', error instanceof Error ? error.message : '다시 시도해 주세요.');
    }
  }

  return (
    <View style={styles.screen}>
      <MineMap latitude={grid.latitude} longitude={grid.longitude} onSelect={(latitude, longitude) => {
        selectGrid(latitude, longitude);
        setHasSelectedGrid(true);
      }} />
      <View pointerEvents="none" style={[styles.titleOverlay, { top: insets.top + 12 }]}>
        <Text style={styles.eyebrow}>PSL MINING PLANET</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>채굴 지도</Text>
          <View style={styles.live}><View style={styles.dot} /><Text style={styles.liveText}>LIVE</Text></View>
        </View>
      </View>
      <Card style={styles.selectionCard}>
        <View style={styles.gridRow}>
          <View style={styles.gridCopy}>
            <Text style={styles.label}>{hasSelectedGrid ? '선택한 100m × 100m 막장' : '채굴할 막장을 선택해 주세요'}</Text>
            <Text numberOfLines={1} style={styles.gridId}>{hasSelectedGrid ? grid.id : '지도를 확대하면 Grid가 표시됩니다'}</Text>
          </View>
          {hasSelectedGrid ? <View style={styles.badge}><Text style={styles.badgeText}>{grid.depthMeters.toFixed(1)} / {MINE_DEPTH_METERS}m</Text></View> : null}
        </View>
        <Button
          title={!hasSelectedGrid ? '막장을 선택해 주세요' : currentMine && currentMine.id !== grid.id ? '여기서 채굴 다시 시작하기' : '여기서 채굴 시작하기'}
          onPress={() => handleStart()}
          disabled={!hasSelectedGrid || grid.completed || Boolean(grid.ownerId && grid.ownerId !== state.user?.id)}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  titleOverlay: { position: 'absolute', left: 18, right: 18, backgroundColor: 'rgba(255,255,255,0.94)', borderColor: palette.border, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12 },
  eyebrow: { color: palette.gold, fontSize: 10, letterSpacing: 1.8, fontWeight: '800' },
  titleRow: { marginTop: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: palette.text, fontSize: 24, fontWeight: '900' },
  live: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.green },
  liveText: { color: palette.green, fontSize: 11, fontWeight: '900' },
  selectionCard: { position: 'absolute', left: 14, right: 14, bottom: 14, borderRadius: 20, padding: 14 },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gridCopy: { flex: 1 },
  label: { color: palette.muted, fontSize: 11, marginBottom: 4 },
  gridId: { color: palette.text, fontSize: 14, fontWeight: '900' },
  badge: { backgroundColor: palette.surface2, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  badgeText: { color: palette.gold, fontWeight: '900', fontSize: 11 },
});
