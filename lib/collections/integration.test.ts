import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const status = read('../supabase/book-status.ts');
const collections = read('../supabase/collections.ts');
const detail = read('../../app/components/LumiScoreBookDetail.tsx');
const detailPage = read('../../app/book/[workId]/page.tsx');
const home = read('../../app/components/LumiScoreHome.tsx');
const personalization = read('../supabase/taste-test.ts');

test('status persistence supports read without a rating and want-to-read independently', () => {
  assert.match(status, /from\('user_book_status'\)\.upsert/);
  assert.match(status, /status,/);
  assert.doesNotMatch(status, /from\('ratings'\)/);
  assert.match(status, /status: 'want_to_read' as const/);
});

test('rating submission visibly changes the independent status to Read', () => {
  assert.match(detail, /setReadingStatus\('read'\)/);
  assert.match(detail, /removeRating/);
  assert.doesNotMatch(detail, /removeRating[\s\S]{0,500}setReadingStatus\(null\)/);
});

test('guest Want to Read values migrate without overwriting existing account state', () => {
  const hook = read('../../app/components/useWantToRead.ts');
  assert.match(hook, /method: 'POST'/);
  assert.match(status, /existingIds/);
  assert.match(status, /missing = ids\.filter/);
  assert.match(status, /status: 'want_to_read' as const/);
});

test('book detail uses real collection membership and a plain collection link', () => {
  assert.match(detailPage, /loadBookCollectionContext\(workId\)/);
  assert.match(detail, /collectionContext\.position/);
  assert.match(detail, /href={`\/collection\/\$\{collectionContext\.collection\.slug\}`}/);
  assert.match(detail, /initialReadingStatus/);
  assert.match(detail, /canShowSeriesDenominator/);
  assert.match(detail, /collection\.bookPosition/);
  assert.match(detail, /canShowProgressDenominator/);
});

test('collection pages use reviewed totals and denominator-free fallback copy', () => {
  const page = read('../../app/components/LumiScoreCollectionPage.tsx');
  assert.match(collections, /getReviewedSeriesMetadata/);
  assert.match(collections, /expected_main_series_total/);
  assert.match(collections, /collection\.expectedMainSeriesTotal/);
  assert.match(page, /calculateSeriesProgress\(books, statusMap, collection\.expectedMainSeriesTotal\)/);
  assert.match(page, /collection\.bookPosition/);
  assert.match(page, /collection\.readCount/);
  assert.doesNotMatch(page, /collection\.bookOf'[\s\S]{0,100}books\.length/);
});

test('homepage continuation is derived from ordered series progress and hidden without a result', () => {
  assert.match(collections, /selectSeriesContinuation\(candidates\)/);
  assert.match(collections, /loadReadWorkIdsForCurrentUser/);
  assert.match(home, /seriesContinuation && <ContinueSeries/);
});

test('recommendation loader adds read-without-rating IDs to exclusions only', () => {
  assert.match(personalization, /loadReadWorkIdsForCurrentUser/);
  assert.match(personalization, /excludedWorkIds: new Set\(\[\.\.\.TASTE_TEST_WORK_IDS, \.\.\.readState\.workIds\]\)/);
  assert.doesNotMatch(personalization, /want_to_read|\bdnf\b|\breading\b/);
});

test('collection queries are batched instead of one query per book', () => {
  assert.match(collections, /loadCatalogBooksByIds\(workIds\)/);
  assert.match(collections, /\.in\('work_id', workIds\.map\(Number\)\)/);
  assert.doesNotMatch(collections, /for \([^)]*books[^)]*\)[\s\S]{0,120}await/);
});
