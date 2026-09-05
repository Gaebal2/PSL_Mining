import { StatusBar } from "expo-status-bar";
import { Image, StyleSheet, Text, View } from "react-native";

import { useAppState } from "@/state/app-state";
import { useLocale } from "@/state/locale";
import { useAppDialog } from "@/ui/app-dialog";
import { Button, Card, Screen } from "@/ui/components";
import { palette } from "@/ui/theme";

export function LoginScreen() {
  const { login } = useAppState();
  const { t } = useLocale();
  const showDialog = useAppDialog();
  const handleLogin = (provider: "google" | "apple") =>
    login(provider).catch((error) =>
      showDialog({
        title: t("로그인 실패", "Login failed"),
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  return (
    <Screen>
      <StatusBar style="dark" />
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Image
            source={require("../../../assets/images/icon-512.png")}
            style={styles.logoImage}
            accessibilityLabel="PSL Mining"
          />
        </View>
        <Text style={styles.kicker}>Pi on SaseuL</Text>
        <Text style={styles.title}>PSL Mining</Text>
        <Text style={styles.copy}>
          {t(
            "지구 어딘가에 숨겨진 PSL 광맥을 찾아보세요.",
            "Find hidden PSL veins somewhere on Earth.",
          )}
        </Text>
      </View>
      <Card>
        <Text style={styles.cardTitle}>
          {t("채굴자 계정 만들기", "Create a miner account")}
        </Text>
        <Text style={styles.helper}>
          {t(
            "Google 또는 Apple 계정으로 로그인하세요. Pi 지갑은 MY 화면에서 출금용으로 인증할 수 있습니다.",
            "Sign in with Google or Apple. You can verify your Pi wallet for PSL withdrawals from MY screen.",
          )}
        </Text>
        <Button
          title={t("Google로 계속하기", "Continue with Google")}
          onPress={() => {
            void handleLogin("google");
          }}
        />
        <Button
          title={t("Apple로 계속하기", "Continue with Apple")}
          secondary
          onPress={() => {
            void handleLogin("apple");
          }}
        />
      </Card>
      <Text style={styles.terms}>
        {t(
          "계속하면 서비스 이용약관과 개인정보 처리방침에 동의하게 됩니다.",
          "By continuing, you agree to the Terms of Service and Privacy Policy.",
        )}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingTop: 44, paddingBottom: 20 },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: palette.gold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
    shadowColor: palette.goldDark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.26,
    shadowRadius: 24,
    elevation: 4,
  },
  logoImage: { width: 88, height: 88, borderRadius: 24 },
  kicker: {
    color: palette.green,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 2.5,
  },
  title: { color: palette.text, fontSize: 42, fontWeight: "900", marginTop: 8 },
  copy: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 300,
    marginTop: 12,
  },
  cardTitle: { color: palette.text, fontSize: 20, fontWeight: "900" },
  helper: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  terms: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    paddingHorizontal: 28,
  },
});
