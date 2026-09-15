'use client';

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  LOCALE_STORAGE_KEY,
  isLocale,
  localeFromLanguage,
  serializeLocaleCookie,
  type Locale,
} from '@/lib/i18n/config';
import { translate, type TranslationKey } from '@/lib/i18n/translations';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LumiScoreLocaleProvider({
  children,
  initialLocale,
  hasPersistedChoice,
}: {
  children: ReactNode;
  initialLocale: Locale;
  hasPersistedChoice: boolean;
}) {
  const [locale, updateLocale] = useState(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    let storedLocale: string | null = null;
    try {
      storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
    } catch {
      // Storage is optional; the server-rendered locale remains usable.
    }

    if (hasPersistedChoice) {
      if (storedLocale !== initialLocale) {
        try {
          localStorage.setItem(LOCALE_STORAGE_KEY, initialLocale);
        } catch {
          // The cookie remains the authoritative explicit choice.
        }
      }
      return;
    }

    if (isLocale(storedLocale) && storedLocale !== initialLocale) {
      document.cookie = serializeLocaleCookie(storedLocale);
      window.location.reload();
      return;
    }

    if (!hasPersistedChoice && !storedLocale) {
      const browserLocale = localeFromLanguage(navigator.language);
      if (browserLocale !== initialLocale) {
        startTransition(() => updateLocale(browserLocale));
      }
    }
  }, [hasPersistedChoice, initialLocale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    if (nextLocale === locale) return;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // The cookie still persists the explicit choice when storage is blocked.
    }
    document.cookie = serializeLocaleCookie(nextLocale);
    document.documentElement.lang = nextLocale;
    updateLocale(nextLocale);
    window.location.reload();
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    setLocale,
    t: (key, variables) => translate(locale, key, variables),
  }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLumiScoreLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLumiScoreLocale must be used within LumiScoreLocaleProvider.');
  return context;
}

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLumiScoreLocale();

  return (
    <div className="language-switcher" role="group" aria-label={t('language.label')}>
      {(['nl', 'en'] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-label={option === 'nl' ? t('language.dutch') : t('language.english')}
          aria-pressed={locale === option}
          onClick={() => setLocale(option)}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
