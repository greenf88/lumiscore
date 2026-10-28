import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLocalizedSitemap, buildPublicSitemapPaths } from './sitemap.ts';
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

test('editorial sitemap publishes only canonical English toplists and Dutch toplijsten, with reciprocal alternates', () => {
  const xml=buildLocalizedSitemap([],[]);
  for(const suffix of ['',...editorialTopLists.map(list=>'/'+list.slug)]){
    const en='https://lumisco.re/en/toplists'+suffix,nl='https://lumisco.re/nl/toplijsten'+suffix;
    assert.equal(xml.split('<loc>'+en+'</loc>').length-1,1);
    assert.equal(xml.split('<loc>'+nl+'</loc>').length-1,1);
    assert.ok(xml.includes('hreflang="en" href="'+en+'"'));
    assert.ok(xml.includes('hreflang="nl-NL" href="'+nl+'"'));
  }
  assert.doesNotMatch(xml,/https:\/\/lumisco\.re\/(?:en\/toplijsten|nl\/toplists)/);
});
