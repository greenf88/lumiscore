export const SUPPORTED_LOCALES = ['en', 'nl'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE_NAME = 'lumiscore-locale';
export const LOCALE_STORAGE_KEY = 'lumiscore-locale';

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'nl';
}

export function localeFromLanguage(language: string | null | undefined): Locale {
  return language?.trim().toLowerCase().startsWith('nl') ? 'nl' : DEFAULT_LOCALE;
}

export function resolveLocale(input: {
  persistedLocale?: unknown;
  browserLanguage?: string | null;
}): Locale {
  return isLocale(input.persistedLocale)
    ? input.persistedLocale
    : localeFromLanguage(input.browserLanguage);
}

export function serializeLocaleCookie(locale: Locale): string {
  return `${LOCALE_COOKIE_NAME}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
