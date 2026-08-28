import { createContext, PropsWithChildren, useContext, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/ui/theme';

type DialogAction = {
  text: string;
  style?: 'cancel' | 'destructive' | 'default';
  onPress?: () => void;
};

type DialogOptions = {
  title: string;
  message?: string;
  actions?: DialogAction[];
};

const DialogContext = createContext<((options: DialogOptions) => void) | null>(null);

export function AppDialogProvider({ children }: PropsWithChildren) {
  const [dialog, setDialog] = useState<DialogOptions | null>(null);
  const actions = dialog?.actions?.length ? dialog.actions : [{ text: '확인' }];

  return (
    <DialogContext.Provider value={setDialog}>
      {children}
      <Modal visible={Boolean(dialog)} transparent animationType="fade" onRequestClose={() => setDialog(null)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog} accessibilityRole="alert">
            <View style={styles.icon}><Text style={styles.iconText}>PSL</Text></View>
            <Text style={styles.title}>{dialog?.title}</Text>
            {dialog?.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
            <View style={styles.actions}>
              {actions.map((action, index) => (
                <Pressable
                  key={`${action.text}-${index}`}
                  onPress={() => {
                    setDialog(null);
                    action.onPress?.();
                  }}
                  style={({ pressed }) => [
                    styles.button,
                    action.style === 'cancel' && styles.cancelButton,
                    action.style === 'destructive' && styles.destructiveButton,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.buttonText, action.style === 'cancel' && styles.cancelText]}>{action.text}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useAppDialog() {
  const showDialog = useContext(DialogContext);
  if (!showDialog) throw new Error('useAppDialog must be used inside AppDialogProvider');
  return showDialog;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(22,18,48,0.55)' },
  dialog: { backgroundColor: palette.surface, borderRadius: 26, borderWidth: 1, borderColor: palette.border, padding: 22, alignItems: 'center', gap: 12, shadowColor: '#17112F', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.25, shadowRadius: 28, elevation: 12 },
  icon: { minWidth: 52, height: 34, borderRadius: 12, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.hero },
  iconText: { color: palette.onHero, fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  title: { color: palette.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  message: { color: palette.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  actions: { width: '100%', flexDirection: 'row', gap: 9, marginTop: 6 },
  button: { flex: 1, minHeight: 50, borderRadius: 15, backgroundColor: palette.gold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  cancelButton: { backgroundColor: palette.surface2, borderWidth: 1, borderColor: palette.border },
  destructiveButton: { backgroundColor: palette.danger },
  pressed: { opacity: 0.78 },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  cancelText: { color: palette.text },
});
