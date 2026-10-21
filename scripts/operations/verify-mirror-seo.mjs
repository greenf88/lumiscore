// Read-only, actual local server HTML: never submit URLs or connect to production.
import assert from 'node:assert/strict';
import { inspectServerHtml } from '../../lib/seo/server-html.ts';

const origin = process.env.SEO_TEST_ORIGIN;
if (!origin || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname)) {
  throw Error('Set SEO_TEST_ORIGIN to the actual local test-catalogue server. No production requests.');
}
const results = [];
const expectedRobots = process.env.SEO_EXPECT_PREVIEW === '1' ? 'noindex, follow' : 'index, follow';
for (const locale of ['nl', 'en']) {
  for (const suffix of ['', '?returnTo=%2Fcollection%2Fonce-upon-a-broken-heart']) {
    const path = `/${locale}/book/10138${suffix}`;
    const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(20_000) });
    assert.equal(response.status, 200);
    const html = await response.text();
    const tags = inspectServerHtml(html);
    const canonical = `https://lumisco.re/${locale}/book/10138`;
    assert.equal(tags.lang, locale);
    assert.deepEqual(tags.canonical, [canonical]);
    assert.deepEqual(tags.robots, [expectedRobots]);
    assert.deepEqual(tags.duplicates, []);
    assert.deepEqual(tags.h1, ['The Mirror of Infinite Endings']);
    assert.match(tags.metadata.description[0], /Lotusbubble/);
    assert.deepEqual(tags.metadata['og:site_name'], ['LumiScore']);
    assert.deepEqual(tags.metadata['og:url'], [canonical]);
    const schemas = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
    assert.equal(schemas.filter(s => s['@type'] === 'WebSite').length, 1);
    const books = schemas.filter(s => s['@type'] === 'Book');
    assert.equal(books.length, 1);
    const book = books[0];
    assert.equal(book.isbn, '9781250462039');
    assert.equal(book.inLanguage, 'en');
    assert.equal(book.mainEntityOfPage.inLanguage, locale);
    assert.equal(book.url, canonical);
    assert.equal(book.aggregateRating, undefined);
    assert.ok(html.includes(book.description), 'Own description is actual visible server copy too');
    assert.deepEqual(tags.metadata['og:image'], [book.image]);
    assert.deepEqual(tags.metadata['twitter:image'], [book.image]);
    const image = [...html.matchAll(/<img\b[^>]*>/g)].map(m => m[0]).find(i => i.includes('15201916-L.jpg'));
    assert.ok(image, 'Reviewed cover is present before client JavaScript');
    assert.match(image, locale === 'nl' ? /alt="Voorkant van The Mirror of Infinite Endings"/ : /alt="Front cover of The Mirror of Infinite Endings"/);
    const alternateTags = [...html.matchAll(/<link\b[^>]*rel="alternate"[^>]*>/g)].map(m => m[0]);
    const alternates = Object.fromEntries(alternateTags.map(t => [t.match(/hreflang="([^"]+)"/)[1], t.match(/href="([^"]+)"/)[1]]));
    assert.deepEqual(alternates, { en: 'https://lumisco.re/en/book/10138', 'nl-NL': 'https://lumisco.re/nl/book/10138', 'x-default': 'https://lumisco.re/en/book/10138' });
    results.push({ path, status: response.status, canonical, schema: 'Book', editionLanguage: book.inLanguage, cover: book.image, descriptiveAlt: true });
  }
}
const sitemap = await fetch(new URL('/sitemap.xml', origin), { signal: AbortSignal.timeout(20_000) });
assert.equal(sitemap.status, 200);
const xml = await sitemap.text();
for (const locale of ['nl', 'en']) assert.ok(xml.includes(`<loc>https://lumisco.re/${locale}/book/10138</loc>`));
console.log(JSON.stringify({ productionRequests: 0, indexSubmissions: 0, sitemap: 'both clean routes present', results }, null, 2));
