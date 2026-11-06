import { languageAlternates, localizedHref } from '../i18n/paths.ts';
import { absoluteLumiScoreUrl } from './site-origin.ts';
import { editorialTopLists } from '../catalog/top-lists.ts';
import { bookLanguageAlternates, type BookLocales } from './book-locales.ts';
import type { Locale } from '../i18n/config.ts';

export function buildPublicSitemapPaths(
  workIds: readonly string[],
  collectionSlugs: readonly string[],
): string[] {
  return [...new Set([
    '/',
    '/browse',
    '/collections',
    '/categories',
    '/toplijsten',
    ...editorialTopLists.map(list => '/toplijsten/' + list.slug),
    '/taste-test',
    '/over-ons',
    '/zo-werkt-het',
    '/imdb-for-books',
    '/voor-uitgevers',
    '/contact',
    ...collectionSlugs
      .map((slug) => slug.trim())
      .filter(Boolean)
      .map((slug) => `/collection/${encodeURIComponent(slug)}`),
    ...workIds
      .filter((workId) => /^[1-9]\d*$/.test(workId))
      .map((workId) => `/book/${workId}`),
  ])];
}

function escapeXml(value: string): string { return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll("'", '&apos;'); }

export const SITEMAP_SHARDS = {
  pages: '/sitemap-pages.xml',
  en: '/sitemap-books-en.xml',
  nl: '/sitemap-books-nl.xml',
} as const;

export function buildSitemapIndex(): string {
  const entries = Object.values(SITEMAP_SHARDS).map(path =>
    `<sitemap><loc>${escapeXml(absoluteLumiScoreUrl(path))}</loc></sitemap>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`;
}

export function buildLocalizedSitemap(
  books: readonly BookLocales[], collectionSlugs: readonly string[], shard?: keyof typeof SITEMAP_SHARDS,
): string {
  const bookLocales = new Map<string, Set<Locale>>();
  for (const { workId, locales } of books) {
    const path = `/book/${workId}`;
    const known = bookLocales.get(path) ?? new Set<Locale>();
    for (const locale of locales) known.add(locale);
    bookLocales.set(path, known);
  }
  const entries = buildPublicSitemapPaths(books.map(book => book.workId), collectionSlugs).flatMap(path => {
    const locales = bookLocales.get(path);
    if (shard && (shard === 'pages' ? Boolean(locales) : !locales?.has(shard))) return [];
    const links = locales ? bookLanguageAlternates(path, [...locales]) : languageAlternates(path);
    const alternates = Object.entries(links).map(([language, href]) =>
      `<xhtml:link rel="alternate" hreflang="${language}" href="${escapeXml(absoluteLumiScoreUrl(href))}"/>`).join('');
    const priority = path === '/' ? '1.0' : path === '/taste-test' ? '0.8' : path.startsWith('/book/') ? '0.7' : '0.6';
    return (['en', 'nl'] as const).filter(locale => (!locales || locales.has(locale)) && (!shard || shard === 'pages' || shard === locale)).map(locale => `<url><loc>${escapeXml(absoluteLumiScoreUrl(localizedHref(path, locale)))}</loc>${alternates}<priority>${priority}</priority></url>`);
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries}</urlset>`;
}
