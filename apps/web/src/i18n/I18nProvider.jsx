import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DEFAULT_LOCALE, messages, SUPPORTED_LOCALES } from './messages.js';

const STORAGE_KEY = 'ai3d.locale';
const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(getInitialLocale);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Ignore persistence failures.
    }

    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale) => {
    setLocaleState(normalizeLocale(nextLocale));
  }, []);

  const t = useCallback(
    (key, values = {}) => {
      const template = getMessage(locale, key) ?? getMessage(DEFAULT_LOCALE, key) ?? key;
      return interpolate(template, values);
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      languages: SUPPORTED_LOCALES,
      t
    }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }

  return context;
}

function getInitialLocale() {
  try {
    const savedLocale = window.localStorage.getItem(STORAGE_KEY);
    if (savedLocale) {
      return normalizeLocale(savedLocale);
    }
  } catch {
    // Ignore storage failures.
  }

  return normalizeLocale(window.navigator.language);
}

function normalizeLocale(locale = DEFAULT_LOCALE) {
  if (!locale) {
    return DEFAULT_LOCALE;
  }

  const normalized = locale.toLowerCase();
  if (normalized.startsWith('zh')) {
    return 'zh-CN';
  }

  return SUPPORTED_LOCALES.some((item) => item.code === locale) ? locale : DEFAULT_LOCALE;
}

function getMessage(locale, key) {
  return key.split('.').reduce((current, part) => current?.[part], messages[locale]);
}

function interpolate(template, values) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)),
    template
  );
}
