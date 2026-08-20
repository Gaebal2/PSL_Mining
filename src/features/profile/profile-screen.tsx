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
          placeholderTextColor="#63766C"
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
  verified: { backgroundColor: '#6C4BA0', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 13 },
  verifiedText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  balanceCard: { alignItems: 'center', backgroundColor: '#173B2C', borderColor: '#2B5B45' },
  balanceLabel: { color: palette.green, fontSize: 12, fontWeight: '800' },
  balance: { color: palette.text, fontSize: 38, fontWeight: '900' },
  balanceSymbol: { color: palette.gold, fontWeight: '900', marginTop: -8, marginBottom: 6 },
  fee: { color: palette.muted, fontSize: 11, textAlign: 'center' },
  metrics: { flexDirection: 'row', gap: 10, paddingVertical: 3 },
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '900' },
  helper: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  input: { minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: palette.border, backgroundColor: '#0A1611', color: palette.text, paddingHorizontal: 15, fontSize: 13 },
  identityRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  identityLabel: { color: palette.muted, fontSize: 13 },
  identityValue: { color: palette.text, fontSize: 13, fontWeight: '800' },
});
