import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('persistent cover cache stays deny-by-default and server-only', async () => {
  const migration = (await readFile(new URL(
    '../../supabase/migrations/20260911143044_durable_cover_resolution_cache.sql',
    import.meta.url,
  ), 'utf8')).toLowerCase();
  const accessSection = migration.slice(migration.indexOf('alter table'));

  assert.match(accessSection, /enable row level security/);
  assert.match(accessSection, /revoke all on table public\.work_cover_resolutions from anon, authenticated/);
  assert.doesNotMatch(accessSection, /create policy/);
  assert.doesNotMatch(accessSection, /grant (select|insert|update|delete|all)[\s\S]*to (anon|authenticated)/);
});
