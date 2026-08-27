import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { miningSpeed, pickaxeForReferrals } from '@/domain/mining';
import { useAppState } from '@/state/app-state';
import { Button, Card, Header, Metric, Screen } from '@/ui/components';
import { palette } from '@/ui/theme';

export function ProfileScreen() {
  const { state, setWallet, withdrawAll, logout } = useAppState();
  const user = state.user!;
  const [wallet, setWalletInput] = useState(user.walletAddress);
  const pickaxe = pickaxeForReferrals(user.referrals);
  const currentSpeed = miningSpeed(user.level, pickaxe);
  const nextLevel = Math.min(10, user.level + 1);

  function saveWallet() {
    const normalized = wallet.trim();
    if (normalized && normalized.length !== 44) return Alert.alert('주소를 확인해 주세요', 'SASEUL 지갑 주소는 44자리여야 합니다.');
    setWallet(normalized);
    Alert.alert('저장 완료', normalized ? 'PSL_Wallet 주소가 등록되었습니다.' : '등록된 주소를 삭제했습니다.');
  }

  async function handleWithdraw() {
    try { await withdrawAll(); } catch (error) { Alert.alert('출금 안내', error instanceof Error ? error.message : '출금을 진행할 수 없습니다.'); }
  }

  return (
    <Screen>
      <Card style={styles.levelCard}>
        <View style={styles.levelHeader}>
          <View>
            <Text style={styles.levelEyebrow}>노련미 성장 단계</Text>
            <Text style={styles.levelTitle}>현재 Lv.{user.level} · {currentSpeed.toFixed(1)}m/hr</Text>
          </View>
          <Text style={styles.levelReferral}>초대 {user.referrals}명</Text>
        </View>
        <View style={styles.levelGauge} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 10, now: user.level }}>
          {Array.from({ length: 11 }, (_, level) => (
            <View key={level} style={styles.levelStepWrap}>
              <View style={[styles.levelStep, level <= user.level && styles.levelStepActive, level === user.level && styles.levelStepCurrent]} />
              {(level === 0 || level === 5 || level === 10) && <Text style={styles.levelStepLabel}>Lv.{level}</Text>}
            </View>
          ))}
        </View>
        <Text style={styles.levelHelp}>기본 1.0 + 노련미 {(user.level * 0.1).toFixed(1)} + 곡괭이 {(currentSpeed - (1 + user.level * 0.1)).toFixed(1)}m/hr</Text>
        <Text style={styles.levelNext}>{user.level < 10 ? `다음 Lv.${nextLevel} 노련미 속도: ${(1 + nextLevel * 0.1).toFixed(1)}m/hr` : '최고 노련미 단계에 도달했습니다'}</Text>
      </Card>
      <Header eyebrow="MINER PROFILE" title={user.name} right={user.piVerified ? <View style={styles.verified}><Text style={styles.verifiedText}>π VERIFIED</Text></View> : null} />
      <Card style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>보유 PSL</Text>
        <Text style={styles.balance}>{user.pslBalance.toLocaleString()}</Text>
        <Text style={styles.balanceSymbol}>PSL</Text>
        <Button title="전체 잔액 출금" onPress={handleWithdraw} disabled={user.pslBalance <= 0 || !user.walletAddress} />
        <Text style={styles.fee}>출금 시 SASEUL 네트워크 SL 수수료는 사용자가 부담합니다.</Text>
      </Card>

      <Card>
        <View style={styles.metrics}>
          <Metric label="노련미" value={`Lv.${user.level}`} />
          <Metric label="채굴속도" value={`${miningSpeed(user.level, pickaxe).toFixed(1)}m/hr`} accent />
        </View>
        <View style={styles.metrics}>
          <Metric label="초대한 친구" value={`${user.referrals}명`} />
          <Metric label="완료 막장" value={`${user.completedMines}개`} />
        </View>
        <Button title="친구 초대하기" secondary onPress={() => Alert.alert('초대 링크', '운영 백엔드 연결 후 개인 추천 링크가 생성됩니다.')} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>PSL_Wallet 연결</Text>
        <Text style={styles.helper}>출금 트랜잭션은 연결된 지갑에서 직접 확인하고 서명합니다.</Text>
        <TextInput
          value={wallet}
          onChangeText={setWalletInput}
          placeholder="44자리 SASEUL 주소"
          placeholderTextColor={palette.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <Button title="지갑 주소 저장" secondary onPress={saveWallet} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>계정 및 인증</Text>
        <View style={styles.identityRow}><Text style={styles.identityLabel}>로그인</Text><Text style={styles.identityValue}>{user.provider.toUpperCase()}</Text></View>
        <View style={styles.identityRow}><Text style={styles.identityLabel}>1인 1계정 검증</Text><Text style={styles.identityValue}>{user.piVerified ? 'Pi 인증 완료' : '추후 Pi 연결 가능'}</Text></View>
        <Button title="로그아웃" secondary onPress={logout} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  verified: { backgroundColor: palette.gold, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 13 },
  verifiedText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  balanceCard: { alignItems: 'center', backgroundColor: palette.hero, borderColor: palette.hero },
  balanceLabel: { color: palette.mint, fontSize: 12, fontWeight: '800' },
  balance: { color: palette.onHero, fontSize: 38, fontWeight: '900' },
  balanceSymbol: { color: '#AFA0FF', fontWeight: '900', marginTop: -8, marginBottom: 6 },
  fee: { color: '#C8C4D8', fontSize: 11, textAlign: 'center' },
  metrics: { flexDirection: 'row', gap: 10, paddingVertical: 3 },
  levelCard: { backgroundColor: palette.surface2, borderColor: '#D9D1FF' },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  levelEyebrow: { color: palette.goldDark, fontSize: 11, fontWeight: '900' },
  levelTitle: { color: palette.text, fontSize: 20, fontWeight: '900', marginTop: 3 },
  levelReferral: { color: palette.goldDark, fontSize: 11, fontWeight: '800', backgroundColor: '#FFF', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10 },
  levelGauge: { flexDirection: 'row', marginTop: 15, marginBottom: 17, gap: 3 },
  levelStepWrap: { flex: 1, position: 'relative' },
  levelStep: { height: 10, borderRadius: 5, backgroundColor: '#DCD8EE' },
  levelStepActive: { backgroundColor: palette.gold },
  levelStepCurrent: { backgroundColor: palette.goldDark, transform: [{ scaleY: 1.5 }] },
  levelStepLabel: { position: 'absolute', top: 13, alignSelf: 'center', color: palette.muted, fontSize: 8, fontWeight: '700' },
  levelHelp: { color: palette.text, fontSize: 12, fontWeight: '800' },
  levelNext: { color: palette.goldDark, fontSize: 11, marginTop: 4, fontWeight: '700' },
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '900' },
  helper: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  input: { minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.background, color: palette.text, paddingHorizontal: 15, fontSize: 13 },
  identityRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  identityLabel: { color: palette.muted, fontSize: 13 },
  identityValue: { color: palette.text, fontSize: 13, fontWeight: '800' },
});
