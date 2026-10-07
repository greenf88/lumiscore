import 'server-only';

import { headers } from 'next/headers';
import {
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
} from './config.ts';
import { LOCALE_REQUEST_HEADER, PATH_REQUEST_HEADER, splitLocalePath } from './paths.ts';

export type RequestLocale = {
  locale: Locale;
  hasPersistedChoice: boolean;
};

export async function resolveRequestLocale(request?: Request): Promise<RequestLocale> {
  // Private API representations receive the page locale explicitly; cookies
  // cannot race hydration or change an existing round's stored language.
  if (request) {
    const locale = new URL(request.url).searchParams.get('locale');
    return { locale: isLocale(locale) ? locale : DEFAULT_LOCALE, hasPersistedChoice: true };
  }
  const headerStore = await headers();
  const routeLocale = headerStore.get(LOCALE_REQUEST_HEADER);
  return { locale: isLocale(routeLocale) ? routeLocale : DEFAULT_LOCALE, hasPersistedChoice: true };
}

export async function requestPagePath(): Promise<string> {
  return splitLocalePath((await headers()).get(PATH_REQUEST_HEADER) ?? '/').path;
}
