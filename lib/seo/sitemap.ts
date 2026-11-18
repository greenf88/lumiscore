import { verifiedPageLastmod, type VerifiedPageRevision } from './verified-lastmod.ts';
import { createHash } from 'node:crypto';
import { getLandingGuide } from '../editorial/landing-guides.ts';
import englishGuideDates from './english-guide-revisions.json' with { type: 'json' };
import { NEWS_PATH, publishedNews } from '../editorial/news.ts';
import { getInformationPageContent, type InformationPageKey } from '../information/pages.ts';
import { languageAlternates, localizedHref } from '../i18n/paths.ts';
import { absoluteLumiScoreUrl } from './site-origin.ts';
import { editorialTopLists } from '../catalog/top-lists.ts';
import { bookLanguageAlternates, bookUrlPolicy, type BookLocales } from './book-locales.ts';
import type { Locale } from '../i18n/config.ts';
import { collectionLanguageAlternates } from './collection-locales.ts';

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
  // Content reviewed for the 13 November recovery release. Exact hashes keep
  // later editorial edits from silently advertising an obsolete change date.
  '/zo-werkt-het': { key: 'howItWorks', date: '2026-11-13', hash: '72cf70b13f193cc607c55495a4f02544ecc64750531405ac21f6bb7f0b2d5cb3' },
  // Unchanged since production release 46ae50b, 4 November.
  '/imdb-for-books': { key: 'imdbComparison', date: '2026-11-04', hash: '2d0c45e0255161dc24460ba46d0e168a839b8f730ecbb73f97371f5d6a4f0082' },
};

const verifiedGuideDates: Readonly<Record<string, { date: string; hash: string }>> = {
  '/toplijsten/feelgood-voor-een-leesavond': { date: '2026-11-16', hash: 'a869f877726b81e12ccfb1c38f4ed825fba471ae1ec9663f1b41bd759d958f8c' },
  '/toplijsten/overleven-in-extreme-omstandigheden': { date: '2026-11-16', hash: '7eed9dbf46e85276eb5e83960bf3e463a921f3da834970bd1bac4f49e08c2c29' },
  '/toplijsten/eerste-delen-fantasyreeksen': { date: '2026-11-16', hash: '96dda723646bacd0a879df49a34aa62ac26a865764dc3ac7fe29349ccc986a05' },
  '/toplijsten/korte-romans-en-novelles': { date: '2026-11-16', hash: '98bbe305fb3c2baf92e9af2998aa61065599219cb1b31104e3f4da599d51fd9f' },
  '/toplijsten/historische-romans': { date: '2026-11-16', hash: '3b4d48921ca6342a9242688ea72e5ea72df18c6e0aec8f72f092a5c397e5663f' },
  '/toplijsten/na-de-rivierkreeften': { date: '2026-11-16', hash: 'a6bcc8380eb629fcb505733e2d0c1a351a2c1c21cc9165da20c97b4e6a83713d' },
  '/toplijsten/thrillers-met-een-twist': { date: '2026-11-16', hash: 'd3e4a525ce820b1ed153b3637267e64502002f9719bed95d2929892e3c36ef59' },
  '/toplijsten/sciencefiction-om-mee-te-beginnen': { date: '2026-11-16', hash: 'e742584730b77bd7f644d1297506ec7568dbf1d7fbaf973ba603e1a0a82a1707' },
  '/toplijsten/fantasy-sciencefiction': { date: '2026-11-16', hash: 'eb52ddeab9aca93817922edd77b4998cc076143a8b73584f59b855ebc3adc32c' },
  // Unchanged published Dutch guides from production release 1cb54df, 4 November.
  '/collection/suzanne-vermeer': { date: '2026-11-04', hash: '9770063db3cd6ae14cdf33d30c79cba1367ea5414758fbfed6573c2569405c1f' },
  '/toplijsten/fantasy-om-mee-te-beginnen': { date: '2026-11-16', hash: '74ab4141155b39eaa8a0a975d49fdef0035ef8fa3a49878221a39ea3612c7d77' },
  '/toplijsten/na-project-hail-mary': { date: '2026-11-16', hash: 'bd4810ea2fd8fa29467bcf43fca40b09e423e05e42a3817876854789876289cc' },
  // Complete Dutch edition selection and reading guide reviewed 16 November.
  '/toplijsten/dystopie-vanaf-1990': { date: '2026-11-16', hash: 'd2425763e3023caeff137b29971036bd82ef5b6eebec2c0021d8e591d2ad0b47' },
};

