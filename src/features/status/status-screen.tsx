import { StyleSheet, Text, View } from 'react-native';

import { PSL_PER_WINNING_GRID, WINNING_GRID_COUNT } from '@/domain/mining';
import { Card, Header, Screen } from '@/ui/components';
import { palette } from '@/ui/theme';

const pickaxeStats = [
  ['다이아몬드', '0', '#8DE1F2'], ['금', '0', '#F4C95D'], ['은', '0', '#C7D0CC'], ['동', '0', '#C98352'], ['쇠', '1', '#7E9187'],
];

export function StatusScreen() {
  return (
    <Screen>
      <Header eyebrow="PSL NETWORK STATUS" title="채굴 현황" right={<Text style={styles.updated}>방금 전</Text>} />
      <Card style={styles.hero}>
        <Text style={styles.heroLabel}>총 채굴 배정량</Text>
        <Text style={styles.heroValue}>{(PSL_PER_WINNING_GRID * WINNING_GRID_COUNT).toLocaleString()}</Text>
        <Text style={styles.symbol}>PSL</Text>
        <View style={styles.split}>
          <View><Text style={styles.smallLabel}>당첨 막장</Text><Text style={styles.smallValue}>888개</Text></View>
          <View><Text style={styles.smallLabel}>막장당 보상</Text><Text style={styles.smallValue}>1억 PSL</Text></View>
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>실시간 네트워크</Text>
        <View style={styles.statGrid}>
          <Stat label="전체 광부" value="1" />
          <Stat label="채굴 중" value="0" />
          <Stat label="완료 막장" value="0" />
          <Stat label="발견된 광맥" value="0 / 888" gold />
        </View>
        <Text style={styles.note}>현재 값은 로컬 MVP 데이터입니다. 운영 버전에서는 서버 집계 API와 연결됩니다.</Text>
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

function Stat({ label, value, gold = false }: { label: string; value: string; gold?: boolean }) {
  return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={[styles.statValue, gold && { color: palette.gold }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  updated: { color: palette.muted, fontSize: 11 },
  hero: { backgroundColor: '#173B2C', borderColor: '#2B5B45', alignItems: 'center', paddingVertical: 28 },
  heroLabel: { color: palette.green, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  heroValue: { color: palette.text, fontSize: 30, fontWeight: '900' },
  symbol: { color: palette.gold, fontSize: 13, fontWeight: '900' },
  split: { marginTop: 12, paddingTop: 18, borderTopColor: '#2B5B45', borderTopWidth: 1, width: '100%', flexDirection: 'row', justifyContent: 'space-around' },
  smallLabel: { color: palette.muted, fontSize: 11, textAlign: 'center' },
  smallValue: { color: palette.text, fontSize: 16, fontWeight: '900', textAlign: 'center', marginTop: 5 },
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '900', marginBottom: 4 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { width: '47%', backgroundColor: palette.surface2, borderRadius: 16, padding: 14, gap: 6 },
  statLabel: { color: palette.muted, fontSize: 11 },
  statValue: { color: palette.text, fontSize: 20, fontWeight: '900' },
  note: { color: palette.muted, fontSize: 11, lineHeight: 17 },
  pickaxeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  pickaxeDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  pickaxeName: { color: palette.text, flex: 1, fontSize: 14, fontWeight: '700' },
  pickaxeValue: { color: palette.muted, fontSize: 13 },
});
