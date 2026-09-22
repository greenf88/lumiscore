import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const route = read('../../app/api/collections/[slug]/statuses/bulk/route.ts');
const service = read('../supabase/collection-statuses.ts');
const statusService = read('../supabase/book-status.ts');
const collectionLoader = read('../supabase/collections.ts');
const page = read('../../app/components/LumiScoreCollectionPage.tsx');
const controls = read('../../app/components/LumiScoreCollectionBookControls.tsx');
const bulk = read('../../app/components/LumiScoreCollectionBulkProgress.tsx');
const css = read('../../app/globals.css');

test('bulk route enforces origin, JSON, size, slug, strict payload and private caching', () => {
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /application\/json/);
  assert.match(route, /MAX_BODY_BYTES = 16_384/);
  assert.match(route, /request\.body\.getReader\(\)/);
  assert.doesNotMatch(route, /request\.text\(\)/);
  assert.match(route, /COLLECTION_SLUG/);
  assert.match(route, /parseBulkStatusPayload/);
  assert.match(route, /PRIVATE_RESPONSE_HEADERS/);
});

test('bulk write is authenticated, membership-scoped and RLS-bound without privileged credentials', () => {
  assert.match(service, /getVerifiedServerUser\(\)/);
  assert.match(service, /from\('collections'\)/);
  assert.match(service, /from\('collection_books'\)/);
  assert.match(service, /CollectionMembershipError/);
  assert.match(service, /\.eq\('user_id', userId\)/);
  assert.doesNotMatch(service, /service_role|SUPABASE_SECRET|createPrivileged/);
  assert.doesNotMatch(route, /service_role|SUPABASE_SECRET|createPrivileged/);
});

test('ratings and statuses preflight in parallel and writes are array-based', () => {
  assert.match(service, /Promise\.all\(\[/);
  assert.match(service, /from\('ratings'\)\.select\('work_id,rating'\)/);
  assert.match(service, /from\('user_book_status'\)\.upsert\([\s\S]*?rows\.map/);
  assert.match(service, /\.delete\(\)[\s\S]*?\.in\('work_id'/);
  assert.doesNotMatch(service, /for \([^)]*workId[^)]*\)[\s\S]{0,160}await client/);
});

test('rated conflicts return 409 with only non-sensitive Work IDs', () => {
  assert.match(route, /RatedWorkStatusConflictError/);
  assert.match(route, /conflictingWorkIds/);
  assert.match(route, /}, 409\)/);
  assert.doesNotMatch(route, /ratingValues|userId|email|token/);
});

test('diagnostic logs are intentionally sanitized', () => {
  assert.match(route, /requestId/);
  assert.match(route, /count/);
  assert.match(route, /durationMs/);
  assert.match(route, /outcome/);
  assert.match(route, /code/);
  const logBlock = route.slice(route.indexOf('function logOutcome'), route.indexOf('export async function POST'));
  assert.doesNotMatch(logBlock, /userId|email|rating|token|workIds|authHeader/);
});

test('collection initial private state remains two batched reads and includes rating values', () => {
  assert.match(collectionLoader, /Promise\.all\(\[/);
  assert.match(collectionLoader, /select\('work_id,status'\)/);
  assert.match(collectionLoader, /select\('work_id,rating'\)/);
  assert.match(collectionLoader, /userRatings/);
});

test('guest migration preserves rated books as Read and reports only a count', () => {
  assert.match(statusService, /planGuestWantToReadMigration/);
  assert.match(statusService, /ratedWorksPreserved/);
  assert.doesNotMatch(statusService, /ratingValues/);
});

test('normal collection controls are compact disclosures with radio semantics and Escape focus return', () => {
  assert.match(page, /LumiScoreCollectionBookControls/);
  assert.match(controls, /aria-expanded/);
  assert.match(controls, /role="radiogroup"/);
  assert.match(controls, /role="radio"/);
  assert.match(controls, /event\.key === 'Escape'/);
  assert.match(controls, /ArrowLeft/);
  assert.match(controls, /\.current\?\.focus\(\)/);
});

test('bulk mode is explicit, status-only, optimistic and reconciliation-aware', () => {
  assert.match(page, /bulkActive/);
  assert.match(page, /type="checkbox"/);
  assert.match(page, /window\.confirm/);
  assert.match(page, /const snapshot = \{ \.\.\.statuses \}/);
  assert.match(page, /payload\.code === 'status_reconciliation_failed'/);
  assert.match(page, /!receivedResponse \|\| ambiguousOutcome/);
  assert.match(page, /payload\.code === 'rated_work_conflict'/);
  assert.match(page, /api\/book-status\?workIds=/);
  assert.doesNotMatch(bulk, /rating-options|onRating|score/);
  assert.match(page, /resolveMissing=\{!bulkActive\}/);
});

test('bulk controls provide live feedback, alerts, sticky safe-area UI and 44px targets', () => {
  assert.match(bulk, /aria-live="polite"/);
  assert.match(bulk, /role="alert"/);
  assert.match(css, /collection-bulk-action-bar[\s\S]*?position: fixed/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /collection-bulk-toggle[\s\S]*?min-height: 44px/);
});

test('bulk mode has an explicit localized exit in its header and fixed action row', () => {
  assert.match(bulk, /active \? t\('collection\.bulkDone'\) : t\('collection\.bulkOpen'\)/);
  assert.match(bulk, /collection-bulk-action-bar[\s\S]*?collection-bulk-done[\s\S]*?collection\.bulkDone/);
  assert.match(css, /collection-bulk-action-bar button \{ min-height: 44px/);
});

test('closing bulk mode clears only transient UI and never mutates stored statuses', () => {
  const closeStart = page.indexOf('const closeBulkMode');
  const closeEnd = page.indexOf('const applyBulkStatus', closeStart);
  const closeBlock = page.slice(closeStart, closeEnd);
  assert.match(closeBlock, /setBulkActive\(false\)/);
  assert.match(closeBlock, /setSelectedWorkIds\(new Set\(\)\)/);
  assert.match(closeBlock, /setBulkMessage\(''\)/);
  assert.match(closeBlock, /setBulkError\(''\)/);
  assert.match(closeBlock, /if \(bulkPending\) return/);
  assert.doesNotMatch(closeBlock, /setStatuses|fetch|DELETE|rollback|location|history/);
});

test('Escape and Done share safe close behavior and restore focus to the opener', () => {
  assert.match(bulk, /event\.key !== 'Escape' \|\| pending/);
  assert.match(bulk, /closeAndRestoreFocus\(\)/);
  assert.match(bulk, /triggerRef\.current\?\.focus\(\)/);
  assert.match(bulk, /disabled=\{active && pending\}/);
  assert.match(bulk, /collection-bulk-done[\s\S]*?disabled=\{pending\}/);
  assert.match(page, /window\.confirm/);
});

test('guest collection rendering keeps controls and personal zero states absent', () => {
  assert.match(page, /\{authenticated && \(/);
  assert.match(page, /authenticated && !bulkActive/);
  assert.match(page, /collection\.signInTrack/);
});
