import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { miningSpeed, PICKAXE_NAMES, pickaxeForReferrals, referralSpeedBonus } from '@/domain/mining';
import { useAppState } from '@/state/app-state';
import { useLocale } from '@/state/locale';
import { Button, Card, Header, Metric, Screen } from '@/ui/components';
import { useAppDialog } from '@/ui/app-dialog';
import { palette } from '@/ui/theme';

export function ProfileScreen() {
  const { state, setWallet, setTestMiner, withdrawAll, logout } = useAppState();
  const user = state.user!;
  const showDialog = useAppDialog();
  const { locale, toggleLocale, t } = useLocale();
  const [wallet, setWalletInput] = useState(user.walletAddress);
  const [isWalletEditing, setIsWalletEditing] = useState(!user.walletAddress);
  const pickaxe = pickaxeForReferrals(user.referrals);
  const currentSpeed = miningSpeed(user.level, pickaxe, user.testMiner);

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
      <View style={styles.topHeader}><Header eyebrow="MINER PROFILE" title={user.name} right={<Pressable accessibilityRole="button" accessibilityLabel={t('언어 변경', 'Change language')} onPress={toggleLocale} style={styles.languageToggle}><Text style={[styles.languageOption, locale === 'ko' && styles.languageOptionActive]}>한국어</Text><View style={styles.languageDivider} /><Text style={[styles.languageOption, locale === 'en' && styles.languageOptionActive]}>ENGLISH</Text></Pressable>} /></View>
      <Card style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>{t('보유 PSL', 'PSL BALANCE')}</Text>
        <Text style={styles.balance}>{user.pslBalance.toLocaleString()}</Text>
        <Text style={styles.balanceSymbol}>PSL</Text>
        <Button title={t('전체 잔액 출금', 'Withdraw full balance')} onPress={handleWithdraw} disabled={user.pslBalance <= 0 || !user.walletAddress} />
      </Card>
      <Card style={styles.testModeCard}>
        <Text style={styles.sectionTitle}>{t('임시 채굴 테스트 모드', 'Temporary mining test mode')}</Text>
        <Text style={styles.helper}>{t('테스트할 채굴자 속도를 선택해 주세요.', 'Choose a miner speed for testing.')}</Text>
        <View style={styles.modeRow}>
          <MiningModeButton title={t('정상 채굴자', 'Normal miner')} active={!user.testMiner} onPress={() => setTestMiner(false)} />
          <MiningModeButton title={t('테스트 채굴자', 'Test miner')} active={user.testMiner} onPress={() => setTestMiner(true)} />
        </View>
        <Text style={styles.modeSpeed}>{t('현재 채굴속도', 'Current mining speed')} {currentSpeed.toFixed(1)}m/hr</Text>
      </Card>
      <Card style={styles.levelCard}>
        <View style={styles.levelHeader}>
          <View>
            <Text style={styles.levelEyebrow}>{t('숙련도 성장 단계', 'Skill progression')}</Text>
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
          <Metric label={t('숙련도', 'Skill level')} value={`Lv.${user.level}`} />
          <Metric label={t('채굴속도', 'Mining speed')} value={`${currentSpeed.toFixed(1)}m/hr`} accent />
        </View>
        <View style={styles.metrics}>
          <Metric label={t('초대한 친구', 'Friends invited')} value={locale === 'ko' ? `${user.referrals}명` : `${user.referrals}`} />
          <Metric label={t('완료 막장', 'Mines completed')} value={locale === 'ko' ? `${user.completedMines}개` : `${user.completedMines}`} />
        </View>
        <Button title={t('친구 초대하기', 'Invite friends')} secondary onPress={() => showDialog({ title: t('초대 링크', 'Invite link'), message: t('운영 백엔드 연결 후 개인 추천 링크가 생성됩니다.', 'Your personal referral link will be created after the production backend is connected.') })} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t('PSL_Wallet 연결', 'Connect PSL_Wallet')}</Text>
        <Text style={styles.helper}>{t('출금 트랜잭션은 연결된 지갑에서 직접 확인하고 서명합니다.', 'Review and sign withdrawal transactions in your connected wallet.')}</Text>
        <TextInput
          value={wallet}
          onChangeText={setWalletInput}
          placeholder={t('44자리 SASEUL 주소', '44-character SASEUL address')}
          placeholderTextColor={palette.muted}
          autoCapitalize="none"
          autoCorrect={false}
          editable={isWalletEditing}
          selectTextOnFocus={isWalletEditing}
          style={[styles.input, !isWalletEditing && styles.inputLocked]}
        />
        <Button title={isWalletEditing ? t('지갑 주소 저장', 'Save wallet address') : t('지갑 주소 변경', 'Change wallet address')} secondary onPress={handleWalletButton} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t('계정 및 인증', 'Account & verification')}</Text>
        <View style={styles.identityRow}><Text style={styles.identityLabel}>{t('로그인', 'Sign-in')}</Text><Text style={styles.identityValue}>{user.provider.toUpperCase()}</Text></View>
        <View style={styles.identityRow}><Text style={styles.identityLabel}>{t('1인 1계정 검증', 'One-person verification')}</Text><Text style={styles.identityValue}>{user.piVerified ? t('Pi 인증 완료', 'Pi verified') : t('추후 Pi 연결 가능', 'Pi can be linked later')}</Text></View>
        <Button title={t('로그아웃', 'Sign out')} secondary onPress={logout} />
      </Card>
    </Screen>
  );
}

function MiningModeButton({ title, active, onPress }: { title: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.modeButton, active && styles.modeButtonActive, pressed && styles.modeButtonPressed]}>
    <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>{title}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  topHeader: { marginTop: -6 },
  languageToggle: { flexDirection: 'row', alignItems: 'center', borderRadius: 13, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface2, paddingHorizontal: 8, paddingVertical: 8 },
  languageOption: { color: palette.muted, fontSize: 9, fontWeight: '800' },
  languageOptionActive: { color: palette.goldDark },
  languageDivider: { width: 1, height: 12, backgroundColor: palette.border, marginHorizontal: 6 },
  balanceCard: { alignItems: 'center', backgroundColor: palette.hero, borderColor: palette.hero },
  balanceLabel: { color: palette.mint, fontSize: 12, fontWeight: '800' },
  balance: { color: palette.onHero, fontSize: 38, fontWeight: '900' },
  balanceSymbol: { color: '#AFA0FF', fontWeight: '900', marginTop: -8, marginBottom: 6 },
  testModeCard: { borderColor: '#D9D1FF', backgroundColor: '#FBFAFF' },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeButton: { flex: 1, minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface2, alignItems: 'center', justifyContent: 'center' },
  modeButtonActive: { borderColor: palette.gold, backgroundColor: palette.gold },
  modeButtonPressed: { opacity: 0.78 },
  modeButtonText: { color: palette.text, fontSize: 13, fontWeight: '900' },
  modeButtonTextActive: { color: '#FFFFFF' },
  modeSpeed: { color: palette.goldDark, fontSize: 13, fontWeight: '900', textAlign: 'center' },
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
