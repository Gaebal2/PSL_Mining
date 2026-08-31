import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from 'react-native';

import { GRID_COLUMN_COUNT, GRID_ROW_COUNT, GridMine, gridCenterFromId, gridIdFromCoordinate } from '@/domain/mining';
import { palette } from '@/ui/theme';

const EARTH_RADIUS = 6_378_137;
const WORLD_WIDTH_METERS = 2 * Math.PI * EARTH_RADIUS;
const WORLD_HEIGHT_METERS = WORLD_WIDTH_METERS / 2;
const GRID_WIDTH_METERS = WORLD_WIDTH_METERS / GRID_COLUMN_COUNT;
const GRID_HEIGHT_METERS = WORLD_HEIGHT_METERS / GRID_ROW_COUNT;
const GRID_VISIBLE_SCALE = Math.max(GRID_WIDTH_METERS, GRID_HEIGHT_METERS) / 10;
const OTHER_MINES_VISIBLE_SCALE = Math.max(GRID_WIDTH_METERS, GRID_HEIGHT_METERS) / 14;
const WORLD_CENTER = { latitude: 0, longitude: 0 };

type Coordinate = { latitude: number; longitude: number };
type Projected = { x: number; y: number };
type Size = { width: number; height: number };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function toProjected(latitude: number, longitude: number): Projected {
  return { x: EARTH_RADIUS * clamp(longitude, -180, 180) * Math.PI / 180, y: WORLD_HEIGHT_METERS / 2 * Math.sin(clamp(latitude, -90, 90) * Math.PI / 180) };
}

function fromProjected(x: number, y: number): Coordinate {
  return { latitude: Math.asin(clamp(y / (WORLD_HEIGHT_METERS / 2), -1, 1)) * 180 / Math.PI, longitude: clamp(x / EARTH_RADIUS * 180 / Math.PI, -180, 180) };
}

function clampCenter(next: Coordinate, scale: number, size: Size) {
  const point = toProjected(next.latitude, next.longitude);
  const halfWidth = Math.min(WORLD_WIDTH_METERS / 2, size.width * scale / 2);
  const halfHeight = Math.min(WORLD_HEIGHT_METERS / 2, size.height * scale / 2);
  return fromProjected(clamp(point.x, -WORLD_WIDTH_METERS / 2 + halfWidth, WORLD_WIDTH_METERS / 2 - halfWidth), clamp(point.y, -WORLD_HEIGHT_METERS / 2 + halfHeight, WORLD_HEIGHT_METERS / 2 - halfHeight));
}

function coordinateAtViewport(x: number, y: number, center: Coordinate, scale: number, size: Size) {
  const point = toProjected(center.latitude, center.longitude);
  return fromProjected(point.x + (x - size.width / 2) * scale, point.y - (y - size.height / 2) * scale);
}

function touchDistance(touches: readonly { pageX: number; pageY: number }[]) {
  return touches.length < 2 ? 0 : Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
}

function touchCenter(touches: readonly { pageX: number; pageY: number }[]) {
  if (!touches.length) return null;
  const total = touches.reduce((result, touch) => ({ x: result.x + touch.pageX, y: result.y + touch.pageY }), { x: 0, y: 0 });
  return { x: total.x / touches.length, y: total.y / touches.length };
}

