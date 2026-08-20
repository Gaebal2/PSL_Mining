import { Redirect } from 'expo-router';

import { LoginScreen } from '@/features/auth/login-screen';
import { useAppState } from '@/state/app-state';

export default function EntryScreen() {
  const { state, hydrated } = useAppState();
  if (!hydrated) return null;
  if (state.user) return <Redirect href="/(tabs)/map" />;
  return <LoginScreen />;
}
