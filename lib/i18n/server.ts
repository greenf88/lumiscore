import 'server-only';

import { cookies, headers } from 'next/headers';
import {
  LOCALE_COOKIE_NAME,
  isLocale,
  localeFromLanguage,
  type Locale,
} from './config.ts';

export type RequestLocale = {
  locale: Locale;
  hasPersistedChoice: boolean;
};

export async function resolveRequestLocale(): Promise<RequestLocale> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const persistedLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (isLocale(persistedLocale)) {
    return { locale: persistedLocale, hasPersistedChoice: true };
  }

  return {
    locale: localeFromLanguage(headerStore.get('accept-language')),
    hasPersistedChoice: false,
  };
}
