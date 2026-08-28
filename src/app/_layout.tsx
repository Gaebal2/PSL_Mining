import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { AppStateProvider, useAppState } from '@/state/app-state';
import { AppDialogProvider } from '@/ui/app-dialog';

SplashScreen.preventAutoHideAsync();

const miningTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#7157FF',
    background: '#F4F6FB',
    card: '#FFFFFF',
    text: '#10131A',
    border: '#E5E8EF',
  },
};

function RootNavigator() {
  const { hydrated } = useAppState();
  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync();
  }, [hydrated]);

  return (
    <ThemeProvider value={miningTheme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F4F6FB' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppStateProvider>
      <AppDialogProvider>
        <RootNavigator />
      </AppDialogProvider>
    </AppStateProvider>
  );
}
