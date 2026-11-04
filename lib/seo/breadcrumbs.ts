import type { Locale } from '../i18n/config.ts';

export type BreadcrumbEntry = { name: string; path: string };
export function catalogBreadcrumbs(kind: 'book' | 'collection', name: string, path: string, locale: Locale): BreadcrumbEntry[] {
  return [
    { name: 'LumiScore', path: '/' },
    { name: kind === 'book' ? (locale === 'nl' ? 'Boeken ontdekken' : 'Discover books') : (locale === 'nl' ? 'Collecties' : 'Collections'), path: kind === 'book' ? '/browse' : '/collections' },
    { name, path },
  ];
}
