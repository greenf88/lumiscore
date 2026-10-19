import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { IMDB_COMPARISON_CONTENT } from './imdb-comparison.ts';
import { buildInformationPageJsonLd, getInformationPageContent } from './pages.ts';
import { languageRoute, localizedHref, languageAlternates } from '../i18n/paths.ts';
import { createPageMetadata } from '../seo/page-metadata.ts';
import { buildLocalizedSitemap } from '../seo/sitemap.ts';
import { LUMISCORE_WEBSITE_ID } from '../seo/site-identity.ts';

test('comparison uses one route with canonical translated slugs, preserving query and fragment', () => {
  for (const [locale, path] of [['nl', '/imdb-voor-boeken'], ['en', '/imdb-for-books']] as const) {
    assert.deepEqual(languageRoute(`/${locale}${path}`), { kind: 'rewrite', path: '/imdb-for-books', locale });
    for (const source of ['/imdb-for-books', '/imdb-voor-boeken', '/nl/imdb-voor-boeken', '/en/imdb-for-books']) {
      assert.equal(localizedHref(source + '?from=home#questions', locale), `/${locale}${path}?from=home#questions`);
    }
    assert.deepEqual(languageRoute(`/${locale}${path}/`), { kind: 'redirect', path: `/${locale}${path}` });
  }
  assert.deepEqual(languageRoute('/nl/imdb-for-books'), { kind: 'redirect', path: '/nl/imdb-voor-boeken' });
  assert.deepEqual(languageRoute('/en/imdb-voor-boeken'), { kind: 'redirect', path: '/en/imdb-for-books' });
  assert.deepEqual(languageRoute('/imdb-voor-boeken'), { kind: 'redirect', path: '/en/imdb-for-books' });
  assert.deepEqual(languageAlternates('/imdb-voor-boeken'), { en: '/en/imdb-for-books', 'nl-NL': '/nl/imdb-voor-boeken', 'x-default': '/en/imdb-for-books' });
  for (const path of ['/book/8', '/browse?page=2#results', '/account', '/api/catalog/search', '/sitemap.xml']) {
    assert.ok(!localizedHref(path, 'nl').includes('imdb'));
  }
});

test('approved NL/EN metadata, visible answers and shared page schema match', () => {
  for (const locale of ['nl', 'en'] as const) {
    const page = getInformationPageContent('imdbComparison', locale);
    assert.equal(page, IMDB_COMPARISON_CONTENT[locale]);
    assert.equal(page.seoTitle, locale === 'nl' ? 'IMDb voor boeken? Ontdek LumiScore' : 'Looking for an IMDb for Books? Meet LumiScore');
    assert.equal(page.title, locale === 'nl' ? 'Zoek je een IMDb voor boeken?' : 'Looking for an IMDb for books?');
    const meta = createPageMetadata({ title: page.seoTitle, description: page.seoDescription, canonicalPath: page.path, locale });
    assert.equal(meta.alternates.canonical, `https://lumisco.re/${locale}${page.path}`);
    assert.equal(meta.openGraph.siteName, 'LumiScore');
    assert.deepEqual(meta.robots, { index: true, follow: true });
    assert.deepEqual(meta.alternates.languages, { en: 'https://lumisco.re/en/imdb-for-books', 'nl-NL': 'https://lumisco.re/nl/imdb-voor-boeken', 'x-default': 'https://lumisco.re/en/imdb-for-books' });
    assert.equal(page.actions?.filter(a => a.variant === 'primary').length, 1);
    assert.deepEqual(page.actions?.map(a => [a.href, a.variant]), [['/browse', 'primary'], ['/taste-test', 'secondary']]);
    assert.equal(page.faq?.items.length, 4);
    assert.match(page.disclaimer ?? '', locale === 'nl' ? /niet verbonden aan IMDb/ : /not affiliated with IMDb/);
    const content = JSON.stringify(page);
    assert.match(content, locale === 'nl' ? /drie verschillende beoordelaars/ : /three different readers/);
    assert.match(content, locale === 'nl' ? /weinig beoordelingen/ : /few ratings/);
    assert.doesNotMatch(content, /Top 250|geschreven reviews|written reviews|importfunctie|#1|ranking guarantee|maandelijks.*zoek/i);
    assert.ok(content.includes('"href":"/collections"'));
    const schema = buildInformationPageJsonLd(page);
    assert.equal(schema[0]['@type'], 'WebPage');
    assert.equal(schema[0].isPartOf?.['@id'], LUMISCORE_WEBSITE_ID);
    assert.equal(schema[1]['@type'], 'BreadcrumbList');
    assert.doesNotMatch(JSON.stringify(schema), /FAQPage|AggregateRating|sameAs|"@type":"WebSite"/);
  }
});

test('new sitemap entries are paired, unique and never list wrong-language aliases', () => {
  const xml = buildLocalizedSitemap(['8'], ['dune']);
  for (const path of ['/nl/imdb-voor-boeken', '/en/imdb-for-books']) {
    assert.equal(xml.split(`<loc>https://lumisco.re${path}</loc>`).length - 1, 1);
  }
  assert.doesNotMatch(xml, /\/nl\/imdb-for-books|\/en\/imdb-voor-boeken/);
  for (const entry of xml.match(/<url>[\s\S]*?<\/url>/g) ?? []) if (entry.includes('/imdb-')) {
    assert.match(entry, /hreflang="nl-NL" href="https:\/\/lumisco.re\/nl\/imdb-voor-boeken"/);
    assert.match(entry, /hreflang="en" href="https:\/\/lumisco.re\/en\/imdb-for-books"/);
  }
});

test('comparison is static copy using shared controls, with small contextual entry links', async () => {
  const [route, home, renderer, styles] = await Promise.all([
    readFile(new URL('../../app/imdb-for-books/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../app/components/LumiScoreHome.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../app/components/LumiScoreInformationPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../app/globals.css', import.meta.url), 'utf8'),
  ]);
  assert.match(route, /LumiScoreInformationRoute pageKey="imdbComparison"/);
  assert.doesNotMatch(route, /supabase|fetch\(|BookCard|loadCatalog/);
  assert.match(home, /<ValueStrip \/>\s*<p className="home-comparison-note">/);
  assert.equal((home.match(/href="\/imdb-for-books"/g) ?? []).length, 1);
  assert.match(renderer, /information-actions/);
  assert.match(renderer, /ui-control ui-\$\{action.variant\}/);
  assert.match(styles, /\.information-actions \.ui-control[^}]*min-height: 48px/);
  for (const locale of ['nl', 'en'] as const) {
    assert.ok(JSON.stringify(getInformationPageContent('howItWorks', locale)).includes('"href":"/imdb-for-books"'));
  }
});
