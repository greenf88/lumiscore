import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = '5fbd35ed7eafd82ba34c1c45a1fc82e8bc652416';
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8').replaceAll('\r\n','\n').trimEnd();
const previous = path => execFileSync('git', ['show', base + ':' + path], {cwd: root, encoding:'utf8'}).replaceAll('\r\n','\n').trimEnd();
test('split release retains the production rating/round contracts and shared taste calculation byte-for-byte', () => {
  for (const path of ['lib/taste-test/rating-round.ts','lib/taste-test/round-request.ts','lib/taste-test/direct-rating.ts',
    'lib/taste-test/rating-result.ts','lib/recommendations/engine.ts','lib/taste-test/profile.ts',
    'lib/supabase/reader-taste-profile.ts','app/api/ratings/[workId]/route.ts']) {
    assert.equal(read(path), previous(path), path);
  }
  const route = 'app/api/taste-test/rounds/route.ts';
  assert.equal(read(route).split('export async function POST')[1], previous(route).split('export async function POST')[1]);
  const save = text => text.split('export async function saveTasteTestAnswers')[1].split('export async function loadBookDetailPersonalization')[0];
  assert.equal(save(read('lib/supabase/taste-test.ts')), save(previous('lib/supabase/taste-test.ts')));
  for (const path of ['lib/supabase/taste-round-storage.ts','lib/supabase/taste-safety.ts',
    'lib/taste-test/eligibility.ts','lib/recommendations/series-priority.ts','app/api/taste-test/candidates/route.ts']) {
    assert.equal(existsSync(new URL(path,root)), false, path + ' stays outside this release');
  }
});
test('unavailable resumed Work stays skippable; no changed identity or accidental rating', () => {
  const route = read('app/api/taste-test/rounds/route.ts'), ui = read('app/components/RatingTasteTest.tsx');
  assert.ok(route.includes('loadCatalogBook(state.currentWorkId, locale)'));
  assert.ok(ui.includes('pending={pending || book.editionAvailable === false}'));
  assert.ok(ui.includes("act('skip', workId)"));
  assert.ok(!ui.includes('/api/taste-test/candidates'));
  assert.ok(!route.includes('loadTasteEligibility'));
});
