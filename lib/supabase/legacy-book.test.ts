import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { loadLegacyBook } from './legacy-book.ts';

const edition = (language: string, id = 1) => ({
  id, work_id: 42, title: 'Verified book', language, isbn_10: null, isbn_13: null,
  open_library_edition_id: null, publisher: null,
});
const work = (editions: unknown) => ({ id: 42, title: 'Verified book', editions });
const client = (fetch: typeof globalThis.fetch) => createClient('https://example.invalid', 'fixture', {
  auth: { persistSession: false, autoRefreshToken: false }, global: { fetch },
});

test('loads both locales from one public Work query with the explicit edition relationship', async () => {
  const urls: URL[] = [];
  const supabase = client(async input => {
    urls.push(new URL(String(input)));
    return Response.json([work([edition('nld'), edition('eng', 2)])]);
  });
  assert.deepEqual(await loadLegacyBook(supabase, '42'), { title: 'Verified book', locales: ['en', 'nl'] });
  assert.equal(urls.length, 1);
  assert.equal(urls[0].pathname, '/rest/v1/works');
  assert.equal(urls[0].searchParams.get('id'), 'eq.42');
  assert.match(urls[0].searchParams.get('select') ?? '', /editions!editions_work_id_fkey\(/);
  assert.equal(urls[0].searchParams.get('editions.limit'), '1000');
});

test('a missing Work is distinct from a Work with no editions or a rejected response', async () => {
  assert.equal(await loadLegacyBook(client(async () => Response.json([])), '42'), null);
  assert.deepEqual(await loadLegacyBook(client(async () => Response.json([work([])])), '42'),
    { title: 'Verified book', locales: [] });
  await assert.rejects(loadLegacyBook(client(async () => Response.json([work(null)])), '42'));
  await assert.rejects(loadLegacyBook(client(async () => Response.json({ message: 'Unavailable' }, { status: 500 })), '42'));
});

test('a capped embedded page triggers the existing complete edition read before choosing a locale', async () => {
  const urls: URL[] = [];
  const supabase = client(async input => {
    const url = new URL(String(input));
    urls.push(url);
    const nl = Array.from({ length: 1000 }, (_, i) => edition('nld', i + 1));
    if (url.pathname.endsWith('/works')) return Response.json([work(nl)]);
    if (url.searchParams.get('offset') === '1000') return Response.json([edition('eng', 1001)]);
    return Response.json(nl);
  });
  assert.deepEqual((await loadLegacyBook(supabase, '42'))?.locales, ['en', 'nl']);
  assert.deepEqual(urls.map(url => url.pathname), ['/rest/v1/works', '/rest/v1/editions', '/rest/v1/editions']);
});
