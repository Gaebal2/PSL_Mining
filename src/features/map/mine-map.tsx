import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';

import { GRID_COLUMN_COUNT, GRID_ROW_COUNT, GridMine, gridCenterFromId, gridIdForRewardRank, gridIdFromCoordinate, KING_WHALE_GRID_COUNT, rewardForGridId, RewardType, WHALE_GRID_COUNT } from '@/domain/mining';
import { palette } from '@/ui/theme';

const EARTH_RADIUS = 6_378_137;
const WORLD_WIDTH_METERS = 2 * Math.PI * EARTH_RADIUS;
const WORLD_HEIGHT_METERS = WORLD_WIDTH_METERS / 2;
const GRID_WIDTH_METERS = WORLD_WIDTH_METERS / GRID_COLUMN_COUNT;
const GRID_HEIGHT_METERS = WORLD_HEIGHT_METERS / GRID_ROW_COUNT;
const GRID_VISIBLE_SCALE = Math.max(GRID_WIDTH_METERS, GRID_HEIGHT_METERS) / 10;
const WORLD_CENTER = { latitude: 0, longitude: 0 };
const SPECIAL_REWARD_GRIDS = Array.from({ length: KING_WHALE_GRID_COUNT + WHALE_GRID_COUNT }, (_, rank) => {
  const id = gridIdForRewardRank(rank);
  return { id, reward: rank < KING_WHALE_GRID_COUNT ? 'kingWhale' as const : 'whale' as const, ...gridCenterFromId(id) };
});

type Coordinate = { latitude: number; longitude: number };
type Projected = { x: number; y: number };
type Size = { width: number; height: number };
export type MapContentInsets = { top: number; right: number; bottom: number; left: number };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function toProjected(latitude: number, longitude: number): Projected {
  return { x: EARTH_RADIUS * clamp(longitude, -180, 180) * Math.PI / 180, y: WORLD_HEIGHT_METERS / 2 * Math.sin(clamp(latitude, -90, 90) * Math.PI / 180) };
}

function fromProjected(x: number, y: number): Coordinate {
  return { latitude: Math.asin(clamp(y / (WORLD_HEIGHT_METERS / 2), -1, 1)) * 180 / Math.PI, longitude: clamp(x / EARTH_RADIUS * 180 / Math.PI, -180, 180) };
}

function viewportCenter(size: Size, insets: MapContentInsets) {
  return { x: insets.left + Math.max(0, size.width - insets.left - insets.right) / 2, y: insets.top + Math.max(0, size.height - insets.top - insets.bottom) / 2 };
}

function clampCenter(next: Coordinate, scale: number, size: Size, insets: MapContentInsets) {
  const point = toProjected(next.latitude, next.longitude);
  const halfWidth = Math.min(WORLD_WIDTH_METERS / 2, Math.max(0, size.width - insets.left - insets.right) * scale / 2);
  const halfHeight = Math.min(WORLD_HEIGHT_METERS / 2, Math.max(0, size.height - insets.top - insets.bottom) * scale / 2);
  return fromProjected(clamp(point.x, -WORLD_WIDTH_METERS / 2 + halfWidth, WORLD_WIDTH_METERS / 2 - halfWidth), clamp(point.y, -WORLD_HEIGHT_METERS / 2 + halfHeight, WORLD_HEIGHT_METERS / 2 - halfHeight));
}

function coordinateAtViewport(x: number, y: number, center: Coordinate, scale: number, size: Size, insets: MapContentInsets) {
  const point = toProjected(center.latitude, center.longitude);
  const anchor = viewportCenter(size, insets);
  return fromProjected(point.x + (x - anchor.x) * scale, point.y - (y - anchor.y) * scale);
}

function touchDistance(touches: readonly { pageX: number; pageY: number }[]) {
  return touches.length < 2 ? 0 : Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
}

