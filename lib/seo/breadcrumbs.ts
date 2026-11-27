import type { Locale } from '../i18n/config.ts';

export type BreadcrumbEntry = { name: string; path: string };
export type DiscoveryDirectoryPath = '/toplijsten' | '/categories' | '/collections';

export function directoryBreadcrumbs(path: DiscoveryDirectoryPath, locale: Locale): BreadcrumbEntry[] {
  const labels = {
    '/toplijsten': { nl: 'Toplijsten', en: 'Reading lists' },
    '/categories': { nl: 'Categorieën', en: 'Categories' },
    '/collections': { nl: 'Collecties', en: 'Collections' },
  };
  return [{ name: 'LumiScore', path: '/' }, { name: labels[path][locale], path }];
}

export function catalogBreadcrumbs(kind: 'book' | 'collection', name: string, path: string, locale: Locale): BreadcrumbEntry[] {
  return [
    { name: 'LumiScore', path: '/' },
    { name: kind === 'book' ? (locale === 'nl' ? 'Boeken ontdekken' : 'Discover books') : (locale === 'nl' ? 'Collecties' : 'Collections'), path: kind === 'book' ? '/browse' : '/collections' },
    { name, path },
  ];
}