export function MineMap({ latitude, longitude, mines, currentMineId, focusTarget, onSelect }: {
  latitude: number; longitude: number; mines: Record<string, GridMine>; currentMineId?: string;
  focusTarget?: Coordinate & { nonce: number }; onSelect: (lat: number, lng: number) => void;
}) {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [center, setCenter] = useState<Coordinate>(focusTarget ?? WORLD_CENTER);
  const [scale, setScale] = useState(WORLD_WIDTH_METERS);
  const centerRef = useRef(center);
  const scaleRef = useRef(scale);
  const gesture = useRef({ touchCount: 0, x: 0, y: 0, distance: 0 });
  const mapPageOrigin = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const [pulse] = useState(() => new Animated.Value(0));
  const minimumScale = size.width ? GRID_WIDTH_METERS * 10 / size.width : GRID_WIDTH_METERS;
  const maximumScale = size.width && size.height ? Math.max(WORLD_WIDTH_METERS / size.width, WORLD_HEIGHT_METERS / size.height) : WORLD_WIDTH_METERS;

  const setViewport = useCallback((nextCenter: Coordinate, nextScale: number) => {
    const boundedScale = clamp(nextScale, minimumScale, maximumScale);
    const boundedCenter = clampCenter(nextCenter, boundedScale, size);
    scaleRef.current = boundedScale; centerRef.current = boundedCenter;
    setScale(boundedScale); setCenter(boundedCenter);
  }, [maximumScale, minimumScale, size]);

  function handleLayout(event: LayoutChangeEvent) {
    const nextSize = event.nativeEvent.layout;
    setSize(nextSize);
    if (size.width) return;
    const nextMinimum = GRID_WIDTH_METERS * 10 / nextSize.width;
    const nextMaximum = Math.max(WORLD_WIDTH_METERS / nextSize.width, WORLD_HEIGHT_METERS / nextSize.height);
    const nextScale = focusTarget ? Math.max(nextMinimum, GRID_WIDTH_METERS / 24) : nextMaximum;
    const nextCenter = clampCenter(focusTarget ?? WORLD_CENTER, nextScale, nextSize);
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
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || Math.abs(nextScale - currentScale) > currentScale * 0.002) moved.current = true;
      setViewport(fromProjected(point.x - dx * currentScale, point.y + dy * currentScale), nextScale);
      gesture.current = { touchCount: touches.length, x: midpoint.x, y: midpoint.y, distance };
    },
    onPanResponderRelease: (event) => {
      gesture.current.touchCount = 0; if (moved.current || scaleRef.current > GRID_VISIBLE_SCALE) return;
      const localX = event.nativeEvent.pageX - mapPageOrigin.current.x;
      const localY = event.nativeEvent.pageY - mapPageOrigin.current.y;
      const point = coordinateAtViewport(localX, localY, centerRef.current, scaleRef.current, size);
      const cell = gridCenterFromId(gridIdFromCoordinate(point.latitude, point.longitude)); onSelect(cell.latitude, cell.longitude);
    },
    onPanResponderTerminate: () => { gesture.current.touchCount = 0; },
  }), [onSelect, setViewport, size]);

  const projectedCenter = toProjected(center.latitude, center.longitude);
  const detailed = scale <= GRID_VISIBLE_SCALE;
  const worldLeft = size.width / 2 + (-WORLD_WIDTH_METERS / 2 - projectedCenter.x) / scale;
  const worldTop = size.height / 2 - (WORLD_HEIGHT_METERS / 2 - projectedCenter.y) / scale;
  const worldWidth = WORLD_WIDTH_METERS / scale; const worldHeight = WORLD_HEIGHT_METERS / scale;
  const vertical: number[] = []; const horizontal: number[] = [];
  if (size.width && detailed) {
    const left = projectedCenter.x - size.width * scale / 2; const top = projectedCenter.y + size.height * scale / 2;
    for (let x = Math.ceil((left + WORLD_WIDTH_METERS / 2) / GRID_WIDTH_METERS) * GRID_WIDTH_METERS - WORLD_WIDTH_METERS / 2; x <= left + size.width * scale; x += GRID_WIDTH_METERS) vertical.push((x - left) / scale);
    for (let y = Math.floor((top + WORLD_HEIGHT_METERS / 2) / GRID_HEIGHT_METERS) * GRID_HEIGHT_METERS - WORLD_HEIGHT_METERS / 2; y >= top - size.height * scale; y -= GRID_HEIGHT_METERS) horizontal.push((top - y) / scale);
  }

  const gridRect = (lat: number, lng: number) => {
    const point = toProjected(lat, lng);
    const gridX = Math.floor((point.x + WORLD_WIDTH_METERS / 2) / GRID_WIDTH_METERS) * GRID_WIDTH_METERS - WORLD_WIDTH_METERS / 2;
    const gridY = Math.floor((point.y + WORLD_HEIGHT_METERS / 2) / GRID_HEIGHT_METERS) * GRID_HEIGHT_METERS - WORLD_HEIGHT_METERS / 2;
    return { left: size.width / 2 + (gridX - projectedCenter.x) / scale, top: size.height / 2 - (gridY + GRID_HEIGHT_METERS - projectedCenter.y) / scale, width: GRID_WIDTH_METERS / scale, height: GRID_HEIGHT_METERS / scale };
  };
  const selectedRect = gridRect(latitude, longitude);
  const currentMine = currentMineId ? mines[currentMineId] : undefined;
  const visibleMines = Object.values(mines).filter((mine) => mine.id !== currentMineId && scale <= OTHER_MINES_VISIBLE_SCALE && (mine.completed || Boolean(mine.ownerId))).map((mine) => ({ mine, ...gridRect(mine.latitude, mine.longitude) })).filter(({ left, top }) => left > -80 && left < size.width + 80 && top > -40 && top < size.height + 40);
  const currentPoint = currentMine ? toProjected(currentMine.latitude, currentMine.longitude) : null;
  const currentLeft = currentPoint ? size.width / 2 + (currentPoint.x - projectedCenter.x) / scale : 0;
  const currentTop = currentPoint ? size.height / 2 - (currentPoint.y - projectedCenter.y) / scale : 0;

  return <View
    style={styles.wrap}
    onLayout={handleLayout}
    onTouchStart={(event) => {
      mapPageOrigin.current = {
        x: event.nativeEvent.pageX - event.nativeEvent.locationX,
        y: event.nativeEvent.pageY - event.nativeEvent.locationY,
      };
    }}
    {...responder.panHandlers}>
    <Image source={require('../../../assets/images/mine-world-map.png')} resizeMode="stretch" style={[styles.worldMap, { left: worldLeft, top: worldTop, width: worldWidth, height: worldHeight }]} />
    {detailed ? <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {vertical.map((left) => <View key={`v-${left}`} style={[styles.vertical, { left }]} />)}
      {horizontal.map((top) => <View key={`h-${top}`} style={[styles.horizontal, { top }]} />)}
      <View style={[styles.selected, selectedRect]} />
      {visibleMines.map(({ mine, left, top, width, height }) => <MineMarker key={mine.id} mine={mine} left={left} top={top} width={width} height={height} />)}
    </View> : null}
    {currentMine && currentPoint ? <View pointerEvents="none" style={[styles.currentMine, { left: currentLeft - 24, top: currentTop - 24 }]}>
      <Animated.View style={[styles.currentPulse, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.38, 0.08] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.45] }) }] }]} />
      <Image source={require('../../../assets/images/miner-strike-impact.png')} resizeMode="contain" style={styles.currentMineImage} /><Text style={styles.currentMineLabel}>내 채굴장</Text>
    </View> : null}
  </View>;
}

