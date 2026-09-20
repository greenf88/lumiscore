import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  DUTCH_BESTSELLER_SNAPSHOT,
  DUTCH_CLASSICS_POOL,
  type ReviewedBestsellerEntry,
  type ReviewedClassicEntry,
} from './dutch-homepage-sources.ts';
import {
  hasSufficientClassicPersonalization,
  isCurrentBestsellerSnapshot,
  selectDutchClassics,
  selectPopularDutchBooks,
} from './dutch-homepage-discovery.ts';

const popularEntries: readonly ReviewedBestsellerEntry[] = [
  { rank: 1, isbn13: '9780000000001', workId: '1', sourceTitle: 'One' },
  { rank: 2, isbn13: '9780000000002', workId: '2', sourceTitle: 'Two' },
  { rank: 3, isbn13: '9780000000003', workId: '3', sourceTitle: 'Three' },
  { rank: 4, isbn13: '9780000000004', workId: '4', sourceTitle: 'Four' },
];

function classic(input: Partial<ReviewedClassicEntry> & Pick<ReviewedClassicEntry, 'workId' | 'title' | 'author' | 'editorialPriority'>): ReviewedClassicEntry {
  return {
    firstPublishYear: 1950,
    kind: 'international_dutch_edition',
    dutchEdition: {
      source: 'open_library',
      sourceWorkId: `OL${input.workId}W`,
      sourceEditionId: `OL${input.workId}M`,
      isbn13: null,
    },
    evidenceUrl: 'https://publisher.example/reviewed',
    reviewNote: 'Reviewed editorial classification.',
    reviewStatus: 'approved',
    reviewedAt: '2026-09-20',
    ...input,
  };
}

test('reviewed Bestseller 60 snapshot records the source week and expires after fourteen days', () => {
  assert.equal(DUTCH_BESTSELLER_SNAPSHOT.year, 2026);
  assert.equal(DUTCH_BESTSELLER_SNAPSHOT.week, 38);
  assert.equal(DUTCH_BESTSELLER_SNAPSHOT.sourceName, 'De Bestseller 60');
  assert.equal(isCurrentBestsellerSnapshot(
    DUTCH_BESTSELLER_SNAPSHOT,
    new Date('2026-10-04T00:00:00.000Z'),
  ), true);
  assert.equal(isCurrentBestsellerSnapshot(
    DUTCH_BESTSELLER_SNAPSHOT,
    new Date('2026-10-04T00:00:00.001Z'),
  ), false);
});

test('guest popularity uses official rank and only exact eligible Work identities', () => {
  const eligible = new Set(['1', '2', '4']);
  const selected = selectPopularDutchBooks(popularEntries, eligible, {
    year: 2026,
    week: 38,
  });
  assert.deepEqual(selected.map(({ workId }) => workId), ['1', '2', '4']);
  assert.equal(selected.some(({ workId }) => workId === '3'), false);
});

test('read, rated or DNF exclusions replace a popular Work with the next exact match', () => {
  const selected = selectPopularDutchBooks(
    popularEntries,
    new Set(popularEntries.map(({ workId }) => workId)),
    { excludedWorkIds: new Set(['1']), year: 2026, week: 38 },
  );
  assert.deepEqual(selected.map(({ workId }) => workId), ['2', '3', '4']);
});

test('official popularity rank remains dominant over maximum taste similarity', () => {
  const selected = selectPopularDutchBooks(
    popularEntries,
    new Set(['1', '2', '3', '4']),
    {
      similarityByWorkId: new Map([['1', 0], ['2', 1], ['3', 1], ['4', 1]]),
      year: 2026,
      week: 38,
    },
    4,
  );
  assert.deepEqual(selected.map(({ workId }) => workId), ['1', '2', '3', '4']);
});

test('classics pool is a reviewed registry of thirty unique Works with exact Dutch edition evidence', () => {
  assert.equal(DUTCH_CLASSICS_POOL.length, 30);
  assert.equal(new Set(DUTCH_CLASSICS_POOL.map(({ workId }) => workId)).size, 30);
  assert.ok(DUTCH_CLASSICS_POOL.every((entry) =>
    entry.reviewStatus === 'approved' &&
    entry.reviewNote.length > 20 &&
    entry.evidenceUrl.startsWith('https://') &&
    /^OL\d+W$/.test(entry.dutchEdition.sourceWorkId) &&
    /^OL\d+M$/.test(entry.dutchEdition.sourceEditionId),
  ));
});

