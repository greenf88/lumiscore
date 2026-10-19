import test from 'node:test';
import assert from 'node:assert/strict';
import type { Book } from '../../app/data/books.ts';
import { buildTasteCoverHint, parseCoverAnchor, preloadTasteCover, validateTasteCoverHint, type CoverAnchor, type PreloadImage } from './cover-preload.ts';
const anchor: CoverAnchor = { roundId: 'aaaaaaaa-0000-4000-8000-000000000001', fromWorkId: '1', locale: 'en' };
const book: Book = { id: 'work-2', workId: '2', source: 'supabase', title: 'Verified title', author: 'Author', cover: 'orbit',
  score: null, ratingsCount: null, match: null, editionId: '22', editionTitle: 'Verified title', editionLanguage: 'eng',
  editionAvailable: true, strictEditionLanguage: 'en', coverUrls: ['https://covers.openlibrary.org/b/id/123-L.jpg?default=false'] };
test('hint requires exact verified edition identity/language; never fabricates missing covers', () => {
  const hint = buildTasteCoverHint(book, anchor)!;
  assert.equal(hint.src, 'https://covers.openlibrary.org/b/id/123-M.jpg?default=false');
  for (const patch of [{ editionAvailable: false }, { editionId: null }, { strictEditionLanguage: 'nl' as const },
    { editionLanguage: 'deu' }, { editionLanguage: null }, { coverUrls: [] }, { workId: '1' },
    { coverUrls: ['javascript:alert(1)'] }, { coverUrls: ['//evil.example/img.jpg'] }]) assert.equal(buildTasteCoverHint({ ...book, ...patch }, anchor), null);
  const nl = { ...anchor, locale: 'nl' as const };
  assert.equal(buildTasteCoverHint({ ...book, strictEditionLanguage: 'nl' }, nl), null);
  assert.ok(buildTasteCoverHint({ ...book, strictEditionLanguage: 'nl', englishEditionFallback: true }, nl));
  assert.ok(buildTasteCoverHint({ ...book, strictEditionLanguage: 'nl', editionLanguage: 'nld' }, nl));
});
test('anchor parsing and stale round/Work/language hints fail closed', () => {
  assert.deepEqual(parseCoverAnchor(new URLSearchParams({ roundId: anchor.roundId, workId: '1', locale: 'en' })), anchor);
  for (const workId of ['0', '-1', '1e3', '9007199254740992']) assert.equal(parseCoverAnchor(new URLSearchParams({ roundId: anchor.roundId, workId, locale: 'en' })), null);
  const hint = buildTasteCoverHint(book, anchor)!;
  for (const patch of [{ roundId: 'old' }, { fromWorkId: '9' }, { locale: 'nl' }, { workId: '1' }, { src: 'data:image/jpeg,x' }]) assert.equal(validateTasteCoverHint({ ...hint, ...patch }, anchor), null);
});
function adapter(fetcher: typeof fetch) {
  const images: PreloadImage[] = [];
  return { images, fetcher, createImage: () => { const image = { src: '', onload: null, onerror: null, decoding: 'auto', fetchPriority: 'auto' } as PreloadImage; images.push(image); return image; } };
}
test('only a GET hint and one exact M image, no progress/action/write; low priority and no retry', async () => {
  const requests: RequestInit[] = [];
  const deps = adapter((async (url, init) => { assert.match(String(url), /^\/api\/taste-test\/rounds\/cover\?/); requests.push(init!); return Response.json({ cover: buildTasteCoverHint(book, anchor) }); }) as typeof fetch);
  const c = new AbortController(); await preloadTasteCover(anchor, c.signal, deps);
  assert.equal(requests.length, 1); assert.equal(requests[0].method, undefined); assert.equal(requests[0].cache, 'no-store'); assert.equal(requests[0].body, undefined);
  assert.equal(deps.images.length, 1); assert.match(deps.images[0].src, /123-M\.jpg/); assert.equal(deps.images[0].fetchPriority, 'low');
  deps.images[0].onerror?.(new Event('error')); assert.equal(deps.images.length, 1); assert.equal(deps.images[0].onerror, null);
});
test('slow response after language/Work/pause cleanup cannot start image or affect round', async () => {
  let resolve!: (r: Response) => void;
  const deps = adapter((() => new Promise<Response>(r => { resolve = r; })) as typeof fetch);
  const c = new AbortController(), task = preloadTasteCover(anchor, c.signal, deps); c.abort();
  resolve(Response.json({ cover: buildTasteCoverHint(book, anchor) })); await task; assert.equal(deps.images.length, 0);
});
test('native fetch adapter is called without an invalid object receiver', async () => {
  const deps = adapter((async function (this: unknown) {
    assert.equal(this, undefined);
    return Response.json({ cover: buildTasteCoverHint(book, anchor) });
  }) as typeof fetch);
  await preloadTasteCover(anchor, new AbortController().signal, deps); assert.equal(deps.images.length, 1);
});
test('missing RPC, network failure, absent cover and wrong locale are silent and do not retry', async () => {
  for (const response of [Response.json({ cover: null }), Response.json({}, { status: 503 }), Response.json({ cover: { ...buildTasteCoverHint(book, anchor), locale: 'nl' } })]) {
    let count = 0; const deps = adapter((async () => { count++; return response; }) as typeof fetch);
    await preloadTasteCover(anchor, new AbortController().signal, deps); assert.equal(count, 1); assert.equal(deps.images.length, 0);
  }
  const deps = adapter((async () => { throw Error('offline'); }) as typeof fetch);
  await preloadTasteCover(anchor, new AbortController().signal, deps); assert.equal(deps.images.length, 0);
});
