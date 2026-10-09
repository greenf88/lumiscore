'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode, type AnchorHTMLAttributes } from 'react';
import { LOCALE_STORAGE_KEY, serializeLocaleCookie, type Locale } from '@/lib/i18n/config';
import { localizedHref } from '@/lib/i18n/paths';
import { translate, type TranslationKey } from '@/lib/i18n/translations';

type LocaleContextValue = {
  locale: Locale;
  pagePath: string;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
};
const LocaleContext = createContext<LocaleContextValue | null>(null);

function rememberLocale(locale: Locale) {
  try { localStorage.setItem(LOCALE_STORAGE_KEY, locale); } catch { /* Optional storage. */ }
  document.cookie = serializeLocaleCookie(locale);
}

export function LumiScoreLocaleProvider({ children, initialLocale, initialPath = '/' }: {
  children: ReactNode; initialLocale: Locale; hasPersistedChoice: boolean; initialPath?: string;
}) {
  // The URL/server locale is authoritative, even with conflicting browser preferences.
  useEffect(() => { document.documentElement.lang = initialLocale; }, [initialLocale]);
  const setLocale = useCallback((locale: Locale) => {
    rememberLocale(locale);
    if (locale !== initialLocale) window.location.assign(localizedHref(window.location.pathname + window.location.search + window.location.hash, locale));
  }, [initialLocale]);
  const value = useMemo<LocaleContextValue>(() => ({
    locale: initialLocale, pagePath: initialPath, setLocale,
    t: (key, variables) => translate(initialLocale, key, variables),
  }), [initialLocale, initialPath, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLumiScoreLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLumiScoreLocale must be used within LumiScoreLocaleProvider.');
  return context;
}

/** Ordinary anchors keep routing, query context and crawlability without JS. */
export function LocaleLink({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { locale } = useLumiScoreLocale();
  return <a {...props} href={href ? localizedHref(href, locale) : href} />;
}

export function LanguageSwitcher() {
  const { locale, pagePath, t } = useLumiScoreLocale();
  return <div className="language-switcher" role="group" aria-label={t('language.label')}>
    {(['nl', 'en'] as const).map(option => <a key={option}
      href={localizedHref(pagePath, option)}
      aria-label={option === 'nl' ? t('language.dutch') : t('language.english')}
      aria-current={locale === option ? 'page' : undefined}
      onClick={() => rememberLocale(option)}>{option.toUpperCase()}</a>)}
  </div>;
}
