import { PropsWithChildren, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette } from '@/ui/theme';

export function Screen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const content = <View style={styles.content}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

export function Header({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({ title, onPress, secondary = false, danger = false, disabled = false }: {
  title: string; onPress: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, secondary && styles.secondary, danger && styles.danger, disabled && styles.disabled, pressed && { opacity: 0.8 }]}>
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>
    </Pressable>
  );
}

export function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, accent && { color: palette.gold }]}>{value}</Text>
    </View>
  );
}

export const commonStyles = StyleSheet.create({
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '800' },
  body: { color: palette.muted, fontSize: 14, lineHeight: 21 },
  row: { flexDirection: 'row', gap: 10 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  scroll: { paddingBottom: 32 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 18, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 64 },
  eyebrow: { color: palette.gold, fontSize: 11, letterSpacing: 2, fontWeight: '800', marginBottom: 5 },
  title: { color: palette.text, fontSize: 28, lineHeight: 34, fontWeight: '900' },
  card: { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 22, padding: 18, gap: 12 },
  button: { minHeight: 52, borderRadius: 16, backgroundColor: palette.gold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  secondary: { backgroundColor: palette.surface2, borderWidth: 1, borderColor: palette.border },
  danger: { backgroundColor: palette.danger },
  disabled: { opacity: 0.4 },
  buttonText: { color: '#172017', fontSize: 15, fontWeight: '900' },
  secondaryText: { color: palette.text },
  metric: { flex: 1, minWidth: 95, gap: 6 },
  metricLabel: { color: palette.muted, fontSize: 12 },
  metricValue: { color: palette.text, fontSize: 20, fontWeight: '900' },
});
