import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  REVIEWED_SERIES_BOOKS,
  REVIEWED_SERIES_CATALOG_PLANS,
} from './series-catalog-plan.ts';

test('Harry Potter plans exactly seven distinct ordered main novels', () => {
  const harry = REVIEWED_SERIES_CATALOG_PLANS.find(({ slug }) => slug === 'harry-potter');
  assert.ok(harry);
  assert.equal(harry.books.length, 7);
  assert.deepEqual(harry.books.map(({ sequenceNumber }) => sequenceNumber), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(new Set(harry.books.map(({ openLibraryWorkId }) => openLibraryWorkId)).size, 7);
  assert.ok(harry.books.every(({ author }) => author === 'J. K. Rowling'));
  assert.ok(harry.books.every(({ editionLanguagesToImport }) =>
    editionLanguagesToImport.includes('eng') && editionLanguagesToImport.includes('nld')));
  assert.ok(harry.books.every(({ title }) =>
    !/Fantastic Beasts|Quidditch Through the Ages|Beedle the Bard/i.test(title)));
});

test('reviewed target series have unique exact work identities and contiguous order', () => {
  assert.equal(REVIEWED_SERIES_CATALOG_PLANS.length, 7);
  assert.equal(new Set(REVIEWED_SERIES_BOOKS.map(({ openLibraryWorkId }) => openLibraryWorkId)).size, REVIEWED_SERIES_BOOKS.length);
  for (const series of REVIEWED_SERIES_CATALOG_PLANS) {
    assert.deepEqual(
      series.books.map(({ sequenceNumber }) => sequenceNumber),
      Array.from({ length: series.books.length }, (_, index) => index + 1),
      series.name,
    );
  }
});

test('series importer remains pinned and stores separate verified language editions', async () => {
  const [importer, seeds] = await Promise.all([
    readFile(new URL('../../scripts/import-open-library.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../scripts/open-library-seeds.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(seeds, /REVIEWED_SERIES_SEED_BOOKS/);
  assert.match(importer, /scope !== 'series'/);
  assert.match(importer, /editionLanguagesToImport/);
  assert.match(importer, /for \(const edition of book\.editions\)/);
  assert.doesNotMatch(importer, /editionFallbacks\.push\(\{ \[columns\.editions\.workId\]: work\.id \}\)/);
});

test('collection synchronization resolves database work IDs without changing reading statuses', async () => {
  const sync = await readFile(new URL('../../scripts/sync-reviewed-series-collections.ts', import.meta.url), 'utf8');
  assert.match(sync, /SERIES_COLLECTION_APPLY === 'true'/);
  assert.match(sync, /open_library_id/);
  assert.match(sync, /work_id: member\.workId/);
  assert.doesNotMatch(sync, /user_book_status|ratings/);
});
