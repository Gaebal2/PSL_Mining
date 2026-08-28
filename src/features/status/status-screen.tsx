import { StyleSheet, Text, View } from 'react-native';

import { GENERAL_REWARD_GRID_COUNT, GENERAL_REWARD_PER_GRID, TOTAL_MINE_COUNT, TOTAL_PSL_RESERVES, WINNING_GRID_COUNT } from '@/domain/mining';
import { useAppState } from '@/state/app-state';
import { Card, Header, Screen } from '@/ui/components';
import { palette } from '@/ui/theme';

const pickaxeStats = [
  ['다이아몬드', '0', '#8DE1F2'],
  ['금', '0', '#7157FF'],
  ['은', '0', '#C7D0CC'],
  ['동', '0', '#C98352'],
  ['철', '1', '#7E9187'],
];

export function StatusScreen() {
  const { state } = useAppState();
  const mines = Object.values(state.mines);
  const completedMineCount = mines.filter((mine) => mine.completed).length;
  const completedGeneralRewardCount = mines.filter((mine) => mine.completed && mine.reward === 'general').length;
  const activeMineCount = mines.filter((mine) => mine.ownerId && !mine.completed).length;

  return (
    <Screen>
      <Header eyebrow="PSL NETWORK STATUS" title="채굴 현황" right={<Text style={styles.updated}>방금 전</Text>} />
      <Card style={styles.hero}>
        <Text style={styles.heroLabel}>총 매장량</Text>
        <Text style={styles.heroValue}>{TOTAL_PSL_RESERVES.toLocaleString()}</Text>
        <Text style={styles.symbol}>PSL</Text>
        <View style={styles.split}>
          <View><Text style={styles.smallLabel}>행운 막장</Text><Text style={styles.smallValue}>{WINNING_GRID_COUNT.toLocaleString()}개</Text></View>
          <View><Text style={styles.smallLabel}>막장당 보상</Text><Text style={styles.smallValue}>1억 PSL</Text></View>
        </View>
        <View style={styles.rewardTier}>
          <View><Text style={styles.smallLabel}>일반 보상 막장</Text><Text style={styles.smallValue}>{GENERAL_REWARD_GRID_COUNT.toLocaleString()}개</Text></View>
          <View><Text style={styles.smallLabel}>막장당 보상</Text><Text style={styles.smallValue}>{GENERAL_REWARD_PER_GRID} PSL</Text></View>
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>실시간 네트워크</Text>
        <View style={styles.statGrid}>
          <Stat label="총 막장" value={`${TOTAL_MINE_COUNT.toLocaleString()}개`} />
          <Stat label="채굴 완료 막장" value={completedMineCount.toLocaleString()} />
          <Stat label="채굴 중" value={activeMineCount.toLocaleString()} />
          <Stat label="발견된 광맥" value={`0 / ${WINNING_GRID_COUNT}`} gold />
          <Stat label="일반 보상 막장" value={`${completedGeneralRewardCount.toLocaleString()} / ${GENERAL_REWARD_GRID_COUNT.toLocaleString()}`} compact />
        </View>
        <Text style={styles.note}>총 막장은 지구 전체 표면을 51,010,000,000개 구역으로 빠짐없이 나눈 값입니다. 각 막장 ID와 보상 위치는 로컬에서도 항상 동일하며 운영 버전에서는 서버 집계 API와 연결됩니다.</Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>곡괭이 분포</Text>
        {pickaxeStats.map(([name, value, color]) => (
          <View key={name} style={styles.pickaxeRow}>
            <View style={[styles.pickaxeDot, { backgroundColor: color }]} />
            <Text style={styles.pickaxeName}>{name}</Text>
            <Text style={styles.pickaxeValue}>{value}명</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

function Stat({ label, value, gold = false, compact = false }: { label: string; value: string; gold?: boolean; compact?: boolean }) {
  return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68} style={[styles.statValue, compact && styles.compactStatValue, gold && { color: palette.gold }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  updated: { color: palette.muted, fontSize: 11 },
  hero: { backgroundColor: palette.hero, borderColor: palette.hero, alignItems: 'center', paddingVertical: 28 },
  heroLabel: { color: palette.mint, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  heroValue: { color: palette.onHero, fontSize: 30, fontWeight: '900' },
  symbol: { color: '#AFA0FF', fontSize: 13, fontWeight: '900' },
  split: { marginTop: 12, paddingTop: 18, borderTopColor: '#4A435F', borderTopWidth: 1, width: '100%', flexDirection: 'row', justifyContent: 'space-around' },
  rewardTier: { marginTop: 14, paddingTop: 14, borderTopColor: '#4A435F', borderTopWidth: 1, width: '100%', flexDirection: 'row', justifyContent: 'space-around' },
  smallLabel: { color: '#C8C4D8', fontSize: 11, textAlign: 'center' },
  smallValue: { color: palette.onHero, fontSize: 16, fontWeight: '900', textAlign: 'center', marginTop: 5 },
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '900', marginBottom: 4 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { width: '47%', backgroundColor: palette.surface2, borderRadius: 16, padding: 14, gap: 6 },
  statLabel: { color: palette.muted, fontSize: 11 },
  statValue: { color: palette.text, fontSize: 18, fontWeight: '900' },
  compactStatValue: { fontSize: 16 },
  note: { color: palette.muted, fontSize: 11, lineHeight: 17 },
  pickaxeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  pickaxeDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  pickaxeName: { color: palette.text, flex: 1, fontSize: 14, fontWeight: '700' },
  pickaxeValue: { color: palette.muted, fontSize: 13 },
});
