import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '../../app/data/books.ts';
import {
  calculateCollectionProgress,
  calculateSeriesProgress,
  selectHighestRatedUnread,
  selectSeriesContinuation,
  selectSeriesContinuations,
  type CollectionBook,
  type ReadingStatus,
} from './model.ts';
import {
  canShowProgressDenominator,
  canShowSeriesDenominator,
} from './presentation.ts';

function book(workId: string, score: number | null = null, year = 2000): CollectionBook {
  return {
    workId,
    sequenceNumber: Number(workId),
    publicationOrder: Number(workId),
    subgroup: null,
    book: {
      id: `work-${workId}`,
      source: 'supabase',
      workId,
      title: `Book ${workId}`,
      author: 'Author',
      firstPublishYear: year,
      score,
      ratingsCount: score === null ? 0 : 2,
      match: null,
      cover: 'orbit',
    } satisfies Book,
  };
}

function statuses(entries: Array<[string, ReadingStatus]>) {
  return new Map(entries);
}

test('series continuation follows the first missing book after the contiguous prefix', () => {
  const books = [1, 2, 3, 4, 5].map((id) => book(String(id)));
  assert.equal(
    calculateSeriesProgress(books, statuses([['1', 'read'], ['2', 'read'], ['3', 'read'], ['4', 'read']]), 5).nextBook?.workId,
    '5',
  );
  assert.equal(
    calculateSeriesProgress(books, statuses([['1', 'read'], ['2', 'read'], ['4', 'read']]), 5).nextBook?.workId,
    '3',
  );
});

test('series completion and progress count only read status', () => {
  const books = [1, 2, 3, 4].map((id) => book(String(id)));
  const progress = calculateSeriesProgress(books, statuses([
    ['1', 'read'], ['2', 'read'], ['3', 'read'], ['4', 'read'],
  ]), 4);
  assert.equal(progress.complete, true);
  assert.equal(progress.catalogComplete, true);
  assert.equal(progress.nextBook, null);
  assert.deepEqual(calculateCollectionProgress(books, statuses([
    ['1', 'read'], ['2', 'dnf'], ['3', 'reading'], ['4', 'want_to_read'],
  ])), { read: 1, cataloguedTotal: 4, total: 4, percentage: 25 });
});

test('a rating implies completed progress without an explicit status row', () => {
  const books = [1, 2, 3].map((id) => book(String(id)));
  const progress = calculateSeriesProgress(
    books,
    new Map(),
    3,
    new Set(['1', '2']),
  );
  assert.equal(progress.read, 2);
  assert.equal(progress.percentage, 67);
  assert.equal(progress.nextBook?.workId, '3');
  assert.equal(progress.complete, false);
});

test('a currently-reading book is continued before a lower unread position', () => {
  const books = [1, 2, 3, 4].map((id) => book(String(id)));
  const progress = calculateSeriesProgress(books, statuses([
    ['1', 'read'], ['2', 'want_to_read'], ['3', 'reading'], ['4', 'dnf'],
  ]), 4);
  assert.equal(progress.read, 1);
  assert.equal(progress.nextBook?.workId, '2');
  assert.equal(progress.continueBook?.workId, '3');
  assert.equal(progress.actionBook?.workId, '3');
});

test('missing sequence data never creates a guessed next book', () => {
  const books = [book('1'), { ...book('3'), sequenceNumber: 3 }];
  const progress = calculateSeriesProgress(books, statuses([['1', 'read']]), 4);
  assert.equal(progress.sequenceComplete, false);
  assert.equal(progress.nextBook, null);
  assert.equal(progress.total, 4);
  assert.equal(progress.complete, false);
});

test('known full length remains the denominator for an incomplete catalog', () => {
  const books = [1, 2, 3, 4].map((id) => book(String(id)));
  const progress = calculateSeriesProgress(books, statuses([
    ['1', 'read'], ['2', 'read'], ['3', 'read'], ['4', 'read'],
  ]), 6);
  assert.equal(progress.cataloguedTotal, 4);
  assert.equal(progress.total, 6);
  assert.equal(progress.percentage, 67);
  assert.equal(progress.catalogComplete, false);
  assert.equal(progress.complete, false);
});

test('a numbered position above the stored row count still uses the reviewed total', () => {
  const books = [book('1'), { ...book('3'), sequenceNumber: 3 }, { ...book('4'), sequenceNumber: 4 }];
  const progress = calculateSeriesProgress(books, new Map(), 5);
  assert.equal(progress.cataloguedTotal, 3);
  assert.equal(progress.total, 5);
  assert.equal(canShowSeriesDenominator(4, progress.total), true);
});

