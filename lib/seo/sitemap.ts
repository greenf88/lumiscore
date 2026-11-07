import { createHash } from 'node:crypto';
import { getLandingGuide } from '../editorial/landing-guides.ts';
import { getInformationPageContent, type InformationPageKey } from '../information/pages.ts';
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

const verifiedContentDates: Partial<Record<string, { key: InformationPageKey; date: string; hash: string }>> = {
  // Production release 46ae50b, 4 November. Hash the published content so a
  // later editorial edit cannot silently keep advertising the old date.
  '/zo-werkt-het': { key: 'howItWorks', date: '2026-11-04', hash: '14f9627a0662fd296d6ca4f1b9fe8657babfba4c8b474497bee856ca9cfd9752' },
  '/imdb-for-books': { key: 'imdbComparison', date: '2026-11-04', hash: '2d0c45e0255161dc24460ba46d0e168a839b8f730ecbb73f97371f5d6a4f0082' },
};

const verifiedGuideHashes: Readonly<Record<string, string>> = {
  // Production release 1cb54df, 4 November. These are the published Dutch guides.
  '/collection/suzanne-vermeer': '9770063db3cd6ae14cdf33d30c79cba1367ea5414758fbfed6573c2569405c1f',
  '/toplijsten/fantasy-om-mee-te-beginnen': '453c29cf8780afbf371989926b0201e9cd7dd39074768c0e75413010172ecac0',
  '/toplijsten/na-project-hail-mary': '5a1d49c9cd25fbc955117c136313faef41bae99357cc5fdff312bca1a99bfe29',
};

function sitemapLastModified(path: string, locale: Locale): string {
  if (locale !== 'nl') return '';
  const entry = verifiedContentDates[path];
  const guideHash = Object.hasOwn(verifiedGuideHashes, path) ? verifiedGuideHashes[path] : undefined;
  if (!entry && !guideHash) return '';
  const content = entry ? getInformationPageContent(entry.key, locale) : getLandingGuide(path, locale);
  const hash = createHash('sha256').update(JSON.stringify(content)).digest('hex');
  return hash === (entry?.hash ?? guideHash) ? '<lastmod>' + (entry?.date ?? '2026-11-04') + '</lastmod>' : '';
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
    return (['en', 'nl'] as const).filter(locale => (!locales || locales.has(locale)) && (!shard || shard === 'pages' || shard === locale)).map(locale => `<url><loc>${escapeXml(absoluteLumiScoreUrl(localizedHref(path, locale)))}</loc>${sitemapLastModified(path, locale)}${alternates}<priority>${priority}</priority></url>`);
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries}</urlset>`;
}
