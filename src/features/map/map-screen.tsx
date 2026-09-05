import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  createGrid,
  gridCenterFromId,
  gridIdFromCoordinate,
  MINE_DEPTH_METERS,
} from "@/domain/mining";
import { MineMap } from "@/features/map/mine-map";
import { showRewardedAd } from "@/lib/rewarded-ad";
import { useAppState } from "@/state/app-state";
import { useLocale } from "@/state/locale";
import { useAppDialog } from "@/ui/app-dialog";
import { Button, Card } from "@/ui/components";
import { palette } from "@/ui/theme";

export function MapScreen() {
  const params = useLocalSearchParams<{ selectedGridId?: string | string[] }>();
  const { state, currentMine, selectGrid, startMining } = useAppState();
  const insets = useSafeAreaInsets();
  const [hasSelectedGrid, setHasSelectedGrid] = useState(false);
  const [showMyCompleted, setShowMyCompleted] = useState(false);
  const [selectedGridId, setSelectedGridId] = useState<string>();
  const [focusTarget, setFocusTarget] = useState<{
    latitude: number;
    longitude: number;
    nonce: number;
  }>();
  const [titleHeight, setTitleHeight] = useState(116);
  const [cardHeight, setCardHeight] = useState(164);
  const contentInsets = useMemo(
    () => ({
      top: insets.top + 12 + titleHeight + 12,
      right: 32,
      bottom: cardHeight + 28,
      left: 32,
    }),
    [cardHeight, insets.top, titleHeight],
  );
  const showDialog = useAppDialog();
  const { t } = useLocale();
  const routeSelectedGridId = Array.isArray(params.selectedGridId)
    ? params.selectedGridId[0]
    : params.selectedGridId;

  useEffect(() => {
    if (!routeSelectedGridId) return;
    const timer = setTimeout(() => {
      const center = gridCenterFromId(routeSelectedGridId);
      selectGrid(center.latitude, center.longitude);
      setSelectedGridId(routeSelectedGridId);
      setHasSelectedGrid(true);
      setFocusTarget({ ...center, nonce: Date.now() });
    }, 0);
    return () => clearTimeout(timer);
    // The route value is the navigation event; selectGrid is recreated with app state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeSelectedGridId]);
  const grid = selectedGridId
    ? (state.mines[selectedGridId] ??
      (state.selectedGrid.id === selectedGridId
        ? state.selectedGrid
        : (() => {
            const center = gridCenterFromId(selectedGridId);
            return createGrid(center.latitude, center.longitude);
          })()))
    : state.selectedGrid;
  const progress = Math.min(100, (grid.depthMeters / MINE_DEPTH_METERS) * 100);
  const hasMineInfo =
    hasSelectedGrid && (grid.completed || Boolean(grid.ownerId));
  const blockedByCurrentMine = Boolean(
    currentMine && currentMine.id !== grid.id && !currentMine.completed,
  );

  function handleStart(latitude?: number, longitude?: number) {
    if (!state.user?.piVerified) {
      showDialog({
        title: t("Pi 지갑 인증 필요", "Pi wallet verification required"),
        message: t(
          "Pi 지갑 소유권이 인증되어야 채굴이 가능합니다.",
          "You must verify ownership of your Pi wallet before mining.",
        ),
        actions: [
          { text: t("취소", "Cancel"), style: "cancel" },
          {
            text: t("인증하기", "Verify"),
            onPress: () => router.push("/(tabs)/profile"),
          },
        ],
      });
      return;
    }
    showDialog({
      title: t("리워드 광고", "Rewarded ad"),
      message: t(
        "광고를 끝까지 시청하면 선택한 Grid에서 채굴을 시작합니다.",
        "Mining starts in the selected Grid after you watch the full ad.",
      ),
      actions: [
        { text: t("취소", "Cancel"), style: "cancel" },
        {
          text: t("광고 시청", "Watch ad"),
          onPress: async () => {
            try {
              await showRewardedAd();
              await startMining(latitude, longitude);
            } catch (error) {
              showDialog({
                title: t("입장할 수 없습니다", "Unable to enter"),
                message:
                  error instanceof Error
                    ? error.message
                    : t("다시 시도해 주세요.", "Please try again."),
              });
            }
          },
        },
      ],
    });
  }

  function handleCurrentMineLocation() {
    if (!currentMine) return;
    selectGrid(currentMine.latitude, currentMine.longitude);
    setSelectedGridId(currentMine.id);
    setHasSelectedGrid(true);
    setFocusTarget({
      latitude: currentMine.latitude,
      longitude: currentMine.longitude,
      nonce: Date.now(),
    });
  }

  function handleGridVisibilityChange(visible: boolean) {
    if (visible) return;
    setHasSelectedGrid(false);
    setSelectedGridId(undefined);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.mapViewport}>
        <MineMap
          key={focusTarget?.nonce ?? 0}
          latitude={grid.latitude}
          longitude={grid.longitude}
          mines={state.mines}
          currentMineId={currentMine?.id}
          currentUserId={state.user?.id}
          showMyCompleted={showMyCompleted}
          focusTarget={focusTarget}
          contentInsets={contentInsets}
          onGridVisibilityChange={handleGridVisibilityChange}
          onSelect={(latitude, longitude) => {
            setSelectedGridId(gridIdFromCoordinate(latitude, longitude));
            selectGrid(latitude, longitude);
            setHasSelectedGrid(true);
          }}
        />
      </View>
      <View
        pointerEvents="none"
        onLayout={(event) => setTitleHeight(event.nativeEvent.layout.height)}
        style={[styles.titleOverlay, { top: insets.top + 12 }]}
      >
        <Text style={styles.eyebrow}>PSL MINING PLANET</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t("채굴 지도", "Mining Map")}</Text>
          <View style={styles.live}>
            <View style={styles.dot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>
      </View>
      <View
        onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
        style={styles.selectionCard}
      >
        <Card>
          <View style={styles.gridRow}>
            <View style={styles.gridCopy}>
              {hasSelectedGrid && (grid.completed || grid.ownerId) ? (
                <Text style={styles.label}>
                  {grid.completed
                    ? t("채굴 완료", "Mining complete")
                    : grid.ownerId === state.user?.id
                      ? t("내가 채굴중인 막장", "Your active mine")
                      : t(
                          "다른 사용자가 채굴중인 막장",
                          "Another miner is active here",
                        )}
                </Text>
              ) : !hasSelectedGrid ? (
                <Text style={styles.label}>
                  {t(
                    "채굴할 막장을 선택해 주세요",
                    "Select a mine to start mining",
                  )}
                </Text>
              ) : null}
              <Text numberOfLines={1} style={styles.gridId}>
                {hasSelectedGrid
                  ? grid.id
                  : t(
                      "지도를 확대하면 Grid가 표시됩니다",
                      "Zoom in to display the Grid",
                    )}
              </Text>
            </View>
            <View style={styles.completedToggle}>
              <Text style={styles.completedToggleText}>
                {t("내가 채굴완료한 막장", "Mines I completed")}
              </Text>
              <Switch
                value={showMyCompleted}
                onValueChange={setShowMyCompleted}
                trackColor={{ false: palette.border, true: "#7257F5" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
          {hasMineInfo ? (
            <View style={styles.mineInfo}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>
                  {grid.completed
                    ? t("완료 사용자", "Completed by")
                    : t("채굴 사용자", "Miner")}
                </Text>
                <Text numberOfLines={1} style={styles.infoValue}>
                  {grid.ownerName ?? "사용자"}
                </Text>
              </View>
              {!grid.completed ? (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>
                    {t("채굴속도", "Mining speed")}
                  </Text>
                  <Text style={styles.infoValue}>
                    {grid.miningSpeed?.toFixed(1) ?? "—"}m/hr
                  </Text>
                </View>
              ) : null}
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>
                  {t("현재 채굴률", "Current progress")}
                </Text>
                <Text
                  style={[
                    styles.infoValue,
                    grid.completed && styles.closedText,
                  ]}
                >
                  {grid.completed ? "폐쇄 · 100%" : `${progress.toFixed(1)}%`}
                </Text>
              </View>
            </View>
          ) : null}
          <Button
            title={
              !hasSelectedGrid
                ? currentMine
                  ? t("채굴장 위치로 이동", "Go to current mine")
                  : t("막장을 선택해 주세요", "Select a mine")
                : grid.completed
                  ? t(
                      "채굴 완료로 폐쇄된 막장입니다",
                      "This mine is closed after completion",
                    )
                  : currentMine?.id === grid.id
                    ? t("채굴장 위치로 이동", "Go to current mine")
                    : blockedByCurrentMine
                      ? t(
                          "현재 막장을 먼저 완료하세요",
                          "Complete your current mine first",
                        )
                      : t("여기서 채굴 시작하기", "Start mining here")
            }
            onPress={
              !hasSelectedGrid && currentMine
                ? handleCurrentMineLocation
                : currentMine?.id === grid.id
                  ? handleCurrentMineLocation
                  : () => handleStart(grid.latitude, grid.longitude)
            }
            disabled={
              (!hasSelectedGrid && !currentMine) ||
              (hasSelectedGrid &&
                (grid.completed ||
                  blockedByCurrentMine ||
                  Boolean(grid.ownerId && grid.ownerId !== state.user?.id)))
            }
          />
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  mapViewport: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  titleOverlay: {
    position: "absolute",
    left: 18,
    right: 18,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  eyebrow: {
    color: palette.gold,
    fontSize: 10,
    letterSpacing: 1.8,
    fontWeight: "800",
  },
  titleRow: {
    marginTop: 3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: palette.text, fontSize: 24, fontWeight: "900" },
  live: { flexDirection: "row", gap: 7, alignItems: "center" },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.green },
  liveText: { color: palette.green, fontSize: 11, fontWeight: "900" },
  selectionCard: { position: "absolute", left: 14, right: 14, bottom: 14 },
  gridRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  gridCopy: { flex: 1 },
  label: { color: palette.muted, fontSize: 11, marginBottom: 4 },
  gridId: { color: palette.text, fontSize: 14, fontWeight: "900" },
  completedToggle: { alignItems: "flex-end", gap: 2 },
  completedToggleText: { color: "#7257F5", fontWeight: "900", fontSize: 10 },
  mineInfo: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: palette.surface2,
  },
  infoItem: { flex: 1, minWidth: 0 },
  infoLabel: { color: palette.muted, fontSize: 9, marginBottom: 3 },
  infoValue: { color: palette.text, fontSize: 12, fontWeight: "900" },
  closedText: { color: palette.danger },
});