function sitemapLastModified(path: string, locale: Locale): string {
  const entry = locale === 'nl' ? verifiedContentDates[path] : undefined;
  const dates: Readonly<Record<string, { date: string; hash: string }>> = locale === 'nl' ? verifiedGuideDates : englishGuideDates;
  const guide = Object.hasOwn(dates, path) ? dates[path] : undefined;
  const revision = entry ?? guide;
  if (!revision) return '';
  const content = entry ? getInformationPageContent(entry.key, locale) : getLandingGuide(path, locale);
  const hash = createHash('sha256').update(JSON.stringify(content)).digest('hex');
  return hash === revision.hash ? '<lastmod>' + revision.date + '</lastmod>' : '';
}

export function buildLocalizedSitemap(
  books: readonly BookLocales[], collectionSlugs: readonly string[], shard?: keyof typeof SITEMAP_SHARDS,
  revisions: ReadonlyMap<string, VerifiedPageRevision> = new Map(),
  collectionLocales?: ReadonlyMap<string, readonly Locale[]>,
): string {
  const bookLocales = new Map<string, Set<Locale>>();
  for (const { workId, locales } of books) {
    const path = `/book/${workId}`;
    const known = bookLocales.get(path) ?? new Set<Locale>();
    for (const locale of locales) known.add(locale);
    bookLocales.set(path, known);
  }
  const entries = buildPublicSitemapPaths(books.map(book => book.workId), collectionSlugs).flatMap(path => {
    const isBook = bookLocales.has(path);
    const slug = path.startsWith('/collection/') ? decodeURIComponent(path.slice('/collection/'.length)) : null;
    const locales = bookLocales.get(path) ?? (slug && collectionLocales ? new Set(collectionLocales.get(slug) ?? []) : undefined);
    if (shard && (shard === 'pages' ? isBook : !isBook || !locales?.has(shard))) return [];
    const links = locales ? (isBook ? bookLanguageAlternates(path, [...locales]) : collectionLanguageAlternates(slug!, [...locales])) : languageAlternates(path);
    const alternates = Object.entries(links).map(([language, href]) =>
      `<xhtml:link rel="alternate" hreflang="${language}" href="${escapeXml(absoluteLumiScoreUrl(href))}"/>`).join('');
    const priority = path === '/' ? '1.0' : path === '/taste-test' ? '0.8' : path.startsWith('/book/') ? '0.7' : '0.6';
    return (['en', 'nl'] as const).filter(locale => (!locales || bookUrlPolicy([...locales], locale).inSitemap) && (!shard || shard === 'pages' || shard === locale)).map(locale => `<url><loc>${escapeXml(absoluteLumiScoreUrl(localizedHref(path, locale)))}</loc>${isBook ? verifiedBookLastmod(path,locale,revisions) : sitemapLastModified(path, locale)}${alternates}<priority>${priority}</priority></url>`);
  }).join('');
  const newsEntries = !shard || shard === 'pages'
    ? [NEWS_PATH, ...publishedNews.map(article => article.path)].map(path =>
      `<url><loc>${escapeXml(absoluteLumiScoreUrl(localizedHref(path, 'nl')))}</loc><priority>0.6</priority></url>`).join('')
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries}${newsEntries}</urlset>`;
}

function verifiedBookLastmod(path:string,locale:Locale,revisions:ReadonlyMap<string,VerifiedPageRevision>):string {
 const at=verifiedPageLastmod(revisions.get(localizedHref(path,locale)));
 return at ? '<lastmod>'+at+'</lastmod>' : '';
}
