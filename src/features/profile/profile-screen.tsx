import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { miningSpeed, PICKAXE_NAMES, pickaxeForReferrals, referralSpeedBonus } from '@/domain/mining';
import { useAppState } from '@/state/app-state';
import { Button, Card, Header, Metric, Screen } from '@/ui/components';
import { useAppDialog } from '@/ui/app-dialog';
import { palette } from '@/ui/theme';

export function ProfileScreen() {
  const { state, setWallet, withdrawAll, logout } = useAppState();
  const user = state.user!;
  const showDialog = useAppDialog();
  const [wallet, setWalletInput] = useState(user.walletAddress);
  const [isWalletEditing, setIsWalletEditing] = useState(!user.walletAddress);
  const pickaxe = pickaxeForReferrals(user.referrals);
  const currentSpeed = miningSpeed(user.level, pickaxe);

  function saveWallet() {
    const normalized = wallet.trim();
    if (normalized && normalized.length !== 44) return showDialog({ title: '주소를 확인해 주세요', message: 'SASEUL 지갑 주소는 44자리여야 합니다.' });
    setWallet(normalized);
    setWalletInput(normalized);
    setIsWalletEditing(!normalized);
    showDialog({ title: '저장 완료', message: normalized ? 'PSL_Wallet 주소가 등록되었습니다.' : '등록된 주소를 삭제했습니다.' });
  }

  function handleWalletButton() {
    if (isWalletEditing) {
      saveWallet();
      return;
    }
    setIsWalletEditing(true);
  }

  async function handleWithdraw() {
    try { await withdrawAll(); } catch (error) { showDialog({ title: '출금 안내', message: error instanceof Error ? error.message : '출금을 진행할 수 없습니다.' }); }
  }

  return (
    <Screen>
      <View style={styles.topHeader}><Header eyebrow="MINER PROFILE" title={user.name} right={user.piVerified ? <View style={styles.verified}><Text style={styles.verifiedText}>π VERIFIED</Text></View> : null} /></View>
      <Card style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>보유 PSL</Text>
        <Text style={styles.balance}>{user.pslBalance.toLocaleString()}</Text>
        <Text style={styles.balanceSymbol}>PSL</Text>
        <Button title="전체 잔액 출금" onPress={handleWithdraw} disabled={user.pslBalance <= 0 || !user.walletAddress} />
      </Card>
      <Card style={styles.levelCard}>
        <View style={styles.levelHeader}>
          <View>
            <Text style={styles.levelEyebrow}>숙련도 성장 단계</Text>
            <Text style={styles.levelTitle}>현재 Lv.{user.level} · {currentSpeed.toFixed(1)}m/hr</Text>
          </View>
          <Text style={styles.levelReferral}>{PICKAXE_NAMES[pickaxe]}</Text>
        </View>
        <View style={styles.levelGauge} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 10, now: user.level }}>
          {Array.from({ length: 11 }, (_, level) => (
            <View key={level} style={styles.levelStepWrap}>
              <View style={[styles.levelStep, level <= user.level && styles.levelStepActive, level === user.level && styles.levelStepCurrent]} />
              {(level === 0 || level === 5 || level === 10) && <Text style={styles.levelStepLabel}>Lv.{level}</Text>}
            </View>
          ))}
        </View>
        <View style={styles.gaugeDivider} />
        <View style={styles.levelHeader}>
          <View>
            <Text style={styles.levelEyebrow}>초대인원별 채굴속도 증가</Text>
            <Text style={styles.referralTitle}>현재 +{referralSpeedBonus(user.referrals).toFixed(1)}m/hr</Text>
          </View>
          <Text style={styles.levelReferral}>초대인원 {user.referrals}명</Text>
        </View>
        <View style={styles.levelGauge} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 10, now: Math.min(10, user.referrals) }}>
          {Array.from({ length: 11 }, (_, referrals) => (
            <View key={referrals} style={styles.levelStepWrap}>
              <View style={[styles.levelStep, referrals <= user.referrals && styles.referralStepActive, referrals === Math.min(10, user.referrals) && styles.levelStepCurrent]} />
              {(referrals === 0 || referrals === 5 || referrals === 10) && <Text style={styles.levelStepLabel}>{referrals === 10 ? '10명+' : `${referrals}명`}</Text>}
            </View>
          ))}
        </View>
      </Card>
      <Card>
        <View style={styles.metrics}>
          <Metric label="숙련도" value={`Lv.${user.level}`} />
          <Metric label="채굴속도" value={`${miningSpeed(user.level, pickaxe).toFixed(1)}m/hr`} accent />
        </View>
        <View style={styles.metrics}>
          <Metric label="초대한 친구" value={`${user.referrals}명`} />
          <Metric label="완료 막장" value={`${user.completedMines}개`} />
        </View>
        <Button title="친구 초대하기" secondary onPress={() => showDialog({ title: '초대 링크', message: '운영 백엔드 연결 후 개인 추천 링크가 생성됩니다.' })} />
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
          editable={isWalletEditing}
          selectTextOnFocus={isWalletEditing}
          style={[styles.input, !isWalletEditing && styles.inputLocked]}
        />
        <Button title={isWalletEditing ? '지갑 주소 저장' : '지갑 주소 변경'} secondary onPress={handleWalletButton} />
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
  topHeader: { marginTop: -6 },
  verified: { backgroundColor: palette.gold, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 13 },
  verifiedText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  balanceCard: { alignItems: 'center', backgroundColor: palette.hero, borderColor: palette.hero },
  balanceLabel: { color: palette.mint, fontSize: 12, fontWeight: '800' },
  balance: { color: palette.onHero, fontSize: 38, fontWeight: '900' },
  balanceSymbol: { color: '#AFA0FF', fontWeight: '900', marginTop: -8, marginBottom: 6 },
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
  gaugeDivider: { height: 1, backgroundColor: '#D5CEF5', marginVertical: 16 },
  referralTitle: { color: palette.text, fontSize: 18, fontWeight: '900', marginTop: 3 },
  referralStepActive: { backgroundColor: palette.green },
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '900' },
  helper: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  input: { minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.background, color: palette.text, paddingHorizontal: 15, fontSize: 13 },
  inputLocked: { backgroundColor: palette.surface2, color: palette.muted, opacity: 0.78 },
  identityRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  identityLabel: { color: palette.muted, fontSize: 13 },
  identityValue: { color: palette.text, fontSize: 13, fontWeight: '800' },
});
