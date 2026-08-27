import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import landData from '@/assets/data/ne-110m-land.json';
import { GRID_SIZE_METERS } from '@/domain/mining';
import { palette } from '@/ui/theme';

const EARTH_RADIUS = 6_378_137;
// These are numerical safety rails, not user-facing zoom stops. They sit well
// outside the useful range of the map so a normal gesture never hits a wall.
const MIN_SCALE = 0.25;
const MAX_SCALE = 10_000_000;
const INITIAL_SCALE = 120_000;
const GRID_THRESHOLD = GRID_SIZE_METERS / 14;
const COASTLINE_THRESHOLD = 50;
const WORLD_WIDTH_METERS = 2 * Math.PI * EARTH_RADIUS;
const WORLD_OVERVIEW_CENTER = { latitude: 15, longitude: 0 };

type Coordinate = { latitude: number; longitude: number };
type Projected = { x: number; y: number };
type Size = { width: number; height: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const wrapLongitude = (longitude: number) => ((longitude + 180) % 360 + 360) % 360 - 180;

function toMercator(latitude: number, longitude: number): Projected {
  const lat = clamp(latitude, -85.05112878, 85.05112878);
  return {
    x: EARTH_RADIUS * wrapLongitude(longitude) * Math.PI / 180,
    y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)),
  };
}

function fromMercator(x: number, y: number): Coordinate {
  return {
    latitude: clamp((2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) * 180 / Math.PI, -85, 85),
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

const LAND_POLYGONS = landData.features.map((feature) => feature.geometry.coordinates.map((ring) => {
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
  const worldWidth = WORLD_WIDTH_METERS / scale;
  const centerWorld = Math.round(center.x / WORLD_WIDTH_METERS);
  return [centerWorld - 1, centerWorld, centerWorld + 1].flatMap((worldOffset) => LAND_POLYGONS.map((rings, polygonIndex) => ({
    key: `${worldOffset}-${polygonIndex}`,
    d: rings.map((ring) => ring.map((point, pointIndex) => {
      const x = size.width / 2 + (point.x - center.x) / scale + worldOffset * worldWidth;
      const y = size.height / 2 - (point.y - center.y) / scale;
      return `${pointIndex ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ') + ' Z').join(' '),
  })));
}

function scaleLabel(scale: number) {
  if (scale <= GRID_THRESHOLD) return '100m × 100m 막장을 눌러 선택하세요';
  return '두 손가락으로 확대하면 막장 Grid가 표시됩니다';
}

export function MineMap({ latitude, longitude, onSelect }: {
  latitude: number;
  longitude: number;
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

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 3600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 3600, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  function updateCenter(next: Coordinate) {
    const value = { latitude: clamp(next.latitude, -85, 85), longitude: wrapLongitude(next.longitude) };
    centerRef.current = value;
    setCenter(value);
  }

  function updateScale(next: number) {
    const value = clamp(next, MIN_SCALE, MAX_SCALE);
    scaleRef.current = value;
    setScale(value);
  }

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
      const projected = toMercator(point.latitude, point.longitude);
      const cellCenter = fromMercator(
        Math.floor(projected.x / GRID_SIZE_METERS) * GRID_SIZE_METERS + GRID_SIZE_METERS / 2,
        Math.floor(projected.y / GRID_SIZE_METERS) * GRID_SIZE_METERS + GRID_SIZE_METERS / 2,
      );
      onSelect(cellCenter.latitude, cellCenter.longitude);
    },
    onPanResponderTerminate: () => {
      gestureState.current.touchCount = 0;
    },
  }), [onSelect, size]);

  const projectedCenter = toMercator(center.latitude, center.longitude);
  const selected = toMercator(latitude, longitude);
  const detailed = scale <= GRID_THRESHOLD;
  const vertical: number[] = [];
  const horizontal: number[] = [];

  if (size.width && detailed) {
    const left = projectedCenter.x - size.width * scale / 2;
    const top = projectedCenter.y + size.height * scale / 2;
    for (let x = Math.ceil(left / GRID_SIZE_METERS) * GRID_SIZE_METERS; x <= left + size.width * scale; x += GRID_SIZE_METERS) vertical.push((x - left) / scale);
    for (let y = Math.floor(top / GRID_SIZE_METERS) * GRID_SIZE_METERS; y >= top - size.height * scale; y -= GRID_SIZE_METERS) horizontal.push((top - y) / scale);
  }

  // At street/grid scale the world geometry would be millions of pixels wide.
  // Skipping it avoids native SVG precision artifacts while zooming; the grid
  // takes over once individual mining cells are meaningful.
  const showCoastline = scale >= COASTLINE_THRESHOLD;
  const paths = !showCoastline || !size.width ? [] : coastlinePaths(projectedCenter, scale, size);

  const selectedGridX = Math.floor(selected.x / GRID_SIZE_METERS) * GRID_SIZE_METERS;
  const selectedGridY = Math.floor(selected.y / GRID_SIZE_METERS) * GRID_SIZE_METERS;
  const selectedLeft = size.width / 2 + (selectedGridX - projectedCenter.x) / scale;
  const selectedTop = size.height / 2 - (selectedGridY + GRID_SIZE_METERS - projectedCenter.y) / scale;
  const selectedSize = GRID_SIZE_METERS / scale;

  return (
    <View style={styles.wrap} onLayout={(event: LayoutChangeEvent) => setSize(event.nativeEvent.layout)} {...responder.panHandlers}>
      {detailed ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {vertical.map((left) => <View key={`v-${left}`} style={[styles.vertical, { left }]} />)}
          {horizontal.map((top) => <View key={`h-${top}`} style={[styles.horizontal, { top }]} />)}
          <View style={[styles.selected, { left: selectedLeft, top: selectedTop, width: selectedSize, height: selectedSize }]} />
        </View>
      ) : (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }]}>
          <Svg width={size.width} height={size.height} viewBox={`0 0 ${size.width} ${size.height}`}>
            {paths.map((path) => (
              <Path key={path.key} d={path.d} fill="#BAF7D0" fillRule="evenodd" />
            ))}
          </Svg>
        </Animated.View>
      )}
      <View pointerEvents="none" style={styles.hint}><Text style={styles.hintText}>{scaleLabel(scale)}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: '#6551C7' },
  vertical: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(81,55,232,0.62)' },
  horizontal: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(81,55,232,0.62)' },
  selected: { position: 'absolute', borderWidth: 4, borderColor: palette.gold, backgroundColor: 'rgba(113,87,255,0.24)', zIndex: 2 },
  hint: { position: 'absolute', top: 104, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.94)', borderColor: palette.border, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  hintText: { color: palette.text, fontSize: 11, fontWeight: '800' },
});
