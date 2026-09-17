import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '@/app/data/books';
import {
  CATALOG_SEARCH_PAGE_LIMIT,
  collectCatalogSearchAliases,
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

const productionAliasBooks = [
  fixture('1907', 'The Secret of Secrets', 'Dan Brown', 'OL42542598W'),
  fixture('1342', 'Je revenais des autres', 'Mélissa Da Costa', 'OL24343547W'),
  fixture('1343', 'Always Remember', 'Charlie Mackesy', 'OL43541951W'),
  fixture('124', 'Before the Coffee Gets Cold', '川口俊和', 'OL20019347W'),
  fixture('1920', 'Heartstopper, Volume Five', 'Alice Oseman', 'OL28959223W'),
  fixture('2193', 'Theo of Golden', 'Allen Levi', 'OL36475397W'),
];

const productionEditionAliases = [
  { workId: '1907', title: 'Het ultieme geheim' },
  { workId: '1342', title: 'Waar de zon de sneeuw raakt' },
  { workId: '1343', title: 'Onthoud dit altijd' },
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

test('supports a dedicated results page with at least twenty ranked matches', () => {
  const matches = Array.from({ length: 30 }, (_, index) =>
    fixture(
      String(index + 100),
      `Catalog title ${String(index + 1).padStart(2, '0')}`,
      'Catalog Author',
    ),
  );

  const results = rankCatalogSearchResults(
    matches,
    'catalog',
    CATALOG_SEARCH_PAGE_LIMIT,
  );

  assert.equal(CATALOG_SEARCH_PAGE_LIMIT >= 20, true);
  assert.equal(results.length, CATALOG_SEARCH_PAGE_LIMIT);
  assert.deepEqual(
    results.slice(0, 3).map((book) => book.title),
    ['Catalog title 01', 'Catalog title 02', 'Catalog title 03'],
  );
});

test('the reviewed production aliases resolve to their intended existing Works', () => {
  const expectedWorkIds = new Map([
    ['Het ultieme geheim', '1907'],
    ['Waar de zon de sneeuw raakt', '1342'],
    ['Onthoud dit altijd', '1343'],
    ['コーヒーが冷めないうちに', '124'],
    ['Heartstopper: Volume Five', '1920'],
    ['Theo in Golden', '2193'],
  ]);

  for (const [query, expectedWorkId] of expectedWorkIds) {
    const { aliasesByWorkId } = collectCatalogSearchAliases(
      query,
      productionEditionAliases,
    );
    const results = rankCatalogSearchResults(
      productionAliasBooks,
      query,
      CATALOG_SEARCH_PAGE_LIMIT,
      aliasesByWorkId,
    );
    assert.equal(results[0]?.workId, expectedWorkId, query);
  }
});

test('canonical titles still resolve normally after alias indexing', () => {
  for (const book of productionAliasBooks) {
    assert.equal(rankCatalogSearchResults(productionAliasBooks, book.title)[0]?.workId, book.workId);
  }
});

test('a Work matched through both its canonical title and an alias is returned once', () => {
  const book = fixture('1920', 'Heartstopper: Volume Five', 'Alice Oseman', 'OL28959223W');
  const { aliasesByWorkId } = collectCatalogSearchAliases(
    'Heartstopper: Volume Five',
    productionEditionAliases,
  );
  const results = rankCatalogSearchResults(
    [book, book],
    'Heartstopper: Volume Five',
    CATALOG_SEARCH_PAGE_LIMIT,
    aliasesByWorkId,
  );

  assert.deepEqual(results.map(({ workId }) => workId), ['1920']);
});

test('Theo canonical and reviewed alternate wording resolve once to the same Work', () => {
  const theo = fixture('2193', 'Theo of Golden', 'Allen Levi', 'OL36475397W');
  const canonical = rankCatalogSearchResults([theo, theo], 'Theo of Golden');
  const { aliasesByWorkId } = collectCatalogSearchAliases(
    'Theo in Golden',
    productionEditionAliases,
  );
  const alias = rankCatalogSearchResults(
    [theo, theo],
    'Theo in Golden',
    CATALOG_SEARCH_PAGE_LIMIT,
    aliasesByWorkId,
  );

  assert.deepEqual(canonical.map(({ workId }) => workId), ['2193']);
  assert.deepEqual(alias.map(({ workId }) => workId), ['2193']);
});

test('alias normalization handles punctuation, case, and Unicode without affecting unrelated fuzzy searches', () => {
  const { aliasesByWorkId } = collectCatalogSearchAliases(
    'HEARTSTOPPER VOLUME FIVE',
    productionEditionAliases,
  );
  assert.equal(
    rankCatalogSearchResults(
      productionAliasBooks,
      'HEARTSTOPPER VOLUME FIVE',
      CATALOG_SEARCH_PAGE_LIMIT,
      aliasesByWorkId,
    )[0]?.workId,
    '1920',
  );

  assert.deepEqual(
    rankCatalogSearchResults(catalog, 'hob').map(({ workId }) => workId),
    ['2'],
  );
});
