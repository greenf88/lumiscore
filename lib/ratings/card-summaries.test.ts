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
    { work_id: 8, lumiscore: '9.0', rating_count_band: '5–9', evidence_status: 'available' },
    { work_id: 1265, lumiscore: '7.45', rating_count_band: '10–19', evidence_status: 'available' },
  ]);
  const hydrated = applyRatingSummaries([book('8'), book('1265')], summaries);

  assert.deepEqual(
    hydrated.map(({ score, ratingsCount }) => ({ score, ratingsCount })),
    [
      { score: 9, ratingsCount: null },
      { score: 7.5, ratingsCount: null },
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
  assert.equal(unrated.ratingsCount, null);
  assert.equal(unchangedDemo, demo);
});

test('formats rated and unrated card states consistently', () => {
  assert.deepEqual(formatPublicRatingDisplay(8, null, 'en', '5–9'), {
    score: '8.0',
    count: '5–9 raters',
  });
  assert.deepEqual(formatPublicRatingDisplay(null, 0), {
    score: '—',
    count: 'Insufficient ratings',
  });
});

test('accepts the three-rater band, keeps legacy bands and withholds exact counts in NL/EN', () => {
  const summary = ratingSummaryMap([
    { work_id: 8, lumiscore: '8.0', rating_count: 3, rating_count_band: '3–4', evidence_status: 'available' },
  ]).get('8');
  assert.deepEqual(summary, { lumiscore: 8, ratingCount: null, ratingBand: '3–4' });
  assert.deepEqual(formatPublicRatingDisplay(8, 3, 'nl', '3–4'), { score: '8.0', count: '3–4 beoordelaars' });
  assert.deepEqual(formatPublicRatingDisplay(8, 3, 'en', '3–4'), { score: '8.0', count: '3–4 raters' });
  for (const band of ['1–2', '3', 'unknown']) {
    assert.deepEqual(ratingSummaryMap([
      { work_id: 8, lumiscore: 8, rating_count_band: band, evidence_status: 'available' },
    ]).get('8'), { lumiscore: null, ratingCount: null, ratingBand: null });
  }
});

test('legacy counts, malformed evidence and invalid scores fail closed without a zero score', () => {
  for (const row of [
    { work_id: 8, lumiscore: 9, rating_count: 1 },
    { work_id: 8, lumiscore: 9, rating_count_band: '1–4', evidence_status: 'available' },
    { work_id: 8, lumiscore: 9, rating_count_band: '5–9', evidence_status: 'insufficient_evidence' },
    { work_id: 8, lumiscore: 0, rating_count_band: '5–9', evidence_status: 'available' },
  ]) {
    assert.deepEqual(ratingSummaryMap([row]).get('8'), { lumiscore: null, ratingCount: null, ratingBand: null });
  }
  assert.equal(formatPublicRatingDisplay(null, 1, 'nl').score, '—');
});

test('uses internal works.id equally for Open Library and native works', () => {
  const summaries = ratingSummaryMap([
    { work_id: 8, lumiscore: 9, rating_count_band: '5–9', evidence_status: 'available' },
    { work_id: 1265, lumiscore: 7, rating_count_band: '5–9', evidence_status: 'available' },
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
