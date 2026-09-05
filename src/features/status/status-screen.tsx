import { loadMiningStatus, MiningStatus } from "@/data/mining-backend";
import {
  ANCHOVY_GRID_COUNT,
  ANCHOVY_REWARD_PER_GRID,
  KING_WHALE_GRID_COUNT,
  KING_WHALE_REWARD_PER_GRID,
  SHRIMP_GRID_COUNT,
  SHRIMP_REWARD_PER_GRID,
  TOTAL_MINE_COUNT,
  TOTAL_PSL_RESERVES,
  WHALE_GRID_COUNT,
  WHALE_REWARD_PER_GRID,
} from "@/domain/mining";
import { useLocale } from "@/state/locale";
import { Card, Header, Screen } from "@/ui/components";
import { palette } from "@/ui/theme";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function StatusScreen() {
  const { t } = useLocale();
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const [status, setStatus] = useState<MiningStatus>({
    totalMiners: 0,
    activeMiners: 0,
    completedMines: 0,
  });
  const rows = [
    [
      t("대왕고래 막장", "King whale mine"),
      KING_WHALE_GRID_COUNT,
      KING_WHALE_REWARD_PER_GRID,
    ],
    [t("고래 막장", "Whale mine"), WHALE_GRID_COUNT, WHALE_REWARD_PER_GRID],
    [t("새우 막장", "Shrimp mine"), SHRIMP_GRID_COUNT, SHRIMP_REWARD_PER_GRID],
    [
      t("멸치 막장", "Anchovy mine"),
      ANCHOVY_GRID_COUNT,
      ANCHOVY_REWARD_PER_GRID,
    ],
  ] as const;
  const availableMineCount = Math.max(
    1,
    TOTAL_MINE_COUNT - status.completedMines - status.activeMiners,
  );
  const odds = (count: number) =>
    `${((count / availableMineCount) * 100).toFixed(6)}%`;
  const refreshStatus = useCallback(async () => {
    const next = await loadMiningStatus();
    if (next) setStatus(next);
    setUpdatedAt(Date.now());
  }, []);
  useEffect(() => {
    void loadMiningStatus()
      .then((next) => {
        if (next) setStatus(next);
        setUpdatedAt(Date.now());
      })
      .catch(console.warn);
  }, []);
  return (
    <Screen>
      <View style={styles.topHeader}>
        <Header
          eyebrow="PSL NETWORK STATUS"
          title={t("채굴 현황", "Mining Status")}
          right={<Text style={styles.updated}>{t("방금 전", "Just now")}</Text>}
        />
      </View>
      <Card style={styles.hero}>
        <Text style={styles.heroLabel}>
          {t("총 PSL 보상", "TOTAL PSL REWARDS")}
        </Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.heroValue}>
          {TOTAL_PSL_RESERVES.toLocaleString()}
        </Text>
        <Text style={styles.symbol}>PSL</Text>
      </Card>
      <Card>
        <Text style={styles.sectionTitle}>
          {t("막장별 보상 현황", "Rewards by mine")}
        </Text>
        <View style={styles.tableHeader}>
          <Cell header wide text={t("구분", "Type")} />
          <Cell header text={t("개수", "Count")} />
          <Cell header text={t("막장당 PSL보상", "PSL per mine")} />
          <Cell header text={t("총 보상", "Total reward")} />
        </View>
        {rows.map(([name, count, reward]) => (
          <View key={name} style={styles.tableRow}>
            <Cell wide text={name} />
            <Cell text={count.toLocaleString()} />
            <Cell text={reward.toLocaleString()} />
            <Cell text={(count * reward).toLocaleString()} />
          </View>
        ))}
        <View style={styles.tableRow}>
          <Cell wide text={t("총 막장", "All mines")} />
          <Cell text={TOTAL_MINE_COUNT.toLocaleString()} />
          <Cell text="" />
          <Cell text="" />
        </View>
        <View style={[styles.tableRow, styles.totalRow]}>
          <Cell wide strong text={t("PSL 보상 총 합계", "PSL reward Total")} />
          <Cell text="" />
          <Cell strong text={TOTAL_PSL_RESERVES.toLocaleString()} />
        </View>
      </Card>
      <Card>
        <Text style={styles.sectionTitle}>
          {t("실시간 채굴자 & 막장 현황", "Live miners & mine status")}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("현황 새로고침", "Refresh status")}
          onPress={refreshStatus}
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && styles.refreshPressed,
          ]}
        >
          <Text key={updatedAt} style={styles.refreshIcon}>
            ↻
          </Text>
        </Pressable>
        <View style={styles.statGrid}>
          <Stat
            label={t("총 채굴자", "Total miners")}
            value={`${status.totalMiners.toLocaleString()}${t("명", "")}`}
          />
          <Stat
            label={t("현재 채굴중", "Currently mining")}
            value={`${status.activeMiners.toLocaleString()}${t("명", "")}`}
          />
          <Stat
            label={t("채굴완료 막장", "Completed mines")}
            value={`${status.completedMines.toLocaleString()}${t("개", "")}`}
          />
          <Stat
            label={t("대왕고래 막장 채굴확률", "King whale odds")}
            value={odds(KING_WHALE_GRID_COUNT)}
          />
          <Stat
            label={t("고래막장 채굴확률", "Whale odds")}
            value={odds(WHALE_GRID_COUNT)}
          />
          <Stat
            label={t("새우막장 채굴확률", "Shrimp odds")}
            value={odds(SHRIMP_GRID_COUNT)}
          />
        </View>
      </Card>
    </Screen>
  );
}
function Cell({
  text,
  header,
  wide,
  strong,
}: {
  text: string;
  header?: boolean;
  wide?: boolean;
  strong?: boolean;
}) {
  return (
    <Text
      style={[
        header ? styles.headerCell : styles.bodyCell,
        wide && styles.nameCell,
        strong && styles.strong,
      ]}
    >
      {text}
    </Text>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.statValue}>
        {value}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  updated: { color: palette.muted, fontSize: 11 },
  topHeader: { marginTop: -6 },
  hero: {
    backgroundColor: palette.hero,
    borderColor: palette.hero,
    alignItems: "center",
    paddingVertical: 28,
  },
  heroLabel: {
    color: palette.mint,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  heroValue: { color: palette.onHero, fontSize: 30, fontWeight: "900" },
  symbol: { color: "#AFA0FF", fontSize: 13, fontWeight: "900" },
  sectionTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
    paddingRight: 42,
  },
  refreshButton: {
    position: "absolute",
    right: 14,
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surface2,
    borderWidth: 1,
    borderColor: palette.border,
  },
  refreshPressed: { opacity: 0.65, transform: [{ rotate: "-20deg" }] },
  refreshIcon: {
    color: palette.goldDark,
    fontSize: 24,
    lineHeight: 27,
    fontWeight: "900",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: palette.surface2,
    borderRadius: 10,
    paddingVertical: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  headerCell: {
    flex: 1,
    color: palette.muted,
    fontSize: 9,
    fontWeight: "900",
    textAlign: "center",
  },
  bodyCell: {
    flex: 1,
    color: palette.text,
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },
  nameCell: { flex: 1.25 },
  strong: { color: palette.gold, fontWeight: "900" },
  totalRow: {
    marginTop: 8,
    backgroundColor: palette.surface2,
    borderRadius: 12,
    borderBottomWidth: 0,
  },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: {
    width: "48%",
    backgroundColor: palette.surface2,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  statLabel: { color: palette.muted, fontSize: 11 },
  statValue: { color: palette.text, fontSize: 18, fontWeight: "900" },
});
