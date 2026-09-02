import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOpenLibraryCoverCandidates } from './open-library-covers.ts';

test('continues through same-work edition pages before using search fallback', async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(
      typeof input === 'string' || input instanceof URL ? input : input.url,
    );
    requestedUrls.push(url.toString());

    if (url.pathname === '/works/OL123W.json') {
      return Response.json({ covers: [] });
    }

    if (url.pathname === '/works/OL123W/editions.json') {
      const offset = Number(url.searchParams.get('offset'));
      return Response.json(
        offset === 0
          ? { size: 101, entries: Array.from({ length: 100 }, () => ({})) }
          : { size: 101, entries: [{ covers: [7654321], languages: [{ key: '/languages/eng' }] }] },
      );
    }

    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  try {
    const urls = await resolveOpenLibraryCoverCandidates({
      workId: 'OL123W',
      title: 'Test Book',
      author: 'Test Author',
      firstPublishYear: 2000,
    });

    assert.deepEqual(urls, [
      'https://covers.openlibrary.org/b/id/7654321-L.jpg?default=false',
    ]);
    assert.equal(requestedUrls.some((url) => url.includes('offset=100')), true);
    assert.equal(requestedUrls.some((url) => url.includes('/search.json')), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
