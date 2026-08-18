import { Tabs } from 'expo-router';
import { Text } from 'react-native';

const icons: Record<string, string> = { map: '⌖', mine: '⛏', status: '◫', profile: '●' };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#F4C95D',
        tabBarInactiveTintColor: '#7E9187',
        tabBarStyle: { backgroundColor: '#0E1D17', borderTopColor: '#20352A', height: 72, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', paddingBottom: 8 },
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>{icons[route.name]}</Text>,
      })}>
      <Tabs.Screen name="map" options={{ title: '금광 지도' }} />
      <Tabs.Screen name="mine" options={{ title: '내 막장' }} />
      <Tabs.Screen name="status" options={{ title: '현황' }} />
      <Tabs.Screen name="profile" options={{ title: 'MY' }} />
    </Tabs>
  );
}
