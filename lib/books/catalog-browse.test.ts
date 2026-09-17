import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CATALOG_BROWSE_PAGE_SIZE,
  clampCatalogBrowsePage,
  getCatalogBrowseHref,
  getCatalogBrowseOrder,
  getCatalogBrowsePageCount,
  getCatalogBrowseRange,
  normalizeCatalogBrowsePage,
  normalizeCatalogBrowseSort,
} from './catalog-browse.ts';

test('browse works without a search query and defaults to deterministic A-Z ordering', () => {
  assert.equal(normalizeCatalogBrowsePage(undefined), 1);
  assert.equal(normalizeCatalogBrowseSort(undefined), 'az');
  assert.deepEqual(getCatalogBrowseOrder('az'), [
    { column: 'title', ascending: true },
    { column: 'id', ascending: true },
  ]);
  assert.equal(getCatalogBrowseHref(1, 'az'), '/browse');
});

test('browse page ranges are database-sized and never overlap', () => {
  assert.equal(CATALOG_BROWSE_PAGE_SIZE, 30);
  assert.deepEqual(getCatalogBrowseRange(1), { from: 0, to: 29 });
  assert.deepEqual(getCatalogBrowseRange(2), { from: 30, to: 59 });
  assert.equal(getCatalogBrowseRange(1).to < getCatalogBrowseRange(2).from, true);
});

test('invalid and out-of-range pages are handled safely', () => {
  assert.equal(normalizeCatalogBrowsePage('-2'), 1);
  assert.equal(normalizeCatalogBrowsePage('2.5'), 1);
  assert.equal(normalizeCatalogBrowsePage('abc'), 1);
  assert.equal(getCatalogBrowsePageCount(2_511), 84);
  assert.equal(clampCatalogBrowsePage(999, 2_511), 84);
});

test('newest sorting is deterministic and keeps unknown years last', () => {
  assert.equal(normalizeCatalogBrowseSort('newest'), 'newest');
  assert.equal(normalizeCatalogBrowseSort('popular'), 'az');
  assert.deepEqual(getCatalogBrowseOrder('newest'), [
    { column: 'first_publish_year', ascending: false, nullsFirst: false },
    { column: 'title', ascending: true },
    { column: 'id', ascending: true },
  ]);
  assert.equal(getCatalogBrowseHref(3, 'newest'), '/browse?sort=newest&page=3');
});
