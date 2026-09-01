import { StyleSheet, Text, View } from 'react-native';

import { ANCHOVY_GRID_COUNT, ANCHOVY_REWARD_PER_GRID, KING_WHALE_GRID_COUNT, KING_WHALE_REWARD_PER_GRID, SHRIMP_GRID_COUNT, SHRIMP_REWARD_PER_GRID, TOTAL_MINE_COUNT, TOTAL_PSL_RESERVES, WHALE_GRID_COUNT, WHALE_REWARD_PER_GRID } from '@/domain/mining';
import { useAppState } from '@/state/app-state';
import { useLocale } from '@/state/locale';
import { Card, Header, Screen } from '@/ui/components';
import { palette } from '@/ui/theme';

const TOTAL_REWARD = TOTAL_PSL_RESERVES;
export function StatusScreen() {
  const { state } = useAppState();
  const { t } = useLocale();
  const rewardRows = [
    { name: t('대왕고래 막장', 'King whale mine'), count: KING_WHALE_GRID_COUNT, reward: KING_WHALE_REWARD_PER_GRID.toLocaleString(), total: (KING_WHALE_GRID_COUNT * KING_WHALE_REWARD_PER_GRID).toLocaleString() },
    { name: t('고래 막장', 'Whale mine'), count: WHALE_GRID_COUNT, reward: WHALE_REWARD_PER_GRID.toLocaleString(), total: (WHALE_GRID_COUNT * WHALE_REWARD_PER_GRID).toLocaleString() },
    { name: t('새우 막장', 'Shrimp mine'), count: SHRIMP_GRID_COUNT, reward: SHRIMP_REWARD_PER_GRID.toLocaleString(), total: (SHRIMP_GRID_COUNT * SHRIMP_REWARD_PER_GRID).toLocaleString() },
    { name: t('멸치 막장', 'Anchovy mine'), count: ANCHOVY_GRID_COUNT, reward: ANCHOVY_REWARD_PER_GRID.toLocaleString(), total: (ANCHOVY_GRID_COUNT * ANCHOVY_REWARD_PER_GRID).toLocaleString() },
  ];
  const mines = Object.values(state.mines);
  const completedMineCount = mines.filter((mine) => mine.completed).length;
  const activeMineCount = mines.filter((mine) => mine.ownerId && !mine.completed).length;

  return (
    <Screen>
      <View style={styles.topHeader}><Header eyebrow="PSL NETWORK STATUS" title={t('채굴 현황', 'Mining Status')} right={<Text style={styles.updated}>{t('방금 전', 'Just now')}</Text>} /></View>
      <Card style={styles.hero}>
        <Text style={styles.heroLabel}>{t('총 PSL 보상', 'TOTAL PSL REWARDS')}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.heroValue}>{TOTAL_REWARD.toLocaleString()}</Text>
        <Text style={styles.symbol}>PSL</Text>
      </Card>
      <Card>
        <Text style={styles.sectionTitle}>{t('막장별 보상 현황', 'Rewards by mine')}</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, styles.nameCell]}>{t('구분', 'Type')}</Text><Text style={styles.headerCell}>{t('개수', 'Count')}</Text><Text style={styles.headerCell}>{t('막장 당 PSL', 'PSL/mine')}</Text><Text style={styles.headerCell}>{t('총 보상', 'Total')}</Text>
        </View>
        {rewardRows.map((row) => <View key={row.name} style={styles.tableRow}>
          <Text style={[styles.bodyCell, styles.nameCell]}>{row.name}</Text><Text style={styles.bodyCell}>{row.count.toLocaleString()}</Text><Text style={styles.bodyCell}>{row.reward}</Text><Text style={styles.bodyCell}>{row.total}</Text>
        </View>)}
        <View style={styles.tableRow}>
          <Text style={[styles.bodyCell, styles.nameCell]}>{t('총 막장', 'All mines')}</Text><Text style={styles.bodyCell}>{TOTAL_MINE_COUNT.toLocaleString()}</Text><Text style={styles.bodyCell}>-</Text><Text style={styles.bodyCell}>-</Text>
        </View>
        <View style={styles.totalRow}><Text style={styles.totalLabel}>{t('합계', 'Total')}</Text><Text style={styles.totalValue}>{TOTAL_REWARD.toLocaleString()} PSL</Text></View>
      </Card>
      <Card>
        <Text style={styles.sectionTitle}>{t('실시간 테스트 데이터', 'Live test data')}</Text>
        <View style={styles.statGrid}><Stat label={t('채굴 완료 막장', 'Completed mines')} value={completedMineCount.toLocaleString()} /><Stat label={t('채굴 중', 'Mining')} value={activeMineCount.toLocaleString()} /></View>
        <Text style={styles.note}>{t('G-102956-46950 부근의 채굴 완료 막장 20개가 지도 확인용 데이터에 포함되어 있습니다.', 'The map test data includes 20 completed mines near G-102956-46950.')}</Text>
      </Card>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  updated: { color: palette.muted, fontSize: 11 },
  topHeader: { marginTop: -6 },
  hero: { backgroundColor: palette.hero, borderColor: palette.hero, alignItems: 'center', paddingVertical: 28 },
  heroLabel: { color: palette.mint, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  heroValue: { color: palette.onHero, fontSize: 30, fontWeight: '900' },
  symbol: { color: '#AFA0FF', fontSize: 13, fontWeight: '900' },
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '900', marginBottom: 10 },
  tableHeader: { flexDirection: 'row', backgroundColor: palette.surface2, borderRadius: 10, paddingVertical: 8 },
  tableRow: { flexDirection: 'row', borderBottomColor: palette.border, borderBottomWidth: 1, paddingVertical: 10 },
  headerCell: { flex: 1, color: palette.muted, fontSize: 9, fontWeight: '900', textAlign: 'center' },
  bodyCell: { flex: 1, color: palette.text, fontSize: 9, fontWeight: '700', textAlign: 'center' },
  nameCell: { flex: 1.25 },
  totalRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: palette.surface2, borderRadius: 12, padding: 12 },
  totalLabel: { color: palette.text, fontWeight: '900' },
  totalValue: { color: palette.gold, fontWeight: '900' },
  statGrid: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: palette.surface2, borderRadius: 16, padding: 14, gap: 6 },
  statLabel: { color: palette.muted, fontSize: 11 },
  statValue: { color: palette.text, fontSize: 18, fontWeight: '900' },
  note: { marginTop: 10, color: palette.muted, fontSize: 11, lineHeight: 17 },
});
