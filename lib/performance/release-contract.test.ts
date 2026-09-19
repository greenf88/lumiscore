import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path: string) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('Vercel compute is configured for the Dublin data region', async () => {
  const config = JSON.parse(await source('../../vercel.json')) as {
    regions?: string[];
  };
  assert.deepEqual(config.regions, ['dub1']);
});

test('public catalog APIs bypass session refresh and use shared cache headers', async () => {
  const [proxy, books, search, covers] = await Promise.all([
    source('../../proxy.ts'),
    source('../../app/api/catalog/books/route.ts'),
    source('../../app/api/catalog/search/route.ts'),
    source('../../app/api/open-library/covers/route.ts'),
  ]);
  assert.match(proxy, /api\/catalog\/\(\?:books\|search\)/);
  assert.match(proxy, /api\/open-library\/covers/);
  for (const route of [books, search, covers]) {
    assert.match(route, /Cache-Control/);
    assert.match(route, /['"]public,/);
  }
});

test('catalog foreign keys receive idempotent indexes without index deletion', async () => {
  const migration = await source(
    '../../supabase/migrations/20260919113332_add_catalog_foreign_key_indexes.sql',
  );
  assert.match(migration, /create index if not exists editions_work_id_idx/i);
  assert.match(migration, /public\.editions \(work_id\)/i);
  assert.match(migration, /create index if not exists works_author_id_idx/i);
  assert.match(migration, /public\.works \(author_id\)/i);
  assert.doesNotMatch(migration, /drop\s+index/i);
});

test('structured timing logs contain no request or user payload fields', async () => {
  const timing = await source('./server-timing.ts');
  assert.match(timing, /server_operation_duration/);
  assert.match(timing, /operation/);
  assert.match(timing, /dataClass/);
  assert.match(timing, /durationMs/);
  assert.doesNotMatch(timing, /userId|email|pathname|searchParams|request\.url/);
});
