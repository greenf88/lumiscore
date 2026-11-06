import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLocalizedSitemap, buildPublicSitemapPaths } from './sitemap.ts';
import { selectSitemapBookLocales } from './book-locales.ts';
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
