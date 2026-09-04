import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import mobileAds from 'react-native-google-mobile-ads';

import { AppStateProvider, useAppState } from '@/state/app-state';
import { LocaleProvider, useLocale } from '@/state/locale';
import { AppDialogProvider, useAppDialog } from '@/ui/app-dialog';

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
  const { hydrated, state, clearAbandonmentNotice, clearConcurrentLoginNotice, syncProgress } = useAppState();
  const { t } = useLocale();
  const showDialog = useAppDialog();
  useEffect(() => {
    if (hydrated) {
      syncProgress();
      SplashScreen.hideAsync();
    }
  }, [hydrated, syncProgress]);
  useEffect(() => {
    if (!state.abandonmentNotice) return;
    showDialog({ title: t('자동 퇴장 안내', 'Automatic exit'), message: t('7일간 채굴활동이 없어서 막장을 자동으로 나왔습니다.', 'You were automatically removed from the mine because there was no mining activity for 7 days.') });
    clearAbandonmentNotice();
  }, [clearAbandonmentNotice, showDialog, state.abandonmentNotice, t]);
  useEffect(() => {
    if (!state.concurrentLoginNotice) return;
    showDialog({
      title: t('다른 기기 로그인 안내', 'Signed in on another device'),
      message: t('동일한 계정이 다른 스마트폰에서 로그인되어 기존 채굴중인 막장에서 자동으로 나왔습니다. 해당 막장의 채굴률은 초기화되었습니다.', 'The same account signed in on another phone, so its active mine was exited and its progress was reset.'),
    });
    clearConcurrentLoginNotice();
  }, [clearConcurrentLoginNotice, showDialog, state.concurrentLoginNotice, t]);

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
  useEffect(() => {
    mobileAds().initialize().catch(console.warn);
  }, []);

  return (
    <LocaleProvider>
      <AppStateProvider>
        <AppDialogProvider>
          <RootNavigator />
        </AppDialogProvider>
      </AppStateProvider>
    </LocaleProvider>
  );
}
