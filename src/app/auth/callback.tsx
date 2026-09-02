import { Redirect } from 'expo-router';

// The auth browser returns through this route. Keeping it registered prevents
// Expo Router from briefly rendering its Unmatched Route screen on Android.
export default function AuthCallbackScreen() {
  return <Redirect href="/" />;
}
