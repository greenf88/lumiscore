'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode, type AnchorHTMLAttributes } from 'react';
import { LOCALE_STORAGE_KEY, serializeLocaleCookie, type Locale } from '@/lib/i18n/config';
import { localizedHref } from '@/lib/i18n/paths';
import { translate, type TranslationKey } from '@/lib/i18n/translations';
import { bookReturnMemoryKey, cleanBookLink, resolveLocalBookReturn, serializeBookReturnMemory } from '@/lib/navigation/book-return-memory';

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

/** Ordinary anchors expose the canonical book URL; optional context stays in this tab. */
export function LocaleLink({ href, onClick, onAuxClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { locale } = useLumiScoreLocale();
  const target = href ? cleanBookLink(localizedHref(href, locale)) : null;
  const rememberReturn = () => {
    if (!target?.returnPath) return;
    try {
      const memory = serializeBookReturnMemory(target.href, target.returnPath, location.href);
      if (memory) sessionStorage.setItem(bookReturnMemoryKey(new URL(target.href, location.href).pathname), memory);
    } catch { /* Links remain functional if browser storage is disabled. */ }
  };
  return <a {...props} href={target?.href ?? href} onClick={event => {
    onClick?.(event);
    if (!event.defaultPrevented) rememberReturn();
  }} onAuxClick={event => {
    onAuxClick?.(event);
    if (!event.defaultPrevented && event.button === 1) rememberReturn();
  }} />;
}

export function LanguageSwitcher({ hrefForLocale }: { hrefForLocale?: (locale: Locale) => string } = {}) {
  const { locale, pagePath, t } = useLumiScoreLocale();
  const isDutchNews = /^\/nieuws(?:[/?#]|$)/.test(pagePath);
  const rememberBookLocale = (option: Locale, target: ReturnType<typeof cleanBookLink>) => {
    rememberLocale(option);
    try {
      const stored = sessionStorage.getItem(bookReturnMemoryKey(location.pathname));
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const returnPath = target.returnPath ?? resolveLocalBookReturn({ currentUrl: location.href, referrer: document.referrer, stored, navigationType: navigation?.type })?.href ?? null;
      const memory = serializeBookReturnMemory(target.href, returnPath, location.href);
      if (memory) sessionStorage.setItem(bookReturnMemoryKey(new URL(target.href, location.href).pathname), memory);
    } catch { /* The localized URL remains usable without optional storage. */ }
  };
  return <div className="language-switcher" role="group" aria-label={t('language.label')}>
    {(['nl', 'en'] as const).map(option => {
      const target = cleanBookLink(hrefForLocale ? hrefForLocale(option) : localizedHref(isDutchNews && option === 'en' ? '/' : pagePath, option));
      return <a key={option}
        href={target.href}
        aria-label={option === 'nl' ? t('language.dutch') : t('language.english')}
        aria-current={locale === option ? 'page' : undefined}
        onClick={() => rememberBookLocale(option, target)}
        onAuxClick={event => { if (event.button === 1) rememberBookLocale(option, target); }}
      >{option.toUpperCase()}</a>;
    })}
  </div>;
}
