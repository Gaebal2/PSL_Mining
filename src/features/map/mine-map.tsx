import * as Location from 'expo-location';
import { useRef } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';

import { palette } from '@/ui/theme';

export function MineMap({ latitude, longitude, onSelect }: { latitude: number; longitude: number; onSelect: (lat: number, lng: number) => void }) {
  const map = useRef<MapView>(null);
  const googleMapsEnabled = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ENABLED === 'true';

  async function goToMyLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return Alert.alert('위치 권한 필요', '현재 위치로 이동하려면 위치 권한을 허용해 주세요.');
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const region = { latitude: location.coords.latitude, longitude: location.coords.longitude, latitudeDelta: 0.002, longitudeDelta: 0.002 };
    map.current?.animateToRegion(region, 500);
    onSelect(region.latitude, region.longitude);
  }

  function selectCenter(region: Region) {
    onSelect(region.latitude, region.longitude);
  }

  if (!googleMapsEnabled) {
    return (
      <View style={[styles.wrap, styles.unavailable]}>
        <Text style={styles.unavailableTitle}>지도를 준비 중입니다</Text>
        <Text style={styles.unavailableText}>
          이 테스트 빌드에는 Google Maps API 키가 설정되지 않았습니다.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <MapView
        ref={map}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude, longitude, latitudeDelta: 0.004, longitudeDelta: 0.004 }}
        onRegionChangeComplete={selectCenter}
        showsUserLocation
        showsMyLocationButton={false}
        mapType="hybrid"
      />
      <View pointerEvents="none" style={styles.crosshair}><View style={styles.crosshairDot} /></View>
      <View pointerEvents="none" style={styles.gridHint}><Text style={styles.gridHintText}>선택 Grid · 1m × 1m</Text></View>
      <Pressable style={styles.location} onPress={goToMyLocation}><Text style={styles.locationText}>⌖</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 410, borderRadius: 24, overflow: 'hidden', backgroundColor: palette.surface },
  crosshair: { position: 'absolute', left: '50%', top: '50%', width: 34, height: 34, marginLeft: -17, marginTop: -17, borderWidth: 2, borderColor: palette.gold, alignItems: 'center', justifyContent: 'center' },
  crosshairDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: palette.gold },
  gridHint: { position: 'absolute', top: 14, left: 14, backgroundColor: 'rgba(8,19,15,0.88)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  gridHintText: { color: palette.text, fontSize: 11, fontWeight: '800' },
  location: { position: 'absolute', right: 14, bottom: 14, width: 48, height: 48, borderRadius: 24, backgroundColor: palette.gold, alignItems: 'center', justifyContent: 'center' },
  locationText: { color: '#172017', fontSize: 25, fontWeight: '900' },
  unavailable: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  unavailableTitle: { color: palette.text, fontSize: 20, fontWeight: '900', marginBottom: 10 },
  unavailableText: { color: palette.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
