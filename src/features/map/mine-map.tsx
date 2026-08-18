import * as Location from 'expo-location';
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polygon, Region } from 'react-native-maps';

import { palette } from '@/ui/theme';

const EARTH_RADIUS = 6_378_137;
const GRID_RADIUS = 6;

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

function createVisibleGrid(latitude: number, longitude: number): GridCell[] {
  const origin = toMercator(latitude, longitude);
  const centerX = Math.floor(origin.x);
  const centerY = Math.floor(origin.y);
  const cells: GridCell[] = [];

  for (let yOffset = -GRID_RADIUS; yOffset <= GRID_RADIUS; yOffset += 1) {
    for (let xOffset = -GRID_RADIUS; xOffset <= GRID_RADIUS; xOffset += 1) {
      const x = centerX + xOffset;
      const y = centerY + yOffset;
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

  return cells;
}

export function MineMap({ latitude, longitude, onSelect, onStart }: {
  latitude: number;
  longitude: number;
  onSelect: (lat: number, lng: number) => void;
  onStart: (lat: number, lng: number) => void;
}) {
  const map = useRef<MapView>(null);
  const [viewport, setViewport] = useState({ latitude, longitude });
  const googleMapsEnabled = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ENABLED === 'true';
  const selectedCellId = useMemo(() => {
    const point = toMercator(latitude, longitude);
    return `G-${Math.floor(point.x)}-${Math.floor(point.y)}`;
  }, [latitude, longitude]);
  const cells = useMemo(() => createVisibleGrid(viewport.latitude, viewport.longitude), [viewport.latitude, viewport.longitude]);

  async function goToMyLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('위치 권한 필요', '현재 위치로 이동하려면 위치 권한을 허용해 주세요.');
      return;
    }
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const region = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.00014,
      longitudeDelta: 0.00014,
    };
    map.current?.animateToRegion(region, 500);
    setViewport(region);
  }

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
        onRegionChangeComplete={(region: Region) => setViewport({ latitude: region.latitude, longitude: region.longitude })}
        showsUserLocation
        showsMyLocationButton={false}
        showsBuildings={false}
        showsIndoors={false}
        showsTraffic={false}
        mapType="standard"
      >
        {cells.map((cell) => {
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
      <View pointerEvents="none" style={styles.gridHint}><Text style={styles.gridHintText}>한 칸 · 1m × 1m</Text></View>
      <Pressable accessibilityLabel="현재 위치로 이동" style={styles.location} onPress={goToMyLocation}>
        <Text style={styles.locationText}>◎</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#DDE7DF' },
  gridHint: { position: 'absolute', top: 104, alignSelf: 'center', backgroundColor: 'rgba(8,19,15,0.86)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  gridHintText: { color: palette.text, fontSize: 11, fontWeight: '800' },
  selectedMarker: { width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: '#E12D39', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  selectedMarkerCore: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF' },
  location: { position: 'absolute', right: 16, bottom: 174, width: 48, height: 48, borderRadius: 24, backgroundColor: palette.gold, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  locationText: { color: '#172017', fontSize: 25, fontWeight: '900' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: palette.surface2 },
  fallbackTitle: { color: palette.text, fontSize: 18, fontWeight: '900' },
  fallbackCopy: { color: palette.muted, fontSize: 13, marginTop: 8 },
});
