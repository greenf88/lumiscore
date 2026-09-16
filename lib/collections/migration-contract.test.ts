import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL(
    '../../supabase/migrations/20260916071439_collections_v1.sql',
    import.meta.url,
  ),
  'utf8',
).toLowerCase();

test('collection schema rejects invalid types and duplicate membership', () => {
  assert.match(migration, /collection_type in \('series', 'universe', 'author_collection'\)/);
  assert.match(migration, /primary key \(collection_id, work_id\)/);
  assert.match(migration, /references public\.collections \(id\) on delete cascade/);
  assert.match(migration, /references public\.works \(id\) on delete cascade/);
});

test('reading status schema rejects invalid status and enforces one row per work', () => {
  assert.match(migration, /status in \('want_to_read', 'reading', 'read', 'dnf'\)/);
  assert.match(migration, /primary key \(user_id, work_id\)/);
  assert.match(migration, /references auth\.users \(id\) on delete cascade/);
});

test('collection metadata is public read-only while status is private per user', () => {
  assert.match(migration, /grant select on table public\.collections to anon, authenticated/);
  assert.match(migration, /grant select on table public\.collection_books to anon, authenticated/);
  assert.doesNotMatch(migration, /grant (insert|update|delete).*public\.collections/);
  for (const operation of ['select', 'insert', 'update', 'delete']) {
    assert.match(
      migration,
      new RegExp(`user_book_status_${operation}_own[\\s\\S]*?for ${operation}[\\s\\S]*?to authenticated`),
    );
  }
  assert.ok((migration.match(/\(select auth\.uid\(\)\) = user_id/g) ?? []).length >= 4);
  assert.match(migration, /alter table public\.user_book_status force row level security/);
});

test('a rating safely implies read without coupling rating deletion to status', () => {
  assert.match(migration, /create function public\.sync_rating_to_read_status\(\)/);
  assert.match(migration, /values \(new\.user_id, new\.work_id, 'read'\)/);
  assert.match(migration, /after insert or update of rating on public\.ratings/);
  assert.doesNotMatch(migration, /after delete[\s\S]*sync_rating_to_read_status/);
});

