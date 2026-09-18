import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPublicSitemapPaths } from './sitemap.ts';

test('sitemap paths include all current public books and collections without duplicates', () => {
  assert.deepEqual(
    buildPublicSitemapPaths(['8', '1300', '8'], ['dune', 'harry-potter', 'dune']),
    [
      '/',
      '/browse',
      '/collections',
      '/taste-test',
      '/over-ons',
      '/zo-werkt-het',
      '/voor-uitgevers',
      '/contact',
      '/collection/dune',
      '/collection/harry-potter',
      '/book/8',
      '/book/1300',
    ],
  );
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
