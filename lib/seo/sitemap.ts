import { languageAlternates, localizedHref } from '../i18n/paths.ts';
import { absoluteLumiScoreUrl } from './site-origin.ts';

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
    '/toplijsten/dystopie-vanaf-1990',
    '/toplijsten/fantasy-sciencefiction',
    '/taste-test',
    '/over-ons',
    '/zo-werkt-het',
    '/voor-uitgevers',
    '/contact',
    ...collectionSlugs
      .map((slug) => slug.trim())
      .filter(Boolean)
      .map((slug) => `/collection/${encodeURIComponent(slug)}`),
    ...workIds
      .filter((workId) => /^\d+$/.test(workId))
      .map((workId) => `/book/${workId}`),
  ])];
}

function escapeXml(value: string): string { return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll("'", '&apos;'); }

export function buildLocalizedSitemap(workIds: readonly string[], collectionSlugs: readonly string[]): string {
  const entries = buildPublicSitemapPaths(workIds, collectionSlugs).flatMap(path => {
    const alternates = Object.entries(languageAlternates(path)).map(([language, href]) =>
      `<xhtml:link rel="alternate" hreflang="${language}" href="${escapeXml(absoluteLumiScoreUrl(href))}"/>`).join('');
    const priority = path === '/' ? '1.0' : path === '/taste-test' ? '0.8' : path.startsWith('/book/') ? '0.7' : '0.6';
    return (['en', 'nl'] as const).map(locale => `<url><loc>${escapeXml(absoluteLumiScoreUrl(localizedHref(path, locale)))}</loc>${alternates}<priority>${priority}</priority></url>`);
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries}</urlset>`;
}
