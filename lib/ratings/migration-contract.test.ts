import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL(
    '../../supabase/migrations/20260908052221_secure_ratings_foundation.sql',
    import.meta.url,
  ),
  'utf8',
).toLowerCase();
const batchMigration = readFileSync(
  new URL(
    '../../supabase/migrations/20260910062625_add_batch_rating_summaries.sql',
    import.meta.url,
  ),
  'utf8',
).toLowerCase();

test('enforces one valid 1–10 rating per user and work', () => {
  assert.match(migration, /check \(rating between 1 and 10\)/);
  assert.match(migration, /unique \(user_id, work_id\)/);
  assert.match(migration, /user_id uuid not null default auth\.uid\(\)/);
  assert.match(migration, /references auth\.users \(id\) on delete cascade/);
  assert.match(migration, /references public\.works \(id\) on delete cascade/);
});

test('blocks anonymous writes and scopes every user operation to auth.uid()', () => {
  assert.match(migration, /revoke all on table public\.ratings from anon, authenticated/);
  assert.doesNotMatch(migration, /grant .* on table public\.ratings to anon/);
  for (const operation of ['select', 'insert', 'update', 'delete']) {
    assert.match(migration, new RegExp(`for ${operation}[\\s\\S]*?to authenticated`));
  }
  assert.ok((migration.match(/\(select auth\.uid\(\)\) = user_id/g) ?? []).length >= 5);
  assert.match(migration, /new\.user_id is distinct from old\.user_id/);
  assert.match(migration, /new\.work_id is distinct from old\.work_id/);
});

test('exposes only rounded public aggregate data', () => {
  const functionDefinition = migration.slice(
    migration.indexOf('create function public.get_work_rating_summary'),
  );
  const functionBody = functionDefinition
    .slice(functionDefinition.indexOf('as $$') + 'as $$'.length)
    .split('$$;')[0];
  assert.match(migration, /get_work_rating_summary\(target_work_id bigint\)/);
  assert.match(migration, /round\(avg\(rating\)::numeric, 1\)/);
  assert.match(migration, /count\(\*\)::bigint as rating_count/);
  assert.match(migration, /revoke all on function public\.get_work_rating_summary\(bigint\) from public/);
  assert.match(migration, /grant execute on function public\.get_work_rating_summary\(bigint\)[\s\S]*?to anon, authenticated/);
  assert.doesNotMatch(functionDefinition, /select[\s\S]*?user_id/);
  assert.match(functionDefinition, /security definer/);
  assert.match(functionDefinition, /set search_path = ''/);
  assert.doesNotMatch(functionBody, /execute\s+format|execute\s+\w+/);
});

test('exposes the same safe aggregate contract for bounded batch reads', () => {
  const functionBody = batchMigration
    .slice(batchMigration.indexOf('as $$') + 'as $$'.length)
    .split('$$;')[0];
  assert.match(batchMigration, /get_work_rating_summaries\(target_work_ids bigint\[\]\)/);
  assert.match(batchMigration, /round\(avg\(ratings\.rating\)::numeric, 1\)/);
  assert.match(batchMigration, /count\(ratings\.rating\)::bigint as rating_count/);
  assert.match(batchMigration, /limit 100/);
  assert.match(batchMigration, /revoke all on function public\.get_work_rating_summaries\(bigint\[\]\) from public/);
  assert.match(batchMigration, /grant execute on function public\.get_work_rating_summaries\(bigint\[\]\)[\s\S]*?to anon, authenticated/);
  assert.doesNotMatch(batchMigration, /user_id/);
  assert.match(batchMigration, /security definer/);
  assert.match(batchMigration, /set search_path = ''/);
  assert.match(batchMigration, /where requested_work_id > 0/);
  assert.doesNotMatch(functionBody, /execute\s+format|execute\s+\w+/);
});
