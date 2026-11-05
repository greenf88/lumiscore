import { DEFAULT_LOCALE, isLocale, type Locale } from './config.ts';

export const LOCALE_REQUEST_HEADER = 'x-lumiscore-route-locale';
export const PATH_REQUEST_HEADER = 'x-lumiscore-route-path';

// Shared content routes keep a canonical public path per language.
export const IMDB_COMPARISON_PATHS = { en: '/imdb-for-books', nl: '/imdb-voor-boeken' } as const;
export const EDITORIAL_LIST_PATHS = { en: '/toplists', nl: '/toplijsten' } as const;

function localizedContentPath(path: string, locale: Locale): string {
  const suffixAt = path.search(/[?#]/);
  const pathname = suffixAt < 0 ? path : path.slice(0, suffixAt);
  const suffix = suffixAt < 0 ? '' : path.slice(suffixAt);
  if ((Object.values(IMDB_COMPARISON_PATHS) as readonly string[]).includes(pathname)) {
    return IMDB_COMPARISON_PATHS[locale] + suffix;
  }
  // Match a whole leading segment only; preserve list identities, query and hash.
  const editorial = /^\/(?:toplijsten|toplists)(?=\/|$)/.exec(pathname);
  return editorial ? EDITORIAL_LIST_PATHS[locale] + pathname.slice(editorial[0].length) + suffix : path;
}

function contentRoutePath(path: string): string {
  // IMDb's physical route is English; existing editorial pages stay under app/toplijsten.
  return localizedContentPath(path, 'en').replace(/^\/toplists(?=\/|$)/, '/toplijsten');
}

export function splitLocalePath(path: string): { locale: Locale | null; path: string } {
  const match = /^\/(en|nl)(?=\/|\?|#|$)/.exec(path);
  return match && isLocale(match[1])
    ? { locale: match[1], path: path.slice(match[0].length) || '/' }
    : { locale: null, path };
}

/** Assets and action/API endpoints retain their original identity and protections. */
export function isLanguageNeutralPath(path: string): boolean {
  const pathname = path.split(/[?#]/)[0];
  return /^\/(?:api|auth|_next|_vinext|_vercel|__vite|@vite|@id|@fs|assets|fonts)(?:\/|$)/.test(pathname)
    || /\.[a-z0-9]+$/i.test(pathname);
}

export function localizedHref(href: string, locale: Locale = DEFAULT_LOCALE): string {
  if (!href.startsWith('/') || href.startsWith('//') || /[\\\u0000-\u0020\u007f]/u.test(href)) return href;
  const { path } = splitLocalePath(href);
  if (isLanguageNeutralPath(path)) return path;
  return `/${locale}${localizedContentPath(path, locale).replace(/^\/(?=[?#]|$)/, '')}`;
}

export function languageAlternates(path: string) {
  return { en: localizedHref(path, 'en'), 'nl-NL': localizedHref(path, 'nl'), 'x-default': localizedHref(path, 'en') };
}

/** Deliberately independent of cookies, Accept-Language and user-agent. */
export function languageRoute(pathname: string):
  | { kind: 'pass' }
  | { kind: 'redirect'; path: string }
  | { kind: 'rewrite'; path: string; locale: Locale } {
  const parsed = splitLocalePath(pathname);
  if (isLanguageNeutralPath(parsed.path)) return parsed.locale
    ? { kind: 'redirect', path: parsed.path }
    : { kind: 'pass' };
  // Legacy /books/:id links point directly at the canonical Work route.
  const path = parsed.path.replace(/^\/books\//, '/book/');
  if (!parsed.locale || path !== parsed.path || (pathname.length > 1 && pathname.endsWith('/'))) {
    return { kind: 'redirect', path: localizedHref(path.replace(/\/$/, '') || '/', parsed.locale ?? DEFAULT_LOCALE) };
  }
  const translated = localizedContentPath(path, parsed.locale);
  if (translated !== path) return { kind: 'redirect', path: localizedHref(translated, parsed.locale) };
  return { kind: 'rewrite', path: contentRoutePath(parsed.path), locale: parsed.locale };
}
