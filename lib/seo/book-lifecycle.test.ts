import assert from 'node:assert/strict';
import test from 'node:test';
import { bookUrlPolicy, bookLanguageAlternates, bookUrlStatus } from './book-locales.ts';
import { buildLocalizedSitemap } from './sitemap.ts';

test('all confirmed locale selections produce consistent sitemap, robots, canonical and schema policy', () => {
  const combinations = [[], ['en'], ['nl'], ['en', 'nl']] as const;
  for (const locales of combinations) for (const locale of ['en', 'nl'] as const) {
    const p = bookUrlPolicy(locales, locale);
    const xml = buildLocalizedSitemap([{workId:'99', locales}], [], locale);
    const member = xml.includes(`https://lumisco.re/${locale}/book/99</loc>`);
    assert.equal(member, p.inSitemap);
    assert.equal(p.httpStatus, 200);
    assert.equal(p.includeCanonical, member);
    assert.equal(p.includeBookSchema, member);
    assert.equal(p.robots, member ? 'index, follow' : 'noindex, follow');
    const links = bookLanguageAlternates('/book/99', locales);
    assert.deepEqual(Object.keys(links).sort(), locales.length === 2 ? ['en','nl-NL','x-default'] : []);
    if (locales.length === 2) assert.equal(links['x-default'], links.en);
    if (!member) assert.equal(bookUrlStatus(locales, locale), 'noindex');
  }
});
test('confirmed absence is retired/404; an existing Work with no eligible edition is not deleted or redirected', () => {
  for (const locale of ['en','nl'] as const) {
    const missing = bookUrlPolicy(null, locale);
    assert.equal(missing.status, 'retired'); assert.equal(missing.httpStatus, 404);
    assert.equal(missing.includeCanonical, false); assert.equal(missing.includeBookSchema, false);
    assert.equal(bookUrlPolicy([], locale).status, 'noindex');
    assert.equal(bookUrlPolicy([locale === 'en' ? 'nl' : 'en'], locale).status, 'locale-excluded');
  }
});
