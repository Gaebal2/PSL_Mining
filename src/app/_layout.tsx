import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { AppStateProvider, useAppState } from '@/state/app-state';

SplashScreen.preventAutoHideAsync();

const miningTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#F4C95D',
    background: '#08130F',
    card: '#0E1D17',
    text: '#F6F3E8',
    border: '#20352A',
  },
};

function RootNavigator() {
  const { hydrated } = useAppState();
  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync();
  }, [hydrated]);

  return (
    <ThemeProvider value={miningTheme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#08130F' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppStateProvider>
      <RootNavigator />
    </AppStateProvider>
  );
}
