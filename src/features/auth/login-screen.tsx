import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { useAppState } from '@/state/app-state';
import { Button, Card, Screen } from '@/ui/components';
import { palette } from '@/ui/theme';

export function LoginScreen() {
  const { login } = useAppState();
  return (
    <Screen>
      <StatusBar style="dark" />
      <View style={styles.hero}>
        <View style={styles.logo}><Text style={styles.logoText}>P</Text></View>
        <Text style={styles.kicker}>SASEUL BLOCKCHAIN</Text>
        <Text style={styles.title}>PSL Mining</Text>
        <Text style={styles.copy}>지구 어딘가에 숨겨진 888개의 PSL 광맥을 찾아보세요.</Text>
      </View>
      <Card>
        <Text style={styles.cardTitle}>광부 계정 만들기</Text>
        <Text style={styles.helper}>Pi 로그인은 1인 1계정 검증에 활용됩니다. 현재 버튼은 개발용 로컬 인증입니다.</Text>
        <Button title="Pi로 계속하기 · 추천" onPress={() => login('pi')} />
        <Button title="Google로 계속하기" secondary onPress={() => login('google')} />
        <Button title="Apple로 계속하기" secondary onPress={() => login('apple')} />
      </Card>
      <Text style={styles.terms}>계속하면 서비스 이용약관과 개인정보 처리방침에 동의하게 됩니다.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: 44, paddingBottom: 20 },
  logo: { width: 88, height: 88, borderRadius: 24, backgroundColor: palette.gold, alignItems: 'center', justifyContent: 'center', marginBottom: 22, shadowColor: palette.goldDark, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.26, shadowRadius: 24, elevation: 4 },
  logoText: { color: '#FFFFFF', fontSize: 46, fontWeight: '900' },
  kicker: { color: palette.green, fontWeight: '800', fontSize: 11, letterSpacing: 2.5 },
  title: { color: palette.text, fontSize: 42, fontWeight: '900', marginTop: 8 },
  copy: { color: palette.muted, fontSize: 16, lineHeight: 24, textAlign: 'center', maxWidth: 300, marginTop: 12 },
  cardTitle: { color: palette.text, fontSize: 20, fontWeight: '900' },
  helper: { color: palette.muted, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  terms: { color: palette.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', paddingHorizontal: 28 },
});
