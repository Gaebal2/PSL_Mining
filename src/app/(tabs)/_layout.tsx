import { Tabs } from 'expo-router';
import { Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '@/state/locale';

const icons = {
  mine: require('../../../assets/images/tab-mine.png'),
  map: require('../../../assets/images/tab-map.png'),
  status: require('../../../assets/images/tab-status.png'),
  profile: require('../../../assets/images/tab-profile.png'),
};

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();

  return (
    <Tabs
      initialRouteName="map"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#7157FF',
        tabBarInactiveTintColor: '#697180',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E8EF',
          height: 64 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarIcon: ({ focused, size }) => (
          <Image
            source={icons[route.name as keyof typeof icons]}
            resizeMode="contain"
            style={{ width: size + 7, height: size + 7, opacity: focused ? 1 : 0.48 }}
          />
        ),
      })}
    >
      <Tabs.Screen name="mine" options={{ title: t('막장', 'Mine') }} />
      <Tabs.Screen name="map" options={{ title: t('맵', 'Map') }} />
      <Tabs.Screen name="status" options={{ title: t('현황', 'Status') }} />
      <Tabs.Screen name="profile" options={{ title: 'MY' }} />
    </Tabs>
  );
}
