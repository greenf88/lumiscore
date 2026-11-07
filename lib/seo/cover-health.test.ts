import assert from 'node:assert/strict';
import test from 'node:test';
import { probeCoverTransport } from './cover-health.ts';

const url = 'https://covers.openlibrary.org/b/id/10580336-L.jpg?default=false';

test('cover monitoring bounds requests and distinguishes image responses from upstream failures', async () => {
  let cancelled = false;
  const result = await probeCoverTransport(url, async (input, init) => {
    assert.equal(input, url);
    assert.deepEqual(init?.headers, { Range: 'bytes=0-31' });
    assert.ok(init?.signal);
    return new Response(new ReadableStream({ cancel() { cancelled = true; } }), {
      headers: { 'Content-Type': 'image/jpeg' },
    });
  });
  assert.deepEqual(result, { state: 'image_response', host: 'covers.openlibrary.org', status: 200 });
  assert.equal(cancelled, true);
  assert.equal((await probeCoverTransport(url, async () => new Response(null, { status: 503 }))).state, 'http_error');
  assert.equal((await probeCoverTransport(url, async () => new Response('not an image'))).state, 'unexpected_content');
  assert.equal((await probeCoverTransport(url, async () => { throw Error('network'); })).state, 'transport_error');
});

test('cover monitoring skips unapproved hosts and credentialed URLs without a network request', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; throw Error('must not fetch'); };
  for (const source of ['http://localhost/image.jpg', 'https://user:secret@covers.openlibrary.org/image.jpg', 'https://example.test/image.jpg']) {
    assert.deepEqual(await probeCoverTransport(source, fetcher), { state: 'not_probed' });
  }
  assert.equal(calls, 0);
});
