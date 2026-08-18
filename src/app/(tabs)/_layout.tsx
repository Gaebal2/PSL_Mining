import { Tabs } from 'expo-router';
import { SymbolView, SymbolViewProps } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const icons: Record<string, { active: SymbolViewProps['name']; inactive: SymbolViewProps['name'] }> = {
  mine: {
    active: { ios: 'hammer.fill', android: 'construction', web: 'construction' },
    inactive: { ios: 'hammer', android: 'construction', web: 'construction' },
  },
  map: {
    active: { ios: 'map.fill', android: 'map', web: 'map' },
    inactive: { ios: 'map', android: 'map', web: 'map' },
  },
  status: {
    active: { ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' },
    inactive: { ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' },
  },
  profile: {
    active: { ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' },
    inactive: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
  },
};

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      initialRouteName="map"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#F4C95D',
        tabBarInactiveTintColor: '#7E9187',
        tabBarStyle: {
          backgroundColor: '#0E1D17',
          borderTopColor: '#20352A',
          height: 64 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarIcon: ({ color, focused, size }) => (
          <SymbolView
            name={focused ? icons[route.name].active : icons[route.name].inactive}
            tintColor={color}
            size={size}
          />
        ),
      })}
    >
      <Tabs.Screen name="mine" options={{ title: '막장' }} />
      <Tabs.Screen name="map" options={{ title: '맵' }} />
      <Tabs.Screen name="status" options={{ title: '현황' }} />
      <Tabs.Screen name="profile" options={{ title: 'MY' }} />
    </Tabs>
  );
}
