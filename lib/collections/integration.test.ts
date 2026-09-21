import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const status = read('../supabase/book-status.ts');
const statusMutations = read('./status-mutations.ts');
const collections = read('../supabase/collections.ts');
const detail = read('../../app/components/LumiScoreBookDetail.tsx');
const detailPage = read('../../app/book/[workId]/page.tsx');
const home = read('../../app/components/LumiScoreHome.tsx');
const homePage = read('../../app/page.tsx');
const collectionPage = read('../../app/components/LumiScoreCollectionPage.tsx');
const statusControl = read('../../app/components/LumiScoreReadingStatus.tsx');
const personalization = read('../supabase/taste-test.ts');

test('status persistence supports read without a rating and want-to-read independently', () => {
  assert.match(status, /from\('user_book_status'\)\.upsert/);
  assert.match(status, /executeStatusMutation/);
  assert.match(status, /from\('ratings'\)/);
  assert.match(statusMutations, /status: 'want_to_read'/);
  assert.match(statusMutations, /status: 'read'/);
});

test('rating submission visibly changes the independent status to Read', () => {
  assert.match(detail, /setReadingStatus\('read'\)/);
  assert.match(detail, /removeRating/);
  assert.doesNotMatch(detail, /removeRating[\s\S]{0,500}setReadingStatus\(null\)/);
});

test('guest Want to Read values migrate without overwriting existing account state', () => {
  const hook = read('../../app/components/useWantToRead.ts');
  assert.match(hook, /method: 'POST'/);
  assert.match(status, /planGuestWantToReadMigration/);
  assert.match(statusMutations, /status: 'want_to_read'/);
});

test('book detail uses real collection membership and a plain collection link', () => {
  assert.match(detailPage, /loadBookCollectionContext\(workId\)/);
  assert.match(detailPage, /loadVerifiedBookCollectionReturnTarget\(requestedWorkId, slug\)/);
  assert.match(detail, /collectionContext\.position/);
  assert.match(detail, /href={`\/collection\/\$\{collectionContext\.collection\.slug\}`}/);
  assert.match(detail, /initialReadingStatus/);
  assert.match(detail, /canShowSeriesDenominator/);
  assert.match(detail, /collection\.bookPosition/);
  assert.match(detail, /canShowProgressDenominator/);
});

test('collection book links carry the selected collection as typed return context', () => {
  assert.match(collectionPage, /bookReturnContext = \{ kind: 'collection', slug: collection\.slug \}/);
  assert.match(collectionPage, /getBookHref\(item\.book, bookReturnContext\)/);
  assert.match(collectionPage, /getBookHref\(actionBook\.book, bookReturnContext\)/);
});

test('collection pages use reviewed totals and denominator-free fallback copy', () => {
  assert.match(collections, /getReviewedSeriesMetadata/);
  assert.match(collections, /expected_main_series_total/);
  assert.match(collections, /collection\.expectedMainSeriesTotal/);
  assert.match(collectionPage, /calculateSeriesProgress\([\s\S]*?collection\.expectedMainSeriesTotal,[\s\S]*?ratedWorkIds/);
  assert.match(collectionPage, /collection\.bookPosition/);
  assert.match(collectionPage, /collection\.readCount/);
  assert.doesNotMatch(collectionPage, /collection\.bookOf'[\s\S]{0,100}books\.length/);
});

test('homepage continuation is private, bounded, and hidden without useful results', () => {
  assert.match(collections, /selectSeriesContinuations\(candidates, Math\.min\(3, limit\)\)/);
  assert.match(collections, /if \(!user\) return \[\]/);
  assert.match(homePage, /loadHomepageSeriesContinuations\(3\)/);
  assert.match(home, /seriesContinuations\.length > 0/);
  assert.match(home, /continuations\.map/);
  assert.match(home, /collection\.continueReading/);
});

test('guest collection view stays public without a misleading personal zero state', () => {
  assert.match(collectionPage, /authenticated \? \(/);
  assert.match(collectionPage, /collection\.signInTrack/);
  assert.doesNotMatch(collectionPage, /!authenticated[\s\S]{0,120}collection-progress/);
});

test('collection status mutation rolls optimistic state back on failure', () => {
  assert.match(statusControl, /const previous = status/);
  assert.match(statusControl, /onStatusChange\(next\)[\s\S]*?fetch\(`/);
  assert.match(statusControl, /if \(!response\.ok\) throw/);
  assert.match(statusControl, /catch \(caught\)[\s\S]*?onStatusChange\(previous\)/);
});

test('private progress queries are explicitly scoped to the verified user', () => {
  assert.match(collections, /from\('user_book_status'\)[\s\S]*?\.eq\('user_id', user\.id\)/);
  assert.match(collections, /from\('ratings'\)[\s\S]*?\.eq\('user_id', user\.id\)/);
  assert.doesNotMatch(collections, /createPrivileged|SUPABASE_SECRET_KEY|service_role/);
});

test('recommendation loader adds read-without-rating IDs to exclusions only', () => {
  assert.match(personalization, /from\('user_book_status'\)[\s\S]*?\.eq\('user_id', user\.id\)/);
  assert.match(personalization, /excludedWorkIds: new Set\(\[[\s\S]*?TASTE_TEST_WORK_IDS[\s\S]*?status === 'read'/);
  const recommendationBlock = personalization.slice(personalization.indexOf('export async function loadHomepagePersonalization'));
  assert.doesNotMatch(recommendationBlock, /status === '(want_to_read|dnf|reading)'/);
});

test('collection queries are batched instead of one query per book', () => {
  assert.match(collections, /loadCatalogBooksByIdsWithStoredCovers\(workIds\)/);
  assert.match(collections, /\.in\('work_id', workIds\.map\(Number\)\)/);
  assert.match(collections, /loadCatalogBooksByIds\(actionWorkIds\)/);
  assert.doesNotMatch(collections, /for \([^)]*books[^)]*\)[\s\S]{0,120}await/);
});
