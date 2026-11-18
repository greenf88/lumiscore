import test from 'node:test';
import assert from 'node:assert/strict';
import { selectCollectionLocales, collectionLanguageAlternates } from './collection-locales.ts';
import { selectSitemapBookLocales } from './book-locales.ts';
import { buildLocalizedSitemap } from './sitemap.ts';

test('empty locale leaves sitemap and alternates; adding a verified edition restores it without an override', () => {
  const collections = [{ id: 1, slug: 'sample-series' }];
  const memberships = [{ collection_id: 1, work_id: 42 }];
  const works = [{ id: 42, title: 'Sample' }];
  const edition = { id: 1, work_id: 42, title: 'Sample', language: 'eng', isbn_13: null, open_library_edition_id: null };
  const en = selectSitemapBookLocales(works, [edition]);
  const selected = selectCollectionLocales(collections, memberships, en);
  assert.deepEqual(selected.get('sample-series'), ['en']);
  assert.deepEqual(collectionLanguageAlternates('sample-series', ['en']), {});
  const xml = buildLocalizedSitemap(en, ['sample-series'], 'pages', new Map(), selected);
  assert.match(xml, /<loc>[^<]*\/en\/collection\/sample-series<\/loc>/);
  assert.doesNotMatch(xml, /\/nl\/collection\/sample-series/);
  assert.doesNotMatch(xml, /\/book\/42/);
  const bookXml = buildLocalizedSitemap(en, ['sample-series'], 'en', new Map(), selected);
  assert.match(bookXml, /\/en\/book\/42/);
  assert.doesNotMatch(bookXml, /\/collection\//);
  const both = selectSitemapBookLocales(works, [edition, { ...edition, id: 2, language: 'dut' }]);
  const restored = selectCollectionLocales(collections, memberships, both);
  assert.deepEqual(restored.get('sample-series'), ['en', 'nl']);
  assert.equal(Object.keys(collectionLanguageAlternates('sample-series', ['en', 'nl'])).length, 3);
  assert.match(buildLocalizedSitemap(both, ['sample-series'], 'pages', new Map(), restored), /\/nl\/collection\/sample-series/);
});

test('an editorial guide can remain indexable without books; unknown collections do not inherit eligibility', () => {
  const selected = selectCollectionLocales([{ id: 1, slug: 'suzanne-vermeer' }, { id: 2, slug: 'empty-fixture' }], [], []);
  assert.ok(selected.get('suzanne-vermeer')?.includes('nl'));
  assert.deepEqual(selected.get('empty-fixture'), []);
  const xml = buildLocalizedSitemap([], ['empty-fixture', 'unknown-fixture'], 'pages', new Map(), selected);
  assert.doesNotMatch(xml, /empty-fixture|unknown-fixture/);
});

test('dangling memberships and editions in another language do not create a translated collection', () => {
  const selected = selectCollectionLocales([{ id: 1, slug: 'series' }],
    [{ collection_id: 1, work_id: 1 }, { collection_id: 1, work_id: 99 }], [{ workId: '2', locales: ['nl'] }]);
  assert.deepEqual(selected.get('series'), []);
});
