import { useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polygon, Region } from 'react-native-maps';

import { palette } from '@/ui/theme';

const EARTH_RADIUS = 6_378_137;
const MAX_VISIBLE_CELLS = 2_500;

type Coordinate = { latitude: number; longitude: number };
type GridCell = { id: string; center: Coordinate; coordinates: Coordinate[] };

function toMercator(latitude: number, longitude: number) {
  const clampedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  return {
    x: EARTH_RADIUS * longitude * Math.PI / 180,
    y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + clampedLatitude * Math.PI / 360)),
  };
}

function fromMercator(x: number, y: number): Coordinate {
  return {
    latitude: (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) * 180 / Math.PI,
    longitude: x / EARTH_RADIUS * 180 / Math.PI,
  };
}

function createVisibleGrid(region: Region): { cells: GridCell[]; needsZoom: boolean } {
  const northWest = toMercator(
    region.latitude + region.latitudeDelta / 2,
    region.longitude - region.longitudeDelta / 2,
  );
  const southEast = toMercator(
    region.latitude - region.latitudeDelta / 2,
    region.longitude + region.longitudeDelta / 2,
  );
  const minX = Math.floor(Math.min(northWest.x, southEast.x)) - 1;
  const maxX = Math.floor(Math.max(northWest.x, southEast.x)) + 1;
  const minY = Math.floor(Math.min(northWest.y, southEast.y)) - 1;
  const maxY = Math.floor(Math.max(northWest.y, southEast.y)) + 1;
  const cellCount = (maxX - minX + 1) * (maxY - minY + 1);

  if (cellCount > MAX_VISIBLE_CELLS) return { cells: [], needsZoom: true };

  const cells: GridCell[] = [];

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      cells.push({
        id: `G-${x}-${y}`,
        center: fromMercator(x + 0.5, y + 0.5),
        coordinates: [
          fromMercator(x, y),
          fromMercator(x + 1, y),
          fromMercator(x + 1, y + 1),
          fromMercator(x, y + 1),
        ],
      });
    }
  }

  return { cells, needsZoom: false };
}

export function MineMap({ latitude, longitude, onSelect, onStart }: {
  latitude: number;
  longitude: number;
  onSelect: (lat: number, lng: number) => void;
  onStart: (lat: number, lng: number) => void;
}) {
  const map = useRef<MapView>(null);
  const [viewport, setViewport] = useState<Region>({
    latitude,
    longitude,
    latitudeDelta: 0.00014,
    longitudeDelta: 0.00014,
  });
  const googleMapsEnabled = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ENABLED === 'true';
  const selectedCellId = useMemo(() => {
    const point = toMercator(latitude, longitude);
    return `G-${Math.floor(point.x)}-${Math.floor(point.y)}`;
  }, [latitude, longitude]);
  const visibleGrid = useMemo(() => createVisibleGrid(viewport), [viewport]);

  function selectCell(cell: GridCell) {
    onSelect(cell.center.latitude, cell.center.longitude);
    Alert.alert('채굴 위치 선택', '여기서 채굴을 시작할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '채굴 시작', onPress: () => onStart(cell.center.latitude, cell.center.longitude) },
    ]);
  }

  if (!googleMapsEnabled) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>지도를 불러올 수 없습니다</Text>
        <Text style={styles.fallbackCopy}>Google Maps 설정을 확인해 주세요.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude, longitude, latitudeDelta: 0.00014, longitudeDelta: 0.00014 }}
        onRegionChangeComplete={setViewport}
        showsUserLocation
        showsMyLocationButton
        mapPadding={{ top: 106, right: 8, bottom: 174, left: 8 }}
        showsBuildings={false}
        showsIndoors={false}
        showsTraffic={false}
        showsCompass={false}
        rotateEnabled={false}
        pitchEnabled={false}
        maxZoomLevel={20}
        minZoomLevel={2}
        mapType="standard"
      >
        {visibleGrid.cells.map((cell) => {
          const selected = cell.id === selectedCellId;
          return (
            <Polygon
              key={cell.id}
              coordinates={cell.coordinates}
              fillColor={selected ? 'rgba(225,45,57,0.22)' : 'rgba(255,255,255,0.02)'}
              strokeColor={selected ? '#E12D39' : 'rgba(126,46,52,0.72)'}
              strokeWidth={selected ? 2.6 : 0.8}
              tappable
              onPress={() => selectCell(cell)}
            />
          );
        })}
        <Marker coordinate={{ latitude, longitude }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <View style={styles.selectedMarker}><View style={styles.selectedMarkerCore} /></View>
        </Marker>
      </MapView>
      <View pointerEvents="none" style={styles.gridHint}>
        <Text style={styles.gridHintText}>{visibleGrid.needsZoom ? '격자를 보려면 지도를 더 확대하세요' : '한 칸 · 1m × 1m'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#DDE7DF' },
  gridHint: { position: 'absolute', top: 104, alignSelf: 'center', backgroundColor: 'rgba(8,19,15,0.86)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  gridHintText: { color: palette.text, fontSize: 11, fontWeight: '800' },
  selectedMarker: { width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: '#E12D39', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  selectedMarkerCore: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: palette.surface2 },
  fallbackTitle: { color: palette.text, fontSize: 18, fontWeight: '900' },
  fallbackCopy: { color: palette.muted, fontSize: 13, marginTop: 8 },
});
