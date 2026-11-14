import assert from 'node:assert/strict';
import test from 'node:test';
import { bookUrlPolicy, bookLanguageAlternates, bookUrlStatus, getBookLocales } from './book-locales.ts';
import { buildLocalizedSitemap } from './sitemap.ts';

test('corrected Spanish Rabia edition remains usable without an English or Dutch indexable page', () => {
  const editions = [{ id: '4533', work_id: '4374', title: 'Rabia / Rage', language: 'spa',
    isbn_13: '9788497595902', isbn_10: '8497595904', open_library_edition_id: 'OL9154458M' }];
  const locales = getBookLocales('4374', 'Rage', editions);
  assert.deepEqual(locales, []);
  for (const locale of ['en', 'nl'] as const) {
    const policy = bookUrlPolicy(locales, locale);
    assert.equal(policy.httpStatus, 200);
    assert.equal(policy.robots, 'noindex, follow');
    assert.equal(policy.includeCanonical, false);
    assert.equal(policy.includeBookSchema, false);
    assert.ok(!buildLocalizedSitemap([{workId:'4374',locales}], [], locale).includes('/book/4374'));
  }
});

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
