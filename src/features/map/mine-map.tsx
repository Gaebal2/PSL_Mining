import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';

import landData from '@/assets/data/ne-110m-land.json';
import { GRID_COLUMN_COUNT, GRID_ROW_COUNT, GridMine, gridCenterFromId, gridIdFromCoordinate } from '@/domain/mining';
import { palette } from '@/ui/theme';

const EARTH_RADIUS = 6_378_137;
// These are numerical safety rails, not user-facing zoom stops. They sit well
// outside the useful range of the map so a normal gesture never hits a wall.
const MAX_SCALE = 10_000_000;
const INITIAL_SCALE = 120_000;
const WORLD_WIDTH_METERS = 2 * Math.PI * EARTH_RADIUS;
const WORLD_HEIGHT_METERS = WORLD_WIDTH_METERS / 2;
const GRID_WIDTH_METERS = WORLD_WIDTH_METERS / GRID_COLUMN_COUNT;
const GRID_HEIGHT_METERS = WORLD_HEIGHT_METERS / GRID_ROW_COUNT;
const GRID_THRESHOLD = Math.max(GRID_WIDTH_METERS, GRID_HEIGHT_METERS) / 14;
const COASTLINE_THRESHOLD = 50;
const WORLD_OVERVIEW_CENTER = { latitude: 15, longitude: 0 };

