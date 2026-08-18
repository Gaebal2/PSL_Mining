import { StyleSheet, Text, View } from 'react-native';

import { palette } from '@/ui/theme';

export function MineMap({ latitude, longitude }: { latitude: number; longitude: number; onSelect: (lat: number, lng: number) => void }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.globe}><Text style={styles.globeText}>◎</Text></View>
      <Text style={styles.title}>네이티브 지도 미리보기</Text>
      <Text style={styles.copy}>{latitude.toFixed(5)}, {longitude.toFixed(5)}</Text>
      <Text style={styles.helper}>실제 GPS 지도와 Grid 선택은 Android/iOS에서 활성화됩니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 410, borderRadius: 24, backgroundColor: '#14251E', alignItems: 'center', justifyContent: 'center', padding: 24 },
  globe: { width: 120, height: 120, borderRadius: 60, borderWidth: 1, borderColor: palette.green, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  globeText: { color: palette.green, fontSize: 76 },
  title: { color: palette.text, fontSize: 20, fontWeight: '900' },
  copy: { color: palette.gold, fontSize: 14, marginTop: 8 },
  helper: { color: palette.muted, fontSize: 13, textAlign: 'center', marginTop: 10 },
});
