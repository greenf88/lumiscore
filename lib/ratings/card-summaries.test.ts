import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '@/app/data/books';
import {
  applyRatingSummaries,
  formatPublicRatingDisplay,
  normalizeRatingWorkIds,
  ratingSummaryMap,
} from './card-summaries.ts';

function book(workId: string, source: Book['source'] = 'supabase'): Book {
  return {
    id: `work-${workId}`,
    source,
    workId,
    title: `Book ${workId}`,
    author: 'Author',
    score: source === 'demo' ? 8.4 : null,
    ratingsCount: source === 'demo' ? 12 : null,
    match: null,
    cover: 'orbit',
  };
}

test('normalizes and deduplicates work IDs for one bounded batch request', () => {
  assert.deepEqual(normalizeRatingWorkIds(['8', '8', '1265', 'nope', '-1']), [8, 1265]);
});

test('hydrates real books with rounded public aggregates', () => {
  const summaries = ratingSummaryMap([
    { work_id: 8, lumiscore: '9.0', rating_count: '1' },
    { work_id: 1265, lumiscore: '7.45', rating_count: '2' },
  ]);
  const hydrated = applyRatingSummaries([book('8'), book('1265')], summaries);

  assert.deepEqual(
    hydrated.map(({ score, ratingsCount }) => ({ score, ratingsCount })),
    [
      { score: 9, ratingsCount: 1 },
      { score: 7.5, ratingsCount: 2 },
    ],
  );
});

test('keeps unrated real books neutral and preserves demo data', () => {
  const demo = book('demo', 'demo');
  const [unrated, unchangedDemo] = applyRatingSummaries(
    [book('99'), demo],
    ratingSummaryMap([{ work_id: 99, lumiscore: null, rating_count: 0 }]),
  );

  assert.equal(unrated.score, null);
  assert.equal(unrated.ratingsCount, 0);
  assert.equal(unchangedDemo, demo);
});

test('formats rated and unrated card states consistently', () => {
  assert.deepEqual(formatPublicRatingDisplay(8, 1), {
    score: '8.0',
    count: '1 rating',
  });
  assert.deepEqual(formatPublicRatingDisplay(null, 0), {
    score: '—',
    count: 'Not rated yet',
  });
});

test('uses internal works.id equally for Open Library and native works', () => {
  const summaries = ratingSummaryMap([
    { work_id: 8, lumiscore: 9, rating_count: 1 },
    { work_id: 1265, lumiscore: 7, rating_count: 1 },
  ]);
  const [openLibrary, native] = applyRatingSummaries(
    [
      { ...book('8'), sourceType: 'open_library', openLibraryWorkId: 'OL893415W' },
      { ...book('1265'), sourceType: 'lumiscore_native', openLibraryWorkId: null },
    ],
    summaries,
  );

  assert.equal(openLibrary.score, 9);
  assert.equal(native.score, 7);
});
