import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Locale = 'ko' | 'en';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (ko: string, en: string) => string;
};

const STORAGE_KEY = 'psl-mining-locale-v1';
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<Locale>('ko');

  useEffect(() => { AsyncStorage.getItem(STORAGE_KEY).then((value) => { if (value === 'ko' || value === 'en') setLocaleState(value); }); }, []);

  function setLocale(next: Locale) {
    setLocaleState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }

  const toggleLocale = useCallback(() => setLocale(locale === 'ko' ? 'en' : 'ko'), [locale]);
  const t = useCallback((ko: string, en: string) => locale === 'ko' ? ko : en, [locale]);
  const value = useMemo(() => ({ locale, setLocale, toggleLocale, t }), [locale, t, toggleLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used inside LocaleProvider');
  return value;
}
