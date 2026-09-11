import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '@/app/data/books';
import {
  isCatalogSearchQuery,
  rankCatalogSearchResults,
} from './catalog-search.ts';

const fixture = (
  id: string,
  title: string,
  author: string,
  openLibraryWorkId: string | null = `OL${id}W`,
): Book => ({
  id,
  source: 'supabase',
  workId: id,
  openLibraryWorkId,
  title,
  author,
  firstPublishYear: 2000,
  score: null,
  ratingsCount: null,
  match: null,
  cover: 'orbit',
});

const catalog = [
  fixture('1', 'Harry Potter and the Philosopher\'s Stone', 'J.K. Rowling'),
  fixture('2', 'The Hobbit', 'J.R.R. Tolkien'),
  fixture('3', 'Atomic Habits', 'James Clear'),
  fixture('4', 'Winterberg', 'Suzanne Vermeer', null),
  fixture('5', 'De Hongerspelen', 'Suzanne Collins'),
];

test('finds exact and partial titles case-insensitively', () => {
  assert.equal(rankCatalogSearchResults(catalog, 'ATOMIC')[0]?.title, 'Atomic Habits');
  assert.equal(rankCatalogSearchResults(catalog, 'harry')[0]?.workId, '1');
  assert.equal(rankCatalogSearchResults(catalog, 'honger')[0]?.workId, '5');
});

test('finds authors and includes native works without an Open Library ID', () => {
  assert.equal(rankCatalogSearchResults(catalog, 'tolkien')[0]?.workId, '2');
  const vermeer = rankCatalogSearchResults(catalog, 'VERMEER');
  assert.equal(vermeer[0]?.workId, '4');
  assert.equal(vermeer[0]?.openLibraryWorkId, null);
});

test('puts title matches before author matches', () => {
  const results = rankCatalogSearchResults(
    [
      fixture('6', 'Vermeer', 'Jane Doe'),
      fixture('7', 'All-inclusive', 'Suzanne Vermeer'),
    ],
    'vermeer',
  );
  assert.deepEqual(results.map((book) => book.workId), ['6', '7']);
});

test('returns no results for empty, one-character, and unmatched queries', () => {
  assert.equal(isCatalogSearchQuery(''), false);
  assert.equal(isCatalogSearchQuery('a'), false);
  assert.deepEqual(rankCatalogSearchResults(catalog, ''), []);
  assert.deepEqual(rankCatalogSearchResults(catalog, 'zzzz-not-found'), []);
});
