import { useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from 'react-native';

import landData from '@/assets/data/ne-110m-land.json';
import { palette } from '@/ui/theme';

const EARTH_RADIUS = 6_378_137;
const MIN_SCALE = 0.06;
const MAX_SCALE = 120_000;
const GRID_THRESHOLD = 0.8;
const TILE_SIZE = 24;

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

type LandPolygon = { rings: number[][][]; minLng: number; maxLng: number; minLat: number; maxLat: number };

const LAND_POLYGONS: LandPolygon[] = landData.features.map((feature) => {
  const rings = feature.geometry.coordinates;
  const points = rings.flat();
  return {
    rings,
    minLng: Math.min(...points.map((point) => point[0])),
    maxLng: Math.max(...points.map((point) => point[0])),
    minLat: Math.min(...points.map((point) => point[1])),
    maxLat: Math.max(...points.map((point) => point[1])),
  };
});

function pointInRing(latitude: number, longitude: number, ring: number[][]) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [currentLng, currentLat] = ring[index];
    const [previousLng, previousLat] = ring[previous];
    const intersects = (currentLat > latitude) !== (previousLat > latitude)
      && longitude < (previousLng - currentLng) * (latitude - currentLat) / (previousLat - currentLat) + currentLng;
    if (intersects) inside = !inside;
  }
  return inside;
}

function isLand(latitude: number, longitude: number) {
  return LAND_POLYGONS.some((polygon) => {
    if (latitude < polygon.minLat || latitude > polygon.maxLat || longitude < polygon.minLng || longitude > polygon.maxLng) return false;
    if (!pointInRing(latitude, longitude, polygon.rings[0])) return false;
    return !polygon.rings.slice(1).some((hole) => pointInRing(latitude, longitude, hole));
  });
}

function scaleLabel(scale: number) {
  if (scale <= GRID_THRESHOLD) return '화면을 눌러 1m × 1m 막장 선택';
  const meters = scale * TILE_SIZE;
  const distance = meters < 1_000 ? `약 ${Math.round(meters)}m` : `약 ${Math.round(meters / 1_000).toLocaleString()}km`;
  return `지역을 눌러 확대 · 블록 한 칸 ${distance}`;
}

export function MineMap({ latitude, longitude, onSelect }: {
  latitude: number;
  longitude: number;
  onSelect: (lat: number, lng: number) => void;
}) {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [center, setCenter] = useState<Coordinate>({ latitude, longitude });
  const [scale, setScale] = useState(MAX_SCALE);
  const centerRef = useRef(center);
  const scaleRef = useRef(scale);
  const gestureStart = useRef({ center: toMercator(latitude, longitude), scale, pinch: 0 });
  const moved = useRef(false);

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
      gestureStart.current = {
        center: toMercator(centerRef.current.latitude, centerRef.current.longitude),
        scale: scaleRef.current,
        pinch: touchDistance(event.nativeEvent.touches),
      };
      moved.current = false;
    },
    onPanResponderMove: (event, gesture) => {
      if (event.nativeEvent.touches.length >= 2) {
        const distance = touchDistance(event.nativeEvent.touches);
        if (!gestureStart.current.pinch) gestureStart.current.pinch = distance;
        if (distance) updateScale(gestureStart.current.scale * gestureStart.current.pinch / distance);
        moved.current = true;
        return;
      }
      if (Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3) moved.current = true;
      const start = gestureStart.current;
      updateCenter(fromMercator(start.center.x - gesture.dx * start.scale, start.center.y + gesture.dy * start.scale));
    },
    onPanResponderRelease: (event) => {
      if (moved.current) return;
      const point = coordinateAtViewport(event.nativeEvent.locationX, event.nativeEvent.locationY, centerRef.current, scaleRef.current, size);
      if (scaleRef.current > GRID_THRESHOLD) {
        updateCenter(point);
        updateScale(Math.max(0.12, scaleRef.current / 100));
        return;
      }
      const projected = toMercator(point.latitude, point.longitude);
      const cellCenter = fromMercator(Math.floor(projected.x) + 0.5, Math.floor(projected.y) + 0.5);
      onSelect(cellCenter.latitude, cellCenter.longitude);
    },
  }), [onSelect, size]);

  const projectedCenter = toMercator(center.latitude, center.longitude);
  const selected = toMercator(latitude, longitude);
  const detailed = scale <= GRID_THRESHOLD;
  const vertical: number[] = [];
  const horizontal: number[] = [];
  const tiles: { key: string; left: number; top: number; land: boolean; shade: boolean }[] = [];

  if (size.width && detailed) {
    const left = projectedCenter.x - size.width * scale / 2;
    const top = projectedCenter.y + size.height * scale / 2;
    for (let x = Math.ceil(left); x <= left + size.width * scale; x += 1) vertical.push((x - left) / scale);
    for (let y = Math.floor(top); y >= top - size.height * scale; y -= 1) horizontal.push((top - y) / scale);
  } else if (size.width) {
    const columns = Math.ceil(size.width / TILE_SIZE) + 2;
    const rows = Math.ceil(size.height / TILE_SIZE) + 2;
    for (let row = -1; row < rows; row += 1) {
      for (let column = -1; column < columns; column += 1) {
        const left = column * TILE_SIZE;
        const top = row * TILE_SIZE;
        const point = coordinateAtViewport(left + TILE_SIZE / 2, top + TILE_SIZE / 2, center, scale, size);
        tiles.push({ key: `${row}-${column}`, left, top, land: isLand(point.latitude, point.longitude), shade: (row + column) % 3 === 0 });
      }
    }
  }

  const selectedLeft = size.width / 2 + (Math.floor(selected.x) - projectedCenter.x) / scale;
  const selectedTop = size.height / 2 - (Math.floor(selected.y) + 1 - projectedCenter.y) / scale;
  const selectedSize = 1 / scale;

  return (
    <View style={styles.wrap} onLayout={(event: LayoutChangeEvent) => setSize(event.nativeEvent.layout)} {...responder.panHandlers}>
      {detailed ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {vertical.map((left) => <View key={`v-${left}`} style={[styles.vertical, { left }]} />)}
          {horizontal.map((top) => <View key={`h-${top}`} style={[styles.horizontal, { top }]} />)}
          <View style={[styles.selected, { left: selectedLeft, top: selectedTop, width: selectedSize, height: selectedSize }]} />
        </View>
      ) : (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {tiles.map((tile) => <View key={tile.key} style={[styles.tile, { left: tile.left, top: tile.top }, tile.land ? styles.land : styles.ocean, tile.shade && styles.shade]} />)}
        </View>
      )}
      <View pointerEvents="none" style={styles.hint}><Text style={styles.hintText}>{scaleLabel(scale)}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: '#DCD8FA' },
  vertical: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(81,55,232,0.62)' },
  horizontal: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(81,55,232,0.62)' },
  selected: { position: 'absolute', borderWidth: 4, borderColor: palette.gold, backgroundColor: 'rgba(113,87,255,0.24)', zIndex: 2 },
  tile: { position: 'absolute', width: TILE_SIZE - 1, height: TILE_SIZE - 1, borderRadius: 4 },
  land: { backgroundColor: '#B5F2C9' },
  ocean: { backgroundColor: '#7563D8' },
  shade: { opacity: 0.78 },
  hint: { position: 'absolute', top: 104, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.94)', borderColor: palette.border, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  hintText: { color: palette.text, fontSize: 11, fontWeight: '800' },
});