function touchCenter(touches: readonly { pageX: number; pageY: number }[]) {
  if (!touches.length) return null;
  const total = touches.reduce((result, touch) => ({ x: result.x + touch.pageX, y: result.y + touch.pageY }), { x: 0, y: 0 });
  return { x: total.x / touches.length, y: total.y / touches.length };
}

export function MineMap({ latitude, longitude, mines, currentMineId, currentUserId, showMyCompleted = false, focusTarget, contentInsets, onSelect, onGridVisibilityChange }: {
  latitude: number; longitude: number; mines: Record<string, GridMine>; currentMineId?: string;
  currentUserId?: string; showMyCompleted?: boolean;
  focusTarget?: Coordinate & { nonce: number }; contentInsets: MapContentInsets; onSelect: (lat: number, lng: number) => void;
  onGridVisibilityChange?: (visible: boolean) => void;
}) {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const mapRef = useRef<View>(null);
  const [center, setCenter] = useState<Coordinate>(focusTarget ?? WORLD_CENTER);
  const [scale, setScale] = useState(WORLD_WIDTH_METERS);
  const centerRef = useRef(center);
  const scaleRef = useRef(scale);
  const gesture = useRef({ touchCount: 0, x: 0, y: 0, distance: 0 });
  const mapPageOrigin = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const [pulse] = useState(() => new Animated.Value(0));
  const minimumScale = size.width ? GRID_WIDTH_METERS * 10 / size.width : GRID_WIDTH_METERS;
  const maximumScale = size.width && size.height ? Math.max(WORLD_WIDTH_METERS / Math.max(1, size.width - contentInsets.left - contentInsets.right), WORLD_HEIGHT_METERS / Math.max(1, size.height - contentInsets.top - contentInsets.bottom)) : WORLD_WIDTH_METERS;

  const setViewport = useCallback((nextCenter: Coordinate, nextScale: number) => {
    const boundedScale = clamp(nextScale, minimumScale, maximumScale);
    const boundedCenter = clampCenter(nextCenter, boundedScale, size, contentInsets);
    scaleRef.current = boundedScale; centerRef.current = boundedCenter;
    setScale(boundedScale); setCenter(boundedCenter);
  }, [contentInsets, maximumScale, minimumScale, size]);

  useEffect(() => {
    if (!size.width || !size.height) return;
    setViewport(centerRef.current, scaleRef.current);
  }, [contentInsets, setViewport, size.height, size.width]);

  function handleLayout(event: LayoutChangeEvent) {
    const nextSize = event.nativeEvent.layout;
    setSize(nextSize);
    if (size.width) return;
    const nextMinimum = GRID_WIDTH_METERS * 10 / nextSize.width;
    mapRef.current?.measureInWindow((x, y) => { mapPageOrigin.current = { x, y }; });
    const nextMaximum = Math.max(WORLD_WIDTH_METERS / Math.max(1, nextSize.width - contentInsets.left - contentInsets.right), WORLD_HEIGHT_METERS / Math.max(1, nextSize.height - contentInsets.top - contentInsets.bottom));
    const nextScale = focusTarget ? Math.max(nextMinimum, GRID_WIDTH_METERS / 24) : nextMaximum;
    const nextCenter = clampCenter(focusTarget ?? WORLD_CENTER, nextScale, nextSize, contentInsets);
    scaleRef.current = nextScale; centerRef.current = nextCenter;
    setScale(nextScale); setCenter(nextCenter);
  }

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: 1800, useNativeDriver: true })]));
    animation.start(); return () => animation.stop();
  }, [pulse]);

  // Responder callbacks intentionally read refs so the gesture remains stable while rendering.
  // eslint-disable-next-line react-hooks/refs
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      const touches = event.nativeEvent.touches; const midpoint = touchCenter(touches);
      gesture.current = { touchCount: touches.length, x: midpoint?.x ?? 0, y: midpoint?.y ?? 0, distance: touchDistance(touches) }; moved.current = false;
    },
    onPanResponderMove: (event) => {
      const touches = event.nativeEvent.touches; const midpoint = touchCenter(touches); if (!midpoint) return;
      const previous = gesture.current; const distance = touchDistance(touches);
      if (touches.length !== previous.touchCount) { gesture.current = { touchCount: touches.length, x: midpoint.x, y: midpoint.y, distance }; return; }
      const dx = midpoint.x - previous.x; const dy = midpoint.y - previous.y; const currentScale = scaleRef.current;
      const nextScale = touches.length >= 2 && previous.distance > 0 && distance > 0 ? currentScale * previous.distance / distance : currentScale;
      const point = toProjected(centerRef.current.latitude, centerRef.current.longitude);
      if (Math.abs(dx) > 7 || Math.abs(dy) > 7 || Math.abs(nextScale - currentScale) > currentScale * 0.008) moved.current = true;
      setViewport(fromProjected(point.x - dx * currentScale, point.y + dy * currentScale), nextScale);
      gesture.current = { touchCount: touches.length, x: midpoint.x, y: midpoint.y, distance };
    },
    onPanResponderRelease: (event) => {
      gesture.current.touchCount = 0; if (moved.current || scaleRef.current > GRID_VISIBLE_SCALE) return;
      const localX = event.nativeEvent.pageX - mapPageOrigin.current.x;
      const localY = event.nativeEvent.pageY - mapPageOrigin.current.y;
      const point = coordinateAtViewport(localX, localY, centerRef.current, scaleRef.current, size, contentInsets);
      const cell = gridCenterFromId(gridIdFromCoordinate(point.latitude, point.longitude)); onSelect(cell.latitude, cell.longitude);
    },
    onPanResponderTerminate: () => { gesture.current.touchCount = 0; },
  }), [contentInsets, onSelect, setViewport, size]);

  const projectedCenter = toProjected(center.latitude, center.longitude);
  const anchor = viewportCenter(size, contentInsets);
  const detailed = scale <= GRID_VISIBLE_SCALE;
  useEffect(() => { onGridVisibilityChange?.(detailed); }, [detailed, onGridVisibilityChange]);
  const worldLeft = anchor.x + (-WORLD_WIDTH_METERS / 2 - projectedCenter.x) / scale;
  const worldTop = anchor.y - (WORLD_HEIGHT_METERS / 2 - projectedCenter.y) / scale;
  const worldWidth = WORLD_WIDTH_METERS / scale; const worldHeight = WORLD_HEIGHT_METERS / scale;
  const vertical: number[] = []; const horizontal: number[] = [];
  if (size.width && detailed) {
    const left = projectedCenter.x - anchor.x * scale; const top = projectedCenter.y + anchor.y * scale;
    for (let x = Math.ceil((left + WORLD_WIDTH_METERS / 2) / GRID_WIDTH_METERS) * GRID_WIDTH_METERS - WORLD_WIDTH_METERS / 2; x <= left + size.width * scale; x += GRID_WIDTH_METERS) vertical.push((x - left) / scale);
    for (let y = Math.floor((top + WORLD_HEIGHT_METERS / 2) / GRID_HEIGHT_METERS) * GRID_HEIGHT_METERS - WORLD_HEIGHT_METERS / 2; y >= top - size.height * scale; y -= GRID_HEIGHT_METERS) horizontal.push((top - y) / scale);
  }

  const gridRect = (lat: number, lng: number) => {
    const point = toProjected(lat, lng);
    const gridX = Math.floor((point.x + WORLD_WIDTH_METERS / 2) / GRID_WIDTH_METERS) * GRID_WIDTH_METERS - WORLD_WIDTH_METERS / 2;
    const gridY = Math.floor((point.y + WORLD_HEIGHT_METERS / 2) / GRID_HEIGHT_METERS) * GRID_HEIGHT_METERS - WORLD_HEIGHT_METERS / 2;
    return { left: anchor.x + (gridX - projectedCenter.x) / scale, top: anchor.y - (gridY + GRID_HEIGHT_METERS - projectedCenter.y) / scale, width: GRID_WIDTH_METERS / scale, height: GRID_HEIGHT_METERS / scale };
  };
  const selectedRect = gridRect(latitude, longitude);
  const rewardDots: { id: string; reward: Exclude<RewardType, 'hidden' | 'empty' | 'anchovy'>; left: number; top: number }[] = [];
  if (detailed && size.width && size.height) {
    const visibleLeft = projectedCenter.x - anchor.x * scale;
    const visibleRight = projectedCenter.x + (size.width - anchor.x) * scale;
    const visibleTop = projectedCenter.y + anchor.y * scale;
    const visibleBottom = projectedCenter.y - (size.height - anchor.y) * scale;
    const firstColumn = clamp(Math.floor((visibleLeft + WORLD_WIDTH_METERS / 2) / GRID_WIDTH_METERS), 0, GRID_COLUMN_COUNT - 1);
    const lastColumn = clamp(Math.floor((visibleRight + WORLD_WIDTH_METERS / 2) / GRID_WIDTH_METERS), 0, GRID_COLUMN_COUNT - 1);
    const firstRow = clamp(Math.floor((visibleBottom + WORLD_HEIGHT_METERS / 2) / GRID_HEIGHT_METERS), 0, GRID_ROW_COUNT - 1);
    const lastRow = clamp(Math.floor((visibleTop + WORLD_HEIGHT_METERS / 2) / GRID_HEIGHT_METERS), 0, GRID_ROW_COUNT - 1);
    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        const id = `G-${column}-${row}`;
        const reward = rewardForGridId(id);
        if (reward !== 'shrimp') continue;
        const center = gridCenterFromId(id);
        const rect = gridRect(center.latitude, center.longitude);
        rewardDots.push({ id, reward, left: rect.left + rect.width / 2, top: rect.top + rect.height / 2 });
      }
    }
  }
  const currentMine = currentMineId ? mines[currentMineId] : undefined;
  const visibleMines = Object.values(mines).filter((mine) => mine.id !== currentMineId && (!showMyCompleted || mine.completedByUserId !== currentUserId) && detailed && (mine.completed || Boolean(mine.ownerId))).map((mine) => ({ mine, ...gridRect(mine.latitude, mine.longitude) })).filter(({ left, top }) => left > -80 && left < size.width + 80 && top > -40 && top < size.height + 40);
  const myCompletedMines = showMyCompleted && currentUserId
    ? Object.values(mines).filter((mine) => mine.completed && mine.completedByUserId === currentUserId).map((mine) => ({ mine, ...gridRect(mine.latitude, mine.longitude) })).filter(({ left, top }) => left > -80 && left < size.width + 80 && top > -40 && top < size.height + 40)
    : [];
  const currentPoint = currentMine ? toProjected(currentMine.latitude, currentMine.longitude) : null;
  const currentLeft = currentPoint ? anchor.x + (currentPoint.x - projectedCenter.x) / scale : 0;
  const currentTop = currentPoint ? anchor.y - (currentPoint.y - projectedCenter.y) / scale : 0;
  const specialRewardDots = SPECIAL_REWARD_GRIDS.map((rewardGrid) => {
    const point = toProjected(rewardGrid.latitude, rewardGrid.longitude);
    return { ...rewardGrid, left: anchor.x + (point.x - projectedCenter.x) / scale, top: anchor.y - (point.y - projectedCenter.y) / scale };
  }).filter((dot) => dot.left >= -8 && dot.left <= size.width + 8 && dot.top >= -8 && dot.top <= size.height + 8);

  return <View ref={mapRef}
    style={styles.wrap}
    onLayout={handleLayout}
    {...responder.panHandlers}>
    <Image source={require('../../../assets/images/mine-world-map.png')} resizeMode="stretch" style={[styles.worldMap, { left: worldLeft, top: worldTop, width: worldWidth, height: worldHeight }]} />
    {detailed ? <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {vertical.filter((left) => left >= worldLeft && left <= worldLeft + worldWidth).map((left) => <View key={`v-${left}`} style={[styles.vertical, { left, top: worldTop, height: worldHeight }]} />)}
      {horizontal.filter((top) => top >= worldTop && top <= worldTop + worldHeight).map((top) => <View key={`h-${top}`} style={[styles.horizontal, { top, left: worldLeft, width: worldWidth }]} />)}
      <View style={[styles.selected, selectedRect]} />
      {rewardDots.map((dot) => <View key={`reward-${dot.id}`} style={[styles.rewardDot, styles[`${dot.reward}Dot`], { left: dot.left - 4, top: dot.top - 4 }]} />)}
      {visibleMines.map(({ mine, left, top, width, height }) => <MineMarker key={mine.id} mine={mine} left={left} top={top} width={width} height={height} />)}
    </View> : null}
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {specialRewardDots.map((dot) => <View key={`special-${dot.id}`} style={[styles.specialRewardDot, styles[`${dot.reward}Dot`], { left: dot.left - 4, top: dot.top - 4 }]} />)}
      {myCompletedMines.map(({ mine, left, top, width, height }) => <MineMarker key={`mine-completed-${mine.id}`} mine={mine} left={left} top={top} width={width} height={height} />)}
    </View>
    {currentMine && currentPoint ? <View pointerEvents="none" style={[styles.currentMine, { left: currentLeft - 24, top: currentTop - 24 }]}>
      <Animated.View style={[styles.currentPulse, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.38, 0.08] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.45] }) }] }]} />
      <Image source={require('../../../assets/images/tab-mine.png')} resizeMode="contain" style={styles.currentMineImage} />
    </View> : null}
  </View>;
}

