import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useEffect, useRef, useState } from "react";
import Svg, { Rect } from "react-native-svg";
import {
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  createWalletChallenge,
  verifyWalletChallenge,
  WalletChallenge,
} from "@/data/mining-backend";
import { GridMine, referralSpeedBonus } from "@/domain/mining";
import { useAppState } from "@/state/app-state";
import { useLocale } from "@/state/locale";
import { useAppDialog } from "@/ui/app-dialog";
import { Button, Card, Header, Screen } from "@/ui/components";
import { palette } from "@/ui/theme";

export function ProfileScreen() {
  const { state, setVerifiedWallet, setPslWallet, withdrawAll, logout } =
    useAppState();
  const user = state.user!;
  const showDialog = useAppDialog();
  const { locale, toggleLocale, t } = useLocale();
  const [wallet, setWalletInput] = useState("");
  const [challenge, setChallenge] = useState<WalletChallenge | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const walletRequestActive = useRef(false);
  const [countdownClock, setCountdownClock] = useState(() => Date.now());
  const [pslWallet, setPslWalletInput] = useState(user.pslWalletAddress);
  const [pslWalletBusy, setPslWalletBusy] = useState(false);
  const [isPslWalletEditing, setIsPslWalletEditing] = useState(
    !user.pslWalletAddress,
  );
  const skillBonus = user.level * 0.1;
  const firstVisibleLevel = Math.max(0, user.level - 10);
  const actualMiningHistory = Object.values(state.mines).filter(
    (mine) =>
      mine.completed &&
      mine.completedByUserId === user.id &&
      ["kingWhale", "whale", "shrimp"].includes(mine.reward),
  );
  const testMiningHistory: Pick<GridMine, "id" | "reward">[] = [
    { id: "TEST-KING-WHALE-001", reward: "kingWhale" },
    ...Array.from({ length: 3 }, (_, index) => ({
      id: `TEST-WHALE-${String(index + 1).padStart(3, "0")}`,
      reward: "whale" as const,
    })),
    ...Array.from({ length: 10 }, (_, index) => ({
      id: `TEST-SHRIMP-${String(index + 1).padStart(3, "0")}`,
      reward: "shrimp" as const,
    })),
  ];
  const miningHistory: Pick<GridMine, "id" | "reward">[] = [
    ...testMiningHistory,
    ...actualMiningHistory,
  ];
  const remainingSeconds = challenge
    ? Math.max(
        0,
        Math.ceil(
          (new Date(challenge.expiresAt).getTime() - countdownClock) / 1000,
        ),
      )
    : 0;
  const remainingTime =
    String(Math.floor(remainingSeconds / 60)).padStart(2, "0") +
    ":" +
    String(remainingSeconds % 60).padStart(2, "0");
  const abbreviatedChallengeWallet = challenge
    ? `${challenge.walletAddress.slice(0, 5)}...${challenge.walletAddress.slice(-5)}`
    : "";

  useEffect(() => {
    if (!challenge) return;
    const timer = setInterval(() => setCountdownClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [challenge]);

  async function beginWalletVerification(allowTransfer = false) {
    if (walletRequestActive.current) return;
    walletRequestActive.current = true;
    setWalletBusy(true);
    try {
      const next = await createWalletChallenge(wallet, allowTransfer);
      if (next.ownershipConflict) {
        const accountName = next.previousAccountName || t("기존 계정", "an existing account");
        showDialog({
          title: t("이미 인증된 Pi 지갑", "Pi wallet already verified"),
          message: t(
            `이미 기존의 "${accountName}" 계정에서 이 Pi 지갑 소유권을 인증하였습니다.\n\n여기서 다시 이 Pi 지갑 소유권을 인증하면 기존에 인증되었던 계정 및 기기의 채굴 상태는 초기화됩니다.\n\n계속 하시겠습니까?`,
            `This Pi wallet is already verified by "${accountName}".\n\nIf you verify it here again, the mining state of the previously verified account and device will be reset.\n\nDo you want to continue?`,
          ),
          actions: [
            { text: t("취소", "Cancel"), style: "cancel" },
            { text: t("계속", "Continue"), style: "destructive", onPress: () => { void beginWalletVerification(true); } },
          ],
        });
        return;
      }
      if (next.alreadyVerified) {
        setVerifiedWallet(next.walletAddress);
        return;
      }
      setCountdownClock(Date.now());
      setChallenge(next);
    } catch (error) {
      showDialog({
        title: t("인증 요청 실패", "Unable to start verification"),
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      walletRequestActive.current = false;
      setWalletBusy(false);
    }
  }

  async function checkWalletVerification() {
    if (!challenge || walletRequestActive.current || remainingSeconds <= 0) return;
    walletRequestActive.current = true;
    setWalletBusy(true);
    try {
      const result = await verifyWalletChallenge(challenge.id);
      if (!result.verified || !result.walletAddress) {
        showDialog({
          title: t("입금 확인 중", "Waiting for transaction"),
          message: t(
            `Pi ${challenge.network === "mainnet" ? "Mainnet" : "Testnet"}에서 이 지갑이 보낸 최근 결제 ${result.checkedPaymentCount ?? 0}건을 확인했지만, 현재 Muxed 주소와 ${Number(challenge.amount).toFixed(2)} Pi 조건에 맞는 거래를 찾지 못했습니다. 네트워크와 주소를 확인한 후 다시 시도해 주세요.`,
            `Checked ${result.checkedPaymentCount ?? 0} recent payments from this wallet on Pi ${challenge.network === "mainnet" ? "Mainnet" : "Testnet"}, but none matched the current Muxed address and ${Number(challenge.amount).toFixed(2)} Pi. Check the network and address, then try again.`,
          ),
        });
        return;
      }
      setVerifiedWallet(result.walletAddress);
      setChallenge(null);
      showDialog({
        title: t("Pi 지갑 인증 완료", "Pi wallet verified"),
        message: t(
          "이제 보유한 PSL의 출금을 신청할 수 있습니다.",
          "You can now request a withdrawal of your PSL balance.",
        ),
      });
    } catch (error) {
      showDialog({
        title: t("입금 확인 실패", "Verification failed"),
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      walletRequestActive.current = false;
      setWalletBusy(false);
    }
  }

  async function handleWithdraw() {
    try {
      await withdrawAll();
    } catch (error) {
      showDialog({
        title: "출금 안내",
        message:
          error instanceof Error ? error.message : "출금을 진행할 수 없습니다.",
      });
    }
  }

  async function savePslWallet() {
    const normalized = pslWallet.trim();
    if (normalized && normalized.length !== 44) {
      showDialog({
        title: t("주소를 확인해 주세요", "Check the address"),
        message: t(
          "SASEUL 지갑 주소는 44자리여야 합니다.",
          "A SASEUL wallet address must be 44 characters.",
        ),
      });
      return;
    }
    setPslWalletBusy(true);
    try {
      await setPslWallet(normalized);
      setIsPslWalletEditing(false);
      showDialog({
        title: t("저장 완료", "Saved"),
        message: t(
          "PSL 토큰 지갑 주소가 저장되었습니다.",
          "The PSL token wallet address has been saved.",
        ),
      });
    } catch (error) {
      showDialog({
        title: t("저장 실패", "Unable to save"),
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setPslWalletBusy(false);
    }
  }

  function inviteFriend() {
    Share.share({
      message: t(
        `PSL Mining에 초대합니다. 초대 코드: ${user.id}`,
        `You're invited to PSL Mining. Invitation code: ${user.id}`,
      ),
    }).catch((error) =>
      showDialog({
        title: t("공유 실패", "Unable to share"),
        message: String(error),
      }),
    );
  }

  function confirmLogout() {
    showDialog({
      title: t("로그아웃", "Sign out"),
      message: t(
        "이 기기에서 로그아웃하시겠습니까?",
        "Do you want to sign out on this device?",
      ),
      actions: [
        { text: t("취소", "Cancel"), style: "cancel" },
        {
          text: t("로그아웃", "Sign out"),
          style: "destructive",
          onPress: () => {
            logout().catch((error) =>
              showDialog({
                title: t("로그아웃 실패", "Sign out failed"),
                message: error instanceof Error ? error.message : String(error),
              }),
            );
          },
        },
      ],
    });
  }

  return (
    <Screen>
      <View style={styles.topHeader}>
        <Header
          eyebrow="MINER PROFILE"
          title={user.name}
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("언어 변경", "Change language")}
              onPress={toggleLocale}
              style={styles.languageToggle}
            >
              <Text
                style={[
                  styles.languageOption,
                  locale === "ko" && styles.languageOptionActive,
                ]}
              >
                한국어
              </Text>
              <View style={styles.languageDivider} />
              <Text
                style={[
                  styles.languageOption,
                  locale === "en" && styles.languageOptionActive,
                ]}
              >
                ENGLISH
              </Text>
            </Pressable>
          }
        />
      </View>
      <Card style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>{t("보유 PSL", "PSL BALANCE")}</Text>
        <Text style={styles.balance}>{user.pslBalance.toLocaleString()}</Text>
        <Text style={styles.balanceSymbol}>PSL</Text>
        <Button
          title={t("전체 잔액 출금신청", "Withdraw full balance")}
          onPress={handleWithdraw}
          disabled={
            user.pslBalance <= 0 || !user.piVerified || !user.pslWalletAddress
          }
        />
      </Card>
      <Card style={styles.levelCard}>
        <View style={styles.levelHeader}>
          <View>
            <Text style={styles.levelEyebrow}>
              {t("숙련도 성장 단계", "Skill progression")}
            </Text>
            <Text style={styles.levelTitle}>
              {t("현재", "Current")} +{skillBonus.toFixed(1)}m/hr
            </Text>
          </View>
          <InfoButton
            accessibilityLabel={t("숙련도 안내", "Skill information")}
            onPress={() =>
              showDialog({
                title: t("숙련도 성장단계", "Skill progression"),
                message: t(
                  "채굴장(Grid) 1개를 채굴 완료할 때마다 Lv1(+0.1m/hr)씩 채굴 속도가 증가 합니다.",
                  "Each completed mine (Grid) raises your skill by Lv1 and increases mining speed by +0.1m/hr.",
                ),
              })
            }
          />
        </View>
        <View
          style={styles.levelGauge}
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: Math.max(10, user.level),
            now: user.level,
          }}
        >
          {Array.from(
            { length: 11 },
            (_, index) => firstVisibleLevel + index,
          ).map((level) => (
            <View key={level} style={styles.levelStepWrap}>
              <View
                style={[
                  styles.levelStep,
                  level <= user.level && styles.levelStepActive,
                  level === user.level && styles.levelStepCurrent,
                ]}
              />
              {(level === firstVisibleLevel ||
                level === firstVisibleLevel + 5 ||
                level === user.level) && (
                <Text style={styles.levelStepLabel}>Lv.{level}</Text>
              )}
            </View>
          ))}
        </View>
        <View style={styles.gaugeDivider} />
        <View style={styles.levelHeader}>
          <View>
            <Text style={styles.levelEyebrow}>
              {t("충성도 성장 단계", "Loyalty progression")}
            </Text>
            <Text style={styles.referralTitle}>
              {t("현재", "Current")} +
              {referralSpeedBonus(user.referrals).toFixed(1)}m/hr
            </Text>
          </View>
          <InfoButton
            accessibilityLabel={t("충성도 안내", "Loyalty information")}
            onPress={() =>
              showDialog({
                title: t("충성도 성장단계", "Loyalty progression"),
                message: t(
                  "친구를 채굴에 초대하면 1명당 채굴속도가 +0.5m/hr씩 증가합니다. 초대 제한 최대 10명",
                  "Each friend invited to mining increases mining speed by +0.5m/hr. The invitation bonus is limited to 10 friends.",
                ),
              })
            }
          />
        </View>
        <View
          style={styles.levelGauge}
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: 10,
            now: Math.min(10, user.referrals),
          }}
        >
          {Array.from({ length: 11 }, (_, referrals) => (
            <View key={referrals} style={styles.levelStepWrap}>
              <View
                style={[
                  styles.levelStep,
                  referrals <= user.referrals && styles.referralStepActive,
                  referrals === Math.min(10, user.referrals) &&
                    styles.levelStepCurrent,
                ]}
              />
              {(referrals === 0 || referrals === 5 || referrals === 10) && (
                <Text style={styles.levelStepLabel}>
                  {referrals === 10 ? "10명+" : `${referrals}명`}
                </Text>
              )}
            </View>
          ))}
        </View>
      </Card>
      <Card>
        <Text style={styles.sectionTitle}>
          {t("초대한 친구", "Invited friends")}
        </Text>
        {user.invitedFriends.length ? (
          user.invitedFriends.map((friend) => (
            <View key={friend} style={styles.friendRow}>
              <Text style={styles.friendName}>{friend}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyFriends}>
            {t(
              "아직 초대한 친구가 없습니다. 친구를 초대하고 채굴 속도를 높여보세요.",
              "You have not invited any friends yet. Invite friends to increase your mining speed.",
            )}
          </Text>
        )}
        <Button
          title={t("친구 초대하기", "Invite a friend")}
          onPress={inviteFriend}
        />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>
          {t("Pi 지갑 소유권 인증", "Verify Pi wallet ownership")}
        </Text>
        {user.piVerified ? (
          <>
            <Text style={styles.verifiedBadge}>
              {t(
                "인증 완료 · 채굴한 PSL 출금 가능",
                "Verified · Mined PSL withdrawals enabled",
              )}
            </Text>
            <Text selectable style={styles.addressText}>
              {user.walletAddress}
            </Text>
            <Text style={styles.helper}>
              {t(
                "인증된 Pi 지갑 주소는 이 계정에 고유하게 연결되어 있습니다.",
                "This verified Pi wallet is uniquely linked to your account.",
              )}
            </Text>
          </>
        ) : challenge ? (
          <>
            <Text style={styles.helper}>
              {t(
                `Pi Wallet에서 아래 Muxed 주소로 정확한 수량을 보내세요. 인증을 요청한 ${abbreviatedChallengeWallet} 지갑으로 돌아오므로 송금액은 상쇄되고 네트워크 수수료만 사용됩니다.`,
                `From Pi Wallet, send the exact amount to the Muxed address below. Because it returns to the requesting ${abbreviatedChallengeWallet} wallet, only the network fee is spent.`,
              )}
            </Text>
            <Text style={styles.challengeLabel}>
              {challenge.network === "mainnet"
                ? t("주의! Pi MAINNET에서 송금", "CAUTION! SEND ON PI MAINNET")
                : t("주의! Pi TESTNET에서 송금", "CAUTION! SEND ON PI TESTNET")}
            </Text>
            <Text style={styles.amountText}>
              {Number(challenge.amount).toFixed(2)} Pi
            </Text>
            <View style={styles.muxedAddressRow}>
            <Text selectable style={styles.muxedAddress}>
              {challenge.muxedAddress}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Muxed 주소 복사", "Copy Muxed address")}
              onPress={() => {
                void Clipboard.setStringAsync(challenge.muxedAddress).then(() =>
                  showDialog({
                    title: t("복사 완료", "Copied"),
                    message: t(
                      "Muxed 주소를 클립보드에 복사했습니다.",
                      "The Muxed address was copied to the clipboard.",
                    ),
                  }),
                ).catch((error) => showDialog({
                  title: t("복사 실패", "Copy failed"),
                  message: error instanceof Error ? error.message : String(error),
                }));
              }}
              style={({ pressed }) => [
                styles.copyButton,
                pressed && styles.modeButtonPressed,
              ]}
            >
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={palette.goldDark} strokeWidth={1.8}>
                <Rect x={4} y={3} width={12} height={14} rx={2} />
                <Rect x={8} y={7} width={12} height={14} rx={2} fill={palette.surface2} />
              </Svg>
            </Pressable>
            </View>
            <Text style={styles.expiryText}>
              {t("남은 유효시간", "Time remaining")}: {remainingTime}
            </Text>
            <Button
              title={
                walletBusy
                  ? t("확인 중...", "Checking...")
                  : t("입금 확인", "Check transaction")
              }
              disabled={walletBusy || remainingSeconds <= 0}
              onPress={() => {
                void checkWalletVerification();
              }}
            />
            <Button
              title={t("지갑 주소 변경 / 재요청", "Change wallet / Request again")}
              secondary
              disabled={walletBusy}
              onPress={() => setChallenge(null)}
            />
          </>
        ) : (
          <>
            <Text style={styles.helper}>
              {t(
                "출금에 사용할 G로 시작하는 Pi 지갑 주소를 입력하세요. 서버가 이 지갑을 기반으로 일회성 Muxed 주소를 생성합니다.",
                "Enter the G-address of the Pi wallet used for withdrawals. The server will generate a one-time Muxed address from it.",
              )}
            </Text>
            <TextInput
              value={wallet}
              onChangeText={setWalletInput}
              placeholder="G..."
              placeholderTextColor={palette.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.input}
            />
            <Button
              title={
                walletBusy
                  ? t("요청 생성 중...", "Creating...")
                  : t("지갑 인증 시작", "Start wallet verification")
              }
              disabled={walletBusy || !wallet.trim()}
              onPress={() => {
                void beginWalletVerification(false);
              }}
            />
          </>
        )}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>
          {t("PSL 토큰 지갑 연결", "Connect PSL token wallet")}
        </Text>
        <View style={styles.walletLinkRow}>
          <Pressable
            accessibilityRole="link"
            onPress={() => {
              // Keep the canonical URL inside the installed PWA's scope. On
              // Android, its WebAPK can capture this HTTPS intent; otherwise
              // the same URL safely falls back to the browser.
              Linking.openURL("https://gaebal2.github.io/PSL_Wallet/").catch(
                (error) =>
                  showDialog({
                    title: t("지갑을 열 수 없습니다", "Unable to open wallet"),
                    message: String(error),
                  }),
              );
            }}
            style={({ pressed }) => [
              styles.walletOpenButton,
              pressed && styles.modeButtonPressed,
            ]}
          >
            <Text style={styles.walletOpenText}>
              {t("PSL 지갑 열기", "Open PSL wallet")}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={() => {
              Linking.openURL("https://saseulscan.xyz/#/tokens").catch(
                (error) =>
                  showDialog({
                    title: t(
                      "익스플로러를 열 수 없습니다",
                      "Unable to open explorer",
                    ),
                    message: String(error),
                  }),
              );
            }}
            style={({ pressed }) => [
              styles.walletOpenButton,
              pressed && styles.modeButtonPressed,
            ]}
          >
            <Text style={styles.walletOpenText}>
              {t("익스플로러 연결", "Open explorer")}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.helper}>
          {t(
            "PSL 출금에 사용할 SASEUL 지갑 주소를 입력하고 저장하세요.",
            "Enter and save the SASEUL wallet address used for PSL withdrawals.",
          )}
        </Text>
        <TextInput
          value={pslWallet}
          onChangeText={setPslWalletInput}
          placeholder={t("44자리 SASEUL 주소", "44-character SASEUL address")}
          placeholderTextColor={palette.muted}
          autoCapitalize="none"
          autoCorrect={false}
          editable={isPslWalletEditing}
          selectTextOnFocus={isPslWalletEditing}
          style={[styles.input, !isPslWalletEditing && styles.inputLocked]}
        />
        <Button
          title={
            pslWalletBusy
              ? t("저장 중...", "Saving...")
              : isPslWalletEditing
                ? t("지갑주소 저장", "Save wallet address")
                : t("지갑주소 변경", "Change wallet address")
          }
          secondary
          disabled={pslWalletBusy}
          onPress={() => {
            if (isPslWalletEditing) void savePslWallet();
            else setIsPslWalletEditing(true);
          }}
        />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>
          {t("채굴이력", "Mining history")}
        </Text>
        <Text style={styles.historyTestBadge}>
          {t("테스트 이력", "TEST HISTORY")}
        </Text>
        {miningHistory.length ? (
          miningHistory.map((mine) => {
            const reward =
              mine.reward === "kingWhale"
                ? t("대왕고래 막장", "King whale mine")
                : mine.reward === "whale"
                  ? t("고래 막장", "Whale mine")
                  : t("새우 막장", "Shrimp mine");
            const amount =
              mine.reward === "kingWhale"
                ? 800_000_000
                : mine.reward === "whale"
                  ? 100_000_000
                  : 8;
            return (
              <View key={mine.id} style={styles.historyRow}>
                <View style={styles.historyCopy}>
                  <Text style={styles.historyReward}>{reward}</Text>
                  <Text numberOfLines={1} style={styles.historyGrid}>
                    {mine.id}
                  </Text>
                </View>
                <Text style={styles.historyAmount}>
                  +{amount.toLocaleString()} PSL
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyFriends}>
            {t(
              "아직 대왕고래, 고래 또는 새우 막장 채굴 이력이 없습니다.",
              "No king whale, whale, or shrimp mining history yet.",
            )}
          </Text>
        )}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>
          {t("계정 및 인증", "Account & verification")}
        </Text>
        <View style={styles.identityRow}>
          <Text style={styles.identityLabel}>{t("로그인", "Sign-in")}</Text>
          <Text style={styles.identityValue}>
            {user.provider.toUpperCase()}
          </Text>
        </View>
        <View style={styles.identityRow}>
          <Text style={styles.identityLabel}>
            {t("Pi 지갑 소유권", "Pi wallet ownership")}
          </Text>
          <Text
            style={[
              styles.identityValue,
              user.piVerified && styles.identityVerifiedValue,
            ]}
          >
            {user.piVerified
              ? t(
                  "인증 완료 · 채굴한 PSL 출금 가능",
                  "Verified · Mined PSL withdrawals enabled",
                )
              : t("미인증 · 출금 불가", "Not verified · Withdrawals disabled")}
          </Text>
        </View>
        <Button
          title={t("로그아웃", "Sign out")}
          secondary
          onPress={confirmLogout}
        />
      </Card>
    </Screen>
  );
}

function InfoButton({
  accessibilityLabel,
  onPress,
}: {
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.infoButton,
        pressed && styles.modeButtonPressed,
      ]}
    >
      <Text style={styles.infoButtonText}>?</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topHeader: { marginTop: -6 },
  languageToggle: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface2,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  languageOption: { color: palette.muted, fontSize: 9, fontWeight: "800", paddingHorizontal: 7, paddingVertical: 5, borderRadius: 8 },
  languageOptionActive: { color: palette.onHero, backgroundColor: palette.gold, fontWeight: "900" },
  languageDivider: {
    width: 1,
    height: 12,
    backgroundColor: palette.border,
    marginHorizontal: 6,
  },
  balanceCard: {
    alignItems: "center",
    backgroundColor: palette.hero,
    borderColor: palette.hero,
  },
  balanceLabel: { color: palette.mint, fontSize: 12, fontWeight: "800" },
  balance: { color: palette.onHero, fontSize: 38, fontWeight: "900" },
  balanceSymbol: {
    color: "#AFA0FF",
    fontWeight: "900",
    marginTop: -8,
    marginBottom: 6,
  },
  testModeCard: { borderColor: "#D9D1FF", backgroundColor: "#FBFAFF" },
  modeRow: { flexDirection: "row", gap: 8 },
  modeButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  modeButtonActive: {
    borderColor: palette.gold,
    backgroundColor: palette.gold,
  },
  modeButtonPressed: { opacity: 0.78 },
  modeButtonText: { color: palette.text, fontSize: 13, fontWeight: "900" },
  modeButtonTextActive: { color: "#FFFFFF" },
  modeSpeed: {
    color: palette.goldDark,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  metrics: { flexDirection: "row", gap: 10, paddingVertical: 3 },
  levelCard: { backgroundColor: palette.surface2, borderColor: "#D9D1FF" },
  levelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  levelEyebrow: { color: palette.goldDark, fontSize: 11, fontWeight: "900" },
  levelTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 3,
  },
  levelReferral: {
    color: palette.goldDark,
    fontSize: 11,
    fontWeight: "800",
    backgroundColor: "#FFF",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
  },
  infoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.gold,
  },
  infoButtonText: { color: palette.goldDark, fontSize: 17, fontWeight: "900" },
  levelGauge: { flexDirection: "row", marginTop: 15, marginBottom: 17, gap: 3 },
  levelStepWrap: { flex: 1, position: "relative" },
  levelStep: { height: 10, borderRadius: 5, backgroundColor: "#DCD8EE" },
  levelStepActive: { backgroundColor: palette.gold },
  levelStepCurrent: {
    backgroundColor: palette.goldDark,
    transform: [{ scaleY: 1.5 }],
  },
  levelStepLabel: {
    position: "absolute",
    top: 13,
    alignSelf: "center",
    color: palette.muted,
    fontSize: 8,
    fontWeight: "700",
  },
  gaugeDivider: { height: 1, backgroundColor: "#D5CEF5", marginVertical: 16 },
  referralTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3,
  },
  referralStepActive: { backgroundColor: palette.green },
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: "900" },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  cardHeaderTitle: { flex: 1, minWidth: 0 },
  walletOpenButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: palette.gold,
    backgroundColor: palette.surface2,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  walletLinkRow: { flexDirection: "row", gap: 8 },
  copyButton: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
    minHeight: 44,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: palette.gold,
    backgroundColor: palette.surface2,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  walletOpenText: { color: palette.goldDark, fontSize: 11, fontWeight: "900", textAlign: "center" },
  friendRow: {
    minHeight: 42,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  friendName: { color: palette.text, fontSize: 14, fontWeight: "800" },
  emptyFriends: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    paddingVertical: 10,
  },
  historyRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  historyCopy: { flex: 1, minWidth: 0 },
  historyReward: { color: palette.text, fontSize: 14, fontWeight: "900" },
  historyGrid: { color: palette.muted, fontSize: 10, marginTop: 3 },
  historyAmount: { color: palette.goldDark, fontSize: 12, fontWeight: "900" },
  historyTestBadge: {
    alignSelf: "flex-start",
    color: palette.goldDark,
    backgroundColor: palette.surface2,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 10,
    fontWeight: "900",
  },
  helper: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  input: {
    minHeight: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.background,
    color: palette.text,
    paddingHorizontal: 15,
    fontSize: 13,
  },
  inputLocked: {
    backgroundColor: palette.surface2,
    color: palette.muted,
    opacity: 0.78,
  },
  verifiedBadge: { color: palette.green, fontSize: 15, fontWeight: "900" },
  identityVerifiedValue: { color: palette.green },
  addressText: {
    color: palette.text,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  challengeLabel: {
    color: "#C43145",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 1.5,
    textAlign: "center",
    backgroundColor: "#FFF0F2",
    borderColor: "#F2A9B3",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  amountText: {
    color: palette.text,
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
  },
  muxedAddress: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    fontSize: 12,
    lineHeight: 19,
    fontWeight: "700",
    backgroundColor: palette.surface2,
    borderRadius: 14,
    padding: 12,
  },
  muxedAddressRow: { flexDirection: "row", alignItems: "center", backgroundColor: palette.surface2, borderRadius: 14, paddingRight: 6 },
  expiryText: {
    color: palette.danger,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  identityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 6,
  },
  identityLabel: { flexShrink: 1, color: palette.muted, fontSize: 13 },
  identityValue: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    textAlign: "right",
  },
});
