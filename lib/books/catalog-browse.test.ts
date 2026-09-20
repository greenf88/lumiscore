import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CATALOG_BROWSE_PAGE_SIZE,
  CATALOG_BROWSE_PAGE_SIZES,
  clampCatalogBrowsePage,
  getCatalogBrowsePageAfterPageSizeChange,
  getCatalogBrowseHref,
  getCatalogBrowseOrder,
  getCatalogBrowsePageCount,
  getCatalogBrowseRange,
  normalizeCatalogBrowsePage,
  normalizeCatalogBrowsePageSize,
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
  assert.equal(CATALOG_BROWSE_PAGE_SIZE, 32);
  assert.deepEqual(CATALOG_BROWSE_PAGE_SIZES, [32, 64, 128]);
  assert.deepEqual(getCatalogBrowseRange(1), { from: 0, to: 31 });
  assert.deepEqual(getCatalogBrowseRange(2), { from: 32, to: 63 });
  assert.deepEqual(getCatalogBrowseRange(2, 128), { from: 128, to: 255 });
  assert.equal(getCatalogBrowseRange(1).to < getCatalogBrowseRange(2).from, true);
});

test('page-size validation is strict and changing it preserves the first visible item', () => {
  assert.equal(normalizeCatalogBrowsePageSize('32'), 32);
  assert.equal(normalizeCatalogBrowsePageSize('64'), 64);
  assert.equal(normalizeCatalogBrowsePageSize('128'), 128);
  for (const invalid of ['0', '-1', '30', '129', '100000', 'abc', '64.5']) {
    assert.equal(normalizeCatalogBrowsePageSize(invalid), 32, invalid);
  }
  assert.equal(getCatalogBrowsePageAfterPageSizeChange(2, 32, 64), 1);
  assert.equal(getCatalogBrowsePageAfterPageSizeChange(2, 128, 32), 5);
  assert.equal(getCatalogBrowsePageAfterPageSizeChange(999, 128, 32, 100), 4);
});

test('invalid and out-of-range pages are handled safely', () => {
  assert.equal(normalizeCatalogBrowsePage('-2'), 1);
  assert.equal(normalizeCatalogBrowsePage('2.5'), 1);
  assert.equal(normalizeCatalogBrowsePage('abc'), 1);
  assert.equal(getCatalogBrowsePageCount(2_511), 79);
  assert.equal(clampCatalogBrowsePage(999, 2_511), 79);
});

test('newest sorting is deterministic and keeps unknown years last', () => {
  assert.equal(normalizeCatalogBrowseSort('newest'), 'newest');
  assert.equal(normalizeCatalogBrowseSort('popular'), 'az');
  assert.deepEqual(getCatalogBrowseOrder('newest'), [
    { column: 'first_publish_year', ascending: false, nullsFirst: false },
    { column: 'title', ascending: true },
    { column: 'id', ascending: true },
  ]);
  assert.equal(getCatalogBrowseHref(3, 'newest'), '/browse?page=3&sort=newest');
  assert.equal(
    getCatalogBrowseHref(2, 'newest', 64),
    '/browse?page=2&pageSize=64&sort=newest',
  );
});