function MineMarker({ mine, left, top, width, height }: { mine: GridMine; left: number; top: number; width: number; height: number }) {
  const markerSize = clamp(Math.min(width, height) * 0.78, 12, 46);
  return <View style={[styles.mineMarker, { left: left + width / 2 - markerSize / 2, top: top + height / 2 - markerSize / 2, width: markerSize, height: markerSize }]}><Image source={mine.completed ? require('../../../assets/images/mine-closed.png') : require('../../../assets/images/tab-mine.png')} resizeMode="contain" style={styles.mineMarkerImage} /></View>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: '#17283E' }, worldMap: { position: 'absolute' },
  vertical: { position: 'absolute', width: 1, backgroundColor: 'rgba(240,185,11,0.78)' }, horizontal: { position: 'absolute', height: 1, backgroundColor: 'rgba(240,185,11,0.78)' },
  selected: { position: 'absolute', borderWidth: 3, borderColor: '#FFD659', backgroundColor: 'rgba(240,185,11,0.28)', zIndex: 2 },
  rewardDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(20,20,20,0.5)', zIndex: 5, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 2, elevation: 5 },
  specialRewardDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(20,20,20,0.6)', zIndex: 7, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 2, elevation: 7 },
  kingWhaleDot: { backgroundColor: '#F04444' },
  whaleDot: { backgroundColor: '#FFD83D' },
  shrimpDot: { backgroundColor: '#FFFFFF' },
  mineMarker: { position: 'absolute', alignItems: 'center', justifyContent: 'center', zIndex: 4 }, mineMarkerImage: { width: '100%', height: '100%' },
  currentMine: { position: 'absolute', width: 48, height: 48, alignItems: 'center', justifyContent: 'center', zIndex: 8 }, currentPulse: { position: 'absolute', width: 46, height: 46, borderRadius: 23, backgroundColor: palette.gold }, currentMineImage: { width: 36, height: 36 },
});