function MineMarker({ mine, left, top, width, height }: { mine: GridMine; left: number; top: number; width: number; height: number }) {
  const markerSize = clamp(Math.min(width, height) * 0.78, 12, 46);
  return <><View style={[styles.mineMarker, { left: left + width / 2 - markerSize / 2, top: top + height / 2 - markerSize / 2, width: markerSize, height: markerSize }]}><Image source={mine.completed ? require('../../../assets/images/mine-closed.png') : require('../../../assets/images/miner-strike-impact.png')} resizeMode="contain" style={styles.mineMarkerImage} /></View><View style={[styles.mineLabel, { left: left + width / 2 - 38, top: top + height - 2 }]}><Text numberOfLines={1} style={styles.mineLabelText}>{mine.completed ? '채굴 완료' : `${mine.ownerName ?? '사용자'} 채굴중`}</Text></View></>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: '#17283E' }, worldMap: { position: 'absolute' },
  vertical: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(240,185,11,0.78)' }, horizontal: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(240,185,11,0.78)' },
  selected: { position: 'absolute', borderWidth: 3, borderColor: '#FFD659', backgroundColor: 'rgba(240,185,11,0.28)', zIndex: 2 },
  mineLabel: { position: 'absolute', width: 76, minHeight: 20, paddingHorizontal: 4, borderRadius: 7, backgroundColor: 'rgba(54,39,8,0.9)', alignItems: 'center', justifyContent: 'center', zIndex: 3 }, mineLabelText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
  mineMarker: { position: 'absolute', alignItems: 'center', justifyContent: 'center', zIndex: 4 }, mineMarkerImage: { width: '100%', height: '100%' },
  currentMine: { position: 'absolute', width: 48, height: 48, alignItems: 'center', justifyContent: 'center', zIndex: 8 }, currentPulse: { position: 'absolute', width: 46, height: 46, borderRadius: 23, backgroundColor: palette.gold }, currentMineImage: { width: 36, height: 36 },
  currentMineLabel: { position: 'absolute', top: 43, width: 62, textAlign: 'center', color: '#FFFFFF', fontSize: 9, fontWeight: '900', backgroundColor: 'rgba(35,27,15,0.82)', borderRadius: 7, paddingVertical: 2 },
});