type Coordinate = { latitude: number; longitude: number };
type Projected = { x: number; y: number };
type Size = { width: number; height: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const wrapLongitude = (longitude: number) => ((longitude + 180) % 360 + 360) % 360 - 180;

function toMercator(latitude: number, longitude: number): Projected {
  const lat = clamp(latitude, -90, 90);
  return {
    x: EARTH_RADIUS * wrapLongitude(longitude) * Math.PI / 180,
    y: WORLD_HEIGHT_METERS / 2 * Math.sin(lat * Math.PI / 180),
  };
}

function fromMercator(x: number, y: number): Coordinate {
  return {
    latitude: Math.asin(clamp(y / (WORLD_HEIGHT_METERS / 2), -1, 1)) * 180 / Math.PI,
    longitude: wrapLongitude(x / EARTH_RADIUS * 180 / Math.PI),
  };
}

function coordinateAtViewport(x: number, y: number, center: Coordinate, scale: number, size: Size) {
  const projected = toMercator(center.latitude, center.longitude);
  return fromMercator(projected.x + (x - size.width / 2) * scale, projected.y - (y - size.height / 2) * scale);
}

function touchDistance(touches: readonly { pageX: number; pageY: number }[]) {
  return touches.length < 2 ? 0 : Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
}

function touchCenter(touches: readonly { pageX: number; pageY: number }[]) {
  if (!touches.length) return null;
  const total = touches.reduce((result, touch) => ({
    x: result.x + touch.pageX,
    y: result.y + touch.pageY,
  }), { x: 0, y: 0 });
  return { x: total.x / touches.length, y: total.y / touches.length };
}

const LAND_POLYGONS = landData.features.filter((feature) => feature.bbox[1] > -89).map((feature) => feature.geometry.coordinates.map((ring) => {
  let previousX: number | undefined;

  return ring.map(([longitude, latitude]) => {
    const point = toMercator(latitude, longitude);

    // Keep a ring continuous when it crosses the antimeridian. Without this,
    // SVG closes the polygon across the whole viewport and can draw long,
    // horizontal seams through the map.
    if (previousX !== undefined) {
      while (point.x - previousX > WORLD_WIDTH_METERS / 2) point.x -= WORLD_WIDTH_METERS;
      while (point.x - previousX < -WORLD_WIDTH_METERS / 2) point.x += WORLD_WIDTH_METERS;
    }
    previousX = point.x;
    return point;
  });
}));

function coastlinePaths(center: Projected, scale: number, size: Size) {
  return LAND_POLYGONS.map((rings, polygonIndex) => ({
    key: `${polygonIndex}`,
    d: rings.map((ring) => {
      const worldOffset = Math.round((center.x - ring[0].x) / WORLD_WIDTH_METERS) * WORLD_WIDTH_METERS;
      return ring.map((point, pointIndex) => {
        const x = size.width / 2 + (point.x + worldOffset - center.x) / scale;
        const y = size.height / 2 - (point.y - center.y) / scale;
        return `${pointIndex ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(' ') + ' Z';
    }).join(' '),
  }));
}

export function MineMap({ latitude, longitude, mines, onSelect }: {
  latitude: number;
  longitude: number;
  mines: Record<string, GridMine>;
  onSelect: (lat: number, lng: number) => void;
}) {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [center, setCenter] = useState<Coordinate>(WORLD_OVERVIEW_CENTER);
  const [scale, setScale] = useState(INITIAL_SCALE);
  const centerRef = useRef(center);
  const scaleRef = useRef(scale);
  const gestureState = useRef({ touchCount: 0, x: 0, y: 0, distance: 0 });
  const moved = useRef(false);
  const [pulse] = useState(() => new Animated.Value(0));
  const minimumScale = size.width && size.height
    ? 15 * Math.max(GRID_WIDTH_METERS, GRID_HEIGHT_METERS) / Math.min(size.width, size.height)
    : GRID_THRESHOLD;

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 3600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 3600, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const updateCenter = useCallback((next: Coordinate) => {
    const value = { latitude: clamp(next.latitude, -90, 90), longitude: wrapLongitude(next.longitude) };
    centerRef.current = value;
    setCenter(value);
  }, []);

  const updateScale = useCallback((next: number) => {
    const value = clamp(next, minimumScale, MAX_SCALE);
    scaleRef.current = value;
    setScale(value);
  }, [minimumScale]);

  useEffect(() => {
    if (scaleRef.current < minimumScale) updateScale(minimumScale);
  }, [minimumScale, updateScale]);

  // The responder callbacks intentionally read the latest gesture values from refs;
  // they never expose those refs to rendered output.
  // eslint-disable-next-line react-hooks/refs
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      const touches = event.nativeEvent.touches;
      const midpoint = touchCenter(touches);
      gestureState.current = {
        touchCount: touches.length,
        x: midpoint?.x ?? 0,
        y: midpoint?.y ?? 0,
        distance: touchDistance(touches),
      };
      moved.current = false;
    },
    onPanResponderMove: (event) => {
      const touches = event.nativeEvent.touches;
      const midpoint = touchCenter(touches);
      if (!midpoint) return;

      const previous = gestureState.current;
      const distance = touchDistance(touches);
      if (touches.length !== previous.touchCount) {
        gestureState.current = { touchCount: touches.length, x: midpoint.x, y: midpoint.y, distance };
        return;
      }

      const dx = midpoint.x - previous.x;
      const dy = midpoint.y - previous.y;
      const currentScale = scaleRef.current;
      const projected = toMercator(centerRef.current.latitude, centerRef.current.longitude);
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) moved.current = true;
      updateCenter(fromMercator(projected.x - dx * currentScale, projected.y + dy * currentScale));

      if (touches.length >= 2 && previous.distance > 0 && distance > 0) {
        const nextScale = currentScale * previous.distance / distance;
        if (Math.abs(nextScale - currentScale) > currentScale * 0.002) moved.current = true;
        updateScale(nextScale);
      }

      gestureState.current = { touchCount: touches.length, x: midpoint.x, y: midpoint.y, distance };
    },
    onPanResponderRelease: (event) => {
      gestureState.current.touchCount = 0;
      if (moved.current) return;
      const point = coordinateAtViewport(event.nativeEvent.locationX, event.nativeEvent.locationY, centerRef.current, scaleRef.current, size);
      if (scaleRef.current > GRID_THRESHOLD) return;
      const cellCenter = gridCenterFromId(gridIdFromCoordinate(point.latitude, point.longitude));
      onSelect(cellCenter.latitude, cellCenter.longitude);
    },
    onPanResponderTerminate: () => {
      gestureState.current.touchCount = 0;
    },
  }), [onSelect, size, updateCenter, updateScale]);

  const projectedCenter = toMercator(center.latitude, center.longitude);
  const selected = toMercator(latitude, longitude);
  const detailed = scale <= GRID_THRESHOLD;
  const showGlobe = scale >= INITIAL_SCALE * 0.72;
  const vertical: number[] = [];
  const horizontal: number[] = [];

  if (size.width && detailed) {
    const left = projectedCenter.x - size.width * scale / 2;
    const top = projectedCenter.y + size.height * scale / 2;
    for (let x = Math.ceil((left + WORLD_WIDTH_METERS / 2) / GRID_WIDTH_METERS) * GRID_WIDTH_METERS - WORLD_WIDTH_METERS / 2; x <= left + size.width * scale; x += GRID_WIDTH_METERS) vertical.push((x - left) / scale);
    for (let y = Math.floor((top + WORLD_HEIGHT_METERS / 2) / GRID_HEIGHT_METERS) * GRID_HEIGHT_METERS - WORLD_HEIGHT_METERS / 2; y >= top - size.height * scale; y -= GRID_HEIGHT_METERS) horizontal.push((top - y) / scale);
  }

  // At street/grid scale the world geometry would be millions of pixels wide.
  // Skipping it avoids native SVG precision artifacts while zooming; the grid
  // takes over once individual mining cells are meaningful.
  const showCoastline = scale >= COASTLINE_THRESHOLD;
  const paths = !showCoastline || !size.width ? [] : coastlinePaths(projectedCenter, scale, size);
  const globeDiameter = Math.max(0, Math.min(size.width - 32, size.height * 0.58));
  const globeRadius = globeDiameter / 2;
  const globeScale = globeDiameter ? WORLD_WIDTH_METERS / globeDiameter : INITIAL_SCALE;
  const globePaths = showGlobe && size.width ? coastlinePaths(projectedCenter, globeScale, size) : [];

  const selectedGridX = Math.floor((selected.x + WORLD_WIDTH_METERS / 2) / GRID_WIDTH_METERS) * GRID_WIDTH_METERS - WORLD_WIDTH_METERS / 2;
  const selectedGridY = Math.floor((selected.y + WORLD_HEIGHT_METERS / 2) / GRID_HEIGHT_METERS) * GRID_HEIGHT_METERS - WORLD_HEIGHT_METERS / 2;
  const selectedLeft = size.width / 2 + (selectedGridX - projectedCenter.x) / scale;
  const selectedTop = size.height / 2 - (selectedGridY + GRID_HEIGHT_METERS - projectedCenter.y) / scale;
  const selectedWidth = GRID_WIDTH_METERS / scale;
  const selectedHeight = GRID_HEIGHT_METERS / scale;
  const mineMarkers = detailed ? Object.values(mines).filter((mine) => mine.completed || mine.ownerId).map((mine) => {
    const point = toMercator(mine.latitude, mine.longitude);
    const gridX = Math.floor((point.x + WORLD_WIDTH_METERS / 2) / GRID_WIDTH_METERS) * GRID_WIDTH_METERS - WORLD_WIDTH_METERS / 2;
    const gridY = Math.floor((point.y + WORLD_HEIGHT_METERS / 2) / GRID_HEIGHT_METERS) * GRID_HEIGHT_METERS - WORLD_HEIGHT_METERS / 2;
    return {
      mine,
      left: size.width / 2 + (gridX - projectedCenter.x) / scale,
      top: size.height / 2 - (gridY + GRID_HEIGHT_METERS - projectedCenter.y) / scale,
    };
  }).filter(({ left, top }) => left > -80 && left < size.width + 80 && top > -40 && top < size.height + 40) : [];

  return (
    <View style={styles.wrap} onLayout={(event: LayoutChangeEvent) => setSize(event.nativeEvent.layout)} {...responder.panHandlers}>
      {detailed ? (
        <View style={[StyleSheet.absoluteFill, styles.gridBase]} pointerEvents="none">
          {vertical.map((left) => <View key={`v-${left}`} style={[styles.vertical, { left }]} />)}
          {horizontal.map((top) => <View key={`h-${top}`} style={[styles.horizontal, { top }]} />)}
          <View style={[styles.selected, { left: selectedLeft, top: selectedTop, width: selectedWidth, height: selectedHeight }]} />
          {mineMarkers.map(({ mine, left, top }) => (
            <View key={mine.id} style={[styles.mineLabel, { left: left + selectedWidth / 2 - 38, top: top + selectedHeight / 2 - 10 }]}>
              <Text numberOfLines={1} style={styles.mineLabelText}>{mine.completed ? '채굴 완료' : `${mine.ownerName ?? '사용자'} 채굴중`}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, scale < COASTLINE_THRESHOLD && styles.landDetailBase, { opacity: scale < COASTLINE_THRESHOLD ? 1 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }]}>
          <Svg width={size.width} height={size.height} viewBox={`0 0 ${size.width} ${size.height}`}>
            {showGlobe ? (
              <>
                <Defs>
                  <ClipPath id="globeClip"><Circle cx={size.width / 2} cy={size.height / 2} r={globeRadius} /></ClipPath>
                  <RadialGradient id="ocean" cx="35%" cy="28%" rx="70%" ry="70%">
                    <Stop offset="0" stopColor="#8D80E8" /><Stop offset="0.7" stopColor="#6551C7" /><Stop offset="1" stopColor="#2E236E" />
                  </RadialGradient>
                  <RadialGradient id="shade" cx="32%" cy="26%" rx="72%" ry="72%">
                    <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0" /><Stop offset="1" stopColor="#110B35" stopOpacity="0.62" />
                  </RadialGradient>
                </Defs>
                <Circle cx={size.width / 2} cy={size.height / 2} r={globeRadius + 5} fill="#292060" opacity={0.45} />
                <Circle cx={size.width / 2} cy={size.height / 2} r={globeRadius} fill="url(#ocean)" />
                <G clipPath="url(#globeClip)">{globePaths.map((path) => <Path key={path.key} d={path.d} fill="#BAF7D0" fillRule="evenodd" />)}</G>
                <Circle cx={size.width / 2} cy={size.height / 2} r={globeRadius} fill="url(#shade)" />
                <Circle cx={size.width / 2} cy={size.height / 2} r={globeRadius} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={2} />
              </>
            ) : paths.map((path) => <Path key={path.key} d={path.d} fill="#BAF7D0" fillRule="evenodd" />)}
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: '#6551C7' },
  gridBase: { backgroundColor: '#BAF7D0' },
  landDetailBase: { backgroundColor: '#BAF7D0' },
  vertical: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(81,55,232,0.62)' },
  horizontal: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(81,55,232,0.62)' },
  selected: { position: 'absolute', borderWidth: 4, borderColor: palette.gold, backgroundColor: 'rgba(113,87,255,0.24)', zIndex: 2 },
  mineLabel: { position: 'absolute', width: 76, minHeight: 20, paddingHorizontal: 4, borderRadius: 7, backgroundColor: 'rgba(40,30,88,0.88)', alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  mineLabelText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
});