test('old publication year alone never enters the classics selection', () => {
  const registry = [classic({ workId: '1', title: 'Reviewed', author: 'A', editorialPriority: 1 })];
  const oldButUnreviewed = { ...registry[0], workId: '2', title: 'Old only', reviewStatus: 'pending' };
  const selected = selectDutchClassics(
    [registry[0], oldButUnreviewed as unknown as ReviewedClassicEntry],
    { year: 2026, week: 38 },
  );
  assert.deepEqual(selected.map(({ workId }) => workId), ['1']);
});

test('classic selection is deterministic and diversifies authors and series', () => {
  const entries = [
    classic({ workId: '1', title: 'A1', author: 'A', editorialPriority: 1, seriesKey: 'same' }),
    classic({ workId: '2', title: 'A2', author: 'A', editorialPriority: 2, seriesKey: 'other' }),
    classic({ workId: '3', title: 'B1', author: 'B', editorialPriority: 3, seriesKey: 'same' }),
    classic({ workId: '4', title: 'C1', author: 'C', editorialPriority: 4 }),
    classic({ workId: '5', title: 'D1', author: 'D', editorialPriority: 5 }),
  ];
  const input = { year: 2026, week: 38 };
  const first = selectDutchClassics(entries, input);
  const second = selectDutchClassics(entries, input);

  assert.deepEqual(first, second);
  assert.equal(first.length, 3);
  assert.equal(new Set(first.map(({ workId }) => workId)).size, 3);
  assert.equal(new Set(first.map(({ author }) => author)).size, 3);
  assert.ok(first.filter(({ seriesKey }) => seriesKey === 'same').length <= 1);
});

test('taste and reading period are bounded nudges and never exclude classic candidates', () => {
  const entries = [
    classic({ workId: '1', title: 'Older', author: 'A', firstPublishYear: 1940, editorialPriority: 1 }),
    classic({ workId: '2', title: 'Newer', author: 'B', firstPublishYear: 1990, editorialPriority: 2 }),
    classic({ workId: '3', title: 'Third', author: 'C', firstPublishYear: 1970, editorialPriority: 3 }),
  ];
  const selected = selectDutchClassics(entries, {
    similarityByWorkId: new Map([['2', 1]]),
    profileConfidence: 'MEDIUM',
    readingPeriods: ['1980_1999'],
    year: 2026,
    week: 38,
  });

  assert.equal(selected[0]?.workId, '2');
  assert.deepEqual(new Set(selected.map(({ workId }) => workId)), new Set(['1', '2', '3']));
  assert.equal(hasSufficientClassicPersonalization({
    profileConfidence: 'MEDIUM',
    similarityByWorkId: new Map([['2', 1]]),
  }), true);
  assert.equal(hasSufficientClassicPersonalization({
    profileConfidence: 'LOW',
    similarityByWorkId: new Map([['2', 1]]),
  }), false);
});

test('homepage discovery stays batched, server-only and does not fetch external sources', async () => {
  const [loader, page, component, styles] = await Promise.all([
    readFile(new URL('../supabase/dutch-homepage-discovery.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../app/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../app/components/LumiScoreHome.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../app/globals.css', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(loader, /\bfetch\s*\(/);
  assert.match(loader, /\.from\('editions'\)[\s\S]*\.in\('isbn_13', isbn13s\)/);
  assert.match(loader, /loadCatalogBooksByIdsWithStoredCovers\(/);
  assert.match(loader, /loadWorkTraitEvidenceBatched\(/);
  assert.match(page, /measureServerOperation\(\s*'homepage\.dutch_discovery',\s*'mixed'/);
  assert.match(component, /detailReturnContext=\{\{ kind: 'home' \}\}/);
  assert.match(styles, /\.dutch-discovery-grid \{ grid-template-columns: repeat\(3/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*\.dutch-discovery-grid \{ grid-template-columns: repeat\(2/);
  assert.doesNotMatch(component, /overflow-x:\s*(auto|scroll)/);
});

test('authenticated profile reads are explicitly user scoped and guests make no profile-table queries', async () => {
  const source = await readFile(new URL('../supabase/taste-test.ts', import.meta.url), 'utf8');
  const contextBlock = source.slice(
    source.indexOf('export const loadHomepageReaderContext'),
    source.indexOf('async function loadRecommendationCatalog'),
  );
  const guestReturn = contextBlock.slice(contextBlock.indexOf('if (!user)'), contextBlock.indexOf('const ['));

  assert.doesNotMatch(guestReturn, /\.from\(/);
  assert.match(contextBlock, /taste_test_responses'[\s\S]*\.eq\('user_id', user\.id\)/);
  assert.match(contextBlock, /ratings'[\s\S]*\.eq\('user_id', user\.id\)/);
  assert.match(contextBlock, /user_book_status'[\s\S]*\.eq\('user_id', user\.id\)/);
  assert.doesNotMatch(contextBlock, /console\.(log|info|debug)/);
});