test('unknown or contradicted expected totals never invent a denominator', () => {
  const books = [book('1'), book('2'), book('3')];
  const unknown = calculateSeriesProgress(books, statuses([['1', 'read']]), null);
  assert.equal(unknown.total, null);
  assert.equal(unknown.percentage, null);
  assert.equal(unknown.complete, false);
  assert.equal(canShowProgressDenominator(unknown.total), false);

  const contradicted = calculateSeriesProgress(
    [...books, { ...book('4'), sequenceNumber: 4 }],
    new Map(),
    3,
  );
  assert.equal(contradicted.total, null);
  assert.equal(canShowSeriesDenominator(4, contradicted.total), false);
});

test('author collection selection uses real ratings then deterministic publication/title order', () => {
  const rated = [book('1', 7.4, 2020), book('2', 8.8, 2024), book('3', null, 2010)];
  assert.equal(selectHighestRatedUnread(rated, new Map())?.workId, '2');
  const unrated = [book('2', null, 2024), book('1', null, 2010)];
  assert.equal(selectHighestRatedUnread(unrated, new Map())?.workId, '1');
});

test('homepage continuation requires meaningful contiguous progress and is deterministic', () => {
  const make = (name: string, read: string[]) => {
    const books = [book('1'), book('2'), book('3')];
    return {
      collection: {
        id: name,
        slug: name,
        name,
        collectionType: 'series' as const,
        description: null,
        expectedMainSeriesTotal: 3,
      },
      progress: calculateSeriesProgress(books, statuses(read.map((id) => [id, 'read'])), 3),
    };
  };
  assert.equal(selectSeriesContinuation([make('B', ['2']), make('A', ['1'])])?.collection.name, 'A');
  assert.equal(selectSeriesContinuation([make('B', ['1']), make('A', ['1'])])?.collection.name, 'A');
  assert.equal(selectSeriesContinuation([make('A', ['1', '2', '3'])]), null);
});

test('continuation ranking prefers reading, then partial progress, then reliable recency', () => {
  const make = (
    name: string,
    entries: Array<[string, ReadingStatus]>,
    lastInteractedAt: string | null,
  ) => {
    const books = [1, 2, 3].map((id) => ({
      ...book(`${name}-${id}`),
      sequenceNumber: id,
    }));
    return {
      collection: {
        id: name,
        slug: name.toLowerCase(),
        name,
        collectionType: 'series' as const,
        description: null,
        expectedMainSeriesTotal: 3,
      },
      progress: calculateSeriesProgress(books, statuses(entries), 3),
      touched: entries.length > 0,
      lastInteractedAt,
    };
  };

  const ranked = selectSeriesContinuations([
    make('Want recent', [['Want recent-1', 'want_to_read']], '2026-09-18T12:00:00Z'),
    make('Partial older', [['Partial older-1', 'read']], '2026-09-16T12:00:00Z'),
    make('Reading', [['Reading-3', 'reading']], '2026-09-15T12:00:00Z'),
    make('Partial newer', [['Partial newer-1', 'read']], '2026-09-17T12:00:00Z'),
    make('Untouched', [], null),
  ], 3);

  assert.equal(ranked.length, 3);
  assert.deepEqual(ranked.map(({ collection }) => collection.name), [
    'Reading',
    'Partial newer',
    'Partial older',
  ]);
});

test('deterministic fallback uses collection name when activity is unavailable', () => {
  const books = [1, 2].map((id) => book(String(id)));
  const candidate = (name: string) => ({
    collection: {
      id: name,
      slug: name.toLowerCase(),
      name,
      collectionType: 'series' as const,
      description: null,
      expectedMainSeriesTotal: 2,
    },
    progress: calculateSeriesProgress(books, statuses([['1', 'want_to_read']]), 2),
    touched: true,
    lastInteractedAt: null,
  });
  assert.deepEqual(
    selectSeriesContinuations([candidate('Beta'), candidate('Alpha')])
      .map(({ collection }) => collection.name),
    ['Alpha', 'Beta'],
  );
});

test('one rated work contributes independently to every series it belongs to', () => {
  const shared = book('42');
  const first = calculateSeriesProgress(
    [{ ...shared, sequenceNumber: 1 }, { ...book('43'), sequenceNumber: 2 }],
    new Map(),
    2,
    new Set(['42']),
  );
  const second = calculateSeriesProgress(
    [{ ...shared, sequenceNumber: 1 }, { ...book('44'), sequenceNumber: 2 }],
    new Map(),
    2,
    new Set(['42']),
  );
  assert.equal(first.read, 1);
  assert.equal(second.read, 1);
});
