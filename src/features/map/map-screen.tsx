import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MineMap } from '@/features/map/mine-map';
import { MINE_DEPTH_METERS, TOTAL_MINE_COUNT } from '@/domain/mining';
import { useAppState } from '@/state/app-state';
import { Button, Card } from '@/ui/components';
import { useAppDialog } from '@/ui/app-dialog';
import { palette } from '@/ui/theme';

export function MapScreen() {
  const { state, currentMine, selectGrid, startMining } = useAppState();
  const insets = useSafeAreaInsets();
  const [hasSelectedGrid, setHasSelectedGrid] = useState(false);
  const [focusTarget, setFocusTarget] = useState<{ latitude: number; longitude: number; nonce: number }>();
  const showDialog = useAppDialog();
  const grid = state.selectedGrid;
  const progress = Math.min(100, grid.depthMeters / MINE_DEPTH_METERS * 100);
  const hasMineInfo = hasSelectedGrid && (grid.completed || Boolean(grid.ownerId));
  const blockedByCurrentMine = Boolean(currentMine && currentMine.id !== grid.id && !currentMine.completed);

  function handleStart(latitude?: number, longitude?: number) {
    try {
      startMining(latitude, longitude);
    } catch (error) {
      showDialog({ title: '입장할 수 없습니다', message: error instanceof Error ? error.message : '다시 시도해 주세요.' });
    }
  }

  function handleCurrentMineLocation() {
    if (!currentMine) return;
    selectGrid(currentMine.latitude, currentMine.longitude);
    setHasSelectedGrid(true);
    setFocusTarget({ latitude: currentMine.latitude, longitude: currentMine.longitude, nonce: Date.now() });
  }

  return (
    <View style={styles.screen}>
      <MineMap key={focusTarget?.nonce ?? 0} latitude={grid.latitude} longitude={grid.longitude} mines={state.mines} currentMineId={currentMine?.id} focusTarget={focusTarget} onSelect={(latitude, longitude) => {
        selectGrid(latitude, longitude);
        setHasSelectedGrid(true);
      }} />
      <View pointerEvents="none" style={[styles.titleOverlay, { top: insets.top + 12 }]}>
        <Text style={styles.eyebrow}>PSL MINING PLANET</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>채굴 지도</Text>
          <View style={styles.live}><View style={styles.dot} /><Text style={styles.liveText}>LIVE</Text></View>
        </View>
        <View style={styles.rangeRow}>
          <View style={styles.rangeSwatch} />
          <Text style={styles.rangeText}>채굴 가능 범위 · 전 세계 {TOTAL_MINE_COUNT.toLocaleString()} Grid</Text>
        </View>
      </View>
      <Card style={styles.selectionCard}>
        <View style={styles.gridRow}>
          <View style={styles.gridCopy}>
            <Text style={styles.label}>{hasSelectedGrid ? grid.completed ? '채굴 완료' : grid.ownerId ? `${grid.ownerName ?? '사용자'} 채굴중` : '선택한 100m × 100m 막장' : '채굴할 막장을 선택해 주세요'}</Text>
            <Text numberOfLines={1} style={styles.gridId}>{hasSelectedGrid ? grid.id : '지도를 확대하면 Grid가 표시됩니다'}</Text>
          </View>
          {hasSelectedGrid ? <View style={styles.badge}><Text style={styles.badgeText}>{grid.depthMeters.toFixed(1)} / {MINE_DEPTH_METERS}m</Text></View> : null}
        </View>
        {hasMineInfo ? (
          <View style={styles.mineInfo}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{grid.completed ? '완료 사용자' : '채굴 사용자'}</Text>
              <Text numberOfLines={1} style={styles.infoValue}>{grid.ownerName ?? '사용자'}</Text>
            </View>
            {!grid.completed ? (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>채굴속도</Text>
                <Text style={styles.infoValue}>{grid.miningSpeed?.toFixed(1) ?? '—'}m/hr</Text>
              </View>
            ) : null}
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>현재 채굴률</Text>
              <Text style={[styles.infoValue, grid.completed && styles.closedText]}>{grid.completed ? '폐쇄 · 100%' : `${progress.toFixed(1)}%`}</Text>
            </View>
          </View>
        ) : null}
        <Button
          title={currentMine && !currentMine.completed
            ? '채굴장 위치로 이동'
            : !hasSelectedGrid
            ? '막장을 선택해 주세요'
            : grid.completed
              ? '채굴 완료로 폐쇄된 막장입니다'
              : blockedByCurrentMine
                ? '현재 막장을 먼저 완료하세요'
                : currentMine?.id === grid.id
                  ? '채굴장 위치로 이동'
                  : '여기서 채굴 시작하기'}
          onPress={currentMine && !currentMine.completed ? handleCurrentMineLocation : () => handleStart()}
          disabled={currentMine && !currentMine.completed ? false : !hasSelectedGrid || grid.completed || blockedByCurrentMine || Boolean(grid.ownerId && grid.ownerId !== state.user?.id)}
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
  rangeRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  rangeSwatch: { width: 12, height: 12, borderRadius: 3, backgroundColor: 'rgba(113,87,255,0.2)', borderWidth: 2, borderColor: palette.gold },
  rangeText: { color: palette.muted, fontSize: 10, fontWeight: '800' },
  selectionCard: { position: 'absolute', left: 14, right: 14, bottom: 14, borderRadius: 20, padding: 14 },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gridCopy: { flex: 1 },
  label: { color: palette.muted, fontSize: 11, marginBottom: 4 },
  gridId: { color: palette.text, fontSize: 14, fontWeight: '900' },
  badge: { backgroundColor: palette.surface2, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  badgeText: { color: palette.gold, fontWeight: '900', fontSize: 11 },
  mineInfo: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: 14, backgroundColor: palette.surface2 },
  infoItem: { flex: 1, minWidth: 0 },
  infoLabel: { color: palette.muted, fontSize: 9, marginBottom: 3 },
  infoValue: { color: palette.text, fontSize: 12, fontWeight: '900' },
  closedText: { color: palette.danger },
});
