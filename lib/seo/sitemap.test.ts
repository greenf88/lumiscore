import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLocalizedSitemap, buildPublicSitemapPaths } from './sitemap.ts';
import { bookUrlStatus, resolveBookLifecycle, selectSitemapBookLocales } from './book-locales.ts';
import type { StrictEditionRow } from '../books/strict-edition.ts';
import { editorialTopLists } from '../catalog/top-lists.ts';

test('sitemap paths include all current public books and collections without duplicates', () => {
  assert.deepEqual(
    buildPublicSitemapPaths(['8', '1300', '8'], ['dune', 'harry-potter', 'dune']),
    [
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
      '/collection/dune',
      '/collection/harry-potter',
      '/book/8',
      '/book/1300',
    ],
  );
});

test('canonical category overview occurs once; discovery variants stay excluded', () => {
  const paths = buildPublicSitemapPaths(['168', '168'], ['dune', 'dune']);
  assert.equal(paths.filter((path) => path === '/categories').length, 1);
  assert.equal(paths.filter((path) => path === '/book/168').length, 1);
  assert.equal(paths.filter((path) => path === '/collection/dune').length, 1);
  assert.equal(paths.some((path) => path.includes('?')), false);
  assert.equal(paths.includes('/search'), false);
  assert.equal(paths.includes('/recommendations'), false);
});

test('sitemap excludes malformed and private routes', () => {
  const paths = buildPublicSitemapPaths(['8', 'not-an-id'], ['public-series', '']);
  assert.equal(paths.includes('/my-books'), false);
  assert.equal(paths.includes('/login'), false);
  assert.equal(paths.some((path) => path.startsWith('/search')), false);
  assert.equal(paths.includes('/book/not-an-id'), false);
});

test('sitemap includes all public information pages exactly once', () => {
  const paths = buildPublicSitemapPaths([], []);
  for (const path of ['/over-ons', '/zo-werkt-het', '/voor-uitgevers', '/contact']) {
    assert.equal(paths.filter((entry) => entry === path).length, 1);
  }
});

test('sitemap includes only valid detail presentations with reciprocal pairs', () => {
  const edition = (id: number, work_id: number, language: string, title = 'Book'): StrictEditionRow =>
    ({ id, work_id, title, language, isbn_13: null, open_library_edition_id: null });
  const selected = selectSitemapBookLocales(
    [1, 2, 3, 4, 5, 6, 0].map(id => ({id, title: id === 6 ? ' ' : 'Book'})),
    [
      edition(1, 1, 'en'), edition(2, 1, '/languages/nld'), edition(3, 2, 'nld'),
      edition(4, 3, 'nld', 'Book Audiobook'), edition(5, 4, 'mul'),
      edition(6, 5, 'eng', ' '), edition(7, 6, 'eng'), edition(8, 0, 'eng'),
    ],
  );
  assert.deepEqual(selected, [{workId:'1', locales:['en','nl']}, {workId:'2', locales:['nl']}]);
  const xml = buildLocalizedSitemap([...selected, ...selected], ['dune', 'dune']);
  const entries = [...xml.matchAll(/<url><loc>(https:\/\/lumisco\.re\/(?:nl|en)\/book\/\d+)<\/loc>(.*?)<\/url>/g)];
  assert.deepEqual(entries.map(entry => entry[1]), ['https://lumisco.re/en/book/1', 'https://lumisco.re/nl/book/1', 'https://lumisco.re/nl/book/2']);
  assert.equal(entries[0][2], entries[1][2]);
  assert.match(entries[0][2], /hreflang="x-default" href="https:\/\/lumisco\.re\/en\/book\/1"/);
  assert.doesNotMatch(entries[2][2], /hreflang/);
});

test('edition cohorts share sitemap eligibility without retiring existing public works', () => {
  const examples = [
    { id: 2093, title: 'On Liberty', language: 'eng', editionTitle: 'On Liberty', isbn: '9780742542464' },
    { id: 5226, title: 'Auschwitz 13917', language: 'dut', editionTitle: 'Auschwitz 13917', isbn: '9789089751775' },
    { id: 1048, title: 'Moedervlekken', language: null, editionTitle: 'Muttermale', isbn: '9783462049251' },
  ];
  const works = Array.from({ length: 90 }, (_, index) => ({
    ...examples[index % examples.length], id: index < 3 ? examples[index].id : 10_000 + index,
  }));
  const editions = works.map(work => ({
    id: work.id, work_id: work.id, title: work.editionTitle, language: work.language,
    isbn_13: work.isbn, open_library_edition_id: null,
  }));
  const members = new Map(selectSitemapBookLocales(works, editions).map(row => [row.workId, row.locales]));
  const counts = { indexable: 0, noindex: 0, retired: 0 };
  for (const work of works) for (const locale of ['en', 'nl'] as const) {
    const status = resolveBookLifecycle(work, editions.filter(edition => edition.work_id === work.id), locale).status;
    counts[status]++;
    assert.equal(bookUrlStatus(members.get(String(work.id)) ?? [], locale), status);
    assert.equal(status === 'indexable', locale === 'en' ? work.language === 'eng' : work.language === 'dut');
  }
  for (let missing = 0; missing < 10; missing++) for (const locale of ['en', 'nl'] as const) {
    const status = resolveBookLifecycle(null, [], locale).status;
    counts[status]++;
    assert.equal(bookUrlStatus(null, locale), 'retired');
  }
  assert.deepEqual(counts, { indexable: 60, noindex: 120, retired: 20 });
});

test('only matching published content advertises a stable lastmod', () => {
  const first = buildLocalizedSitemap([], ['suzanne-vermeer', 'dune'], 'pages');
  assert.equal(buildLocalizedSitemap([], ['suzanne-vermeer', 'dune'], 'pages'), first);
  const dates = [...first.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)];
  assert.equal(dates.length, 5);
  assert.ok(dates.every(([, url, date]) => url.startsWith('https://lumisco.re/nl/') && date === '2026-11-04'));
  assert.ok(dates.some(([, url]) => url.endsWith('/collection/suzanne-vermeer')));
  assert.doesNotMatch(buildLocalizedSitemap([{ workId: '1', locales: ['en'] }], [], 'en'), /<lastmod>/);
});
