import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  getOpenLibraryCoverVariantUrl,
  hasOpenLibraryCoverIdentity,
  isUsableCoverImageDimensions,
} from './covers.ts';
import { resolveBookCoverCandidates } from './cover-resolution.ts';
import {
  clearGoogleBooksCoverCacheForTests,
  normalizeVerifiedIsbn13,
  resolveGoogleBooksCover,
  resolveGoogleBooksCoverResult,
  selectVerifiedGoogleBooksCover,
} from './google-books-covers.ts';
import { resolveOpenLibraryCoverCandidates } from './open-library-covers.ts';
import {
  mergeStoredCoverResolution,
  shouldRefreshStoredCover,
  type StoredCoverResolution,
} from '../supabase/cover-resolutions.ts';

test('uses a smaller Open Library image variant without rewriting other hosts', () => {
  assert.equal(
    getOpenLibraryCoverVariantUrl(
      'https://covers.openlibrary.org/b/id/123-L.jpg?default=false',
      'M',
    ),
    'https://covers.openlibrary.org/b/id/123-M.jpg?default=false',
  );
  assert.equal(
    getOpenLibraryCoverVariantUrl('https://example.com/cover-L.jpg', 'M'),
    'https://example.com/cover-L.jpg',
  );
});

test('Vogeleiland does not treat a bare ISBN as a verified Open Library cover', () => {
  assert.equal(
    hasOpenLibraryCoverIdentity({
      workId: null,
      editionIds: [null],
      coverIds: [],
    }),
    false,
  );
  assert.equal(
    hasOpenLibraryCoverIdentity({ workId: 'OL893415W' }),
    true,
  );
});

test('only reveals successfully decoded, non-placeholder cover images', () => {
  assert.equal(isUsableCoverImageDimensions(0, 0), false);
  assert.equal(isUsableCoverImageDimensions(1, 1), false);
  assert.equal(isUsableCoverImageDimensions(640, 960), true);
});

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

test('accepts a full projection response with an exact ISBN-13 and image', () => {
  const response = {
    items: [
      {
        volumeInfo: {
          industryIdentifiers: [
            { type: 'ISBN_13', identifier: '9789400516267' },
          ],
          imageLinks: {
            thumbnail: 'http://books.google.com/books/content?id=small',
            large: 'https://books.google.com/books/content?id=large',
          },
        },
      },
    ],
  };

  assert.equal(normalizeVerifiedIsbn13('978-94-005-1626-7'), '9789400516267');
  assert.equal(
    selectVerifiedGoogleBooksCover(response, '9789400516267'),
    'https://books.google.com/books/content?id=large',
  );
  assert.equal(
    selectVerifiedGoogleBooksCover(response, '9789044933192'),
    null,
  );
  assert.equal(normalizeVerifiedIsbn13('9789400516268'), null);
});

test('rejects an exact ISBN-13 match without an image', () => {
  assert.equal(
    selectVerifiedGoogleBooksCover(
      {
        items: [
          {
            volumeInfo: {
              industryIdentifiers: [
                { type: 'ISBN_13', identifier: '9789400516267' },
              ],
            },
          },
        ],
      },
      '9789400516267',
    ),
    null,
  );
});

test('requests full Google Books metadata and keeps the API key server-side', async () => {
  clearGoogleBooksCoverCacheForTests();
  const previousApiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const testApiKey = 'server-only-test-key';
  const requestedUrls: URL[] = [];
  process.env.GOOGLE_BOOKS_API_KEY = testApiKey;

  try {
    const coverUrl = await resolveGoogleBooksCover(
      '9789044933192',
      (async (input: string | URL | Request) => {
        requestedUrls.push(
          new URL(
            typeof input === 'string' || input instanceof URL
              ? input
              : input.url,
          ),
        );
        return Response.json({
          items: [
            {
              volumeInfo: {
                industryIdentifiers: [
                  { type: 'ISBN_13', identifier: '9789044933192' },
                ],
                imageLinks: {
                  thumbnail:
                    'https://books.google.com/books/content?id=dwaalspoor',
                },
              },
            },
          ],
        });
      }) as typeof fetch,
    );

    assert.equal(requestedUrls.length, 1);
    assert.equal(requestedUrls[0].searchParams.get('projection'), 'full');
    assert.equal(requestedUrls[0].searchParams.get('key'), testApiKey);
    assert.equal(coverUrl?.includes(testApiKey), false);

    const viteConfig = await readFile(
      new URL('../../vite.config.ts', import.meta.url),
      'utf8',
    );
    const clientDefine = viteConfig.slice(
      viteConfig.indexOf('define:'),
      viteConfig.indexOf('css:'),
    );
    assert.match(viteConfig, /vars:\s*\{[\s\S]*GOOGLE_BOOKS_API_KEY:/);
    assert.match(viteConfig, /vars:\s*\{[\s\S]*SUPABASE_SECRET_KEY:/);
    assert.doesNotMatch(clientDefine, /GOOGLE_BOOKS_API_KEY/);
    assert.doesNotMatch(clientDefine, /SUPABASE_SECRET_KEY/);
    assert.match(
      clientDefine,
      /define:\s*\{[\s\S]*NEXT_PUBLIC_SUPABASE_URL/,
      'Vinext must embed client-safe Supabase configuration at build time',
    );
    assert.match(viteConfig, /VERCEL_ENV\s*===\s*'production'/);
    assert.match(
      viteConfig,
      /Production cannot be built with the demo fallback/,
    );
    const serverEnvironment = await readFile(
      new URL('../server-environment.ts', import.meta.url),
      'utf8',
    );
    assert.doesNotMatch(serverEnvironment, /Reflect\.get/);
    assert.match(
      serverEnvironment,
      /process\.env\.NEXT_PUBLIC_SUPABASE_URL/,
    );
    assert.match(serverEnvironment, /process\.env\.SUPABASE_SECRET_KEY/);
    assert.match(serverEnvironment, /process\.env\.GOOGLE_BOOKS_API_KEY/);
  } finally {
    if (previousApiKey === undefined) {
      delete process.env.GOOGLE_BOOKS_API_KEY;
    } else {
      process.env.GOOGLE_BOOKS_API_KEY = previousApiKey;
    }
  }
});

test('retries a temporary Google Books 503 response', async () => {
  clearGoogleBooksCoverCacheForTests();
  let requestCount = 0;

  const coverUrl = await resolveGoogleBooksCover(
    '9789044970777',
    (async () => {
      requestCount += 1;
      if (requestCount === 1) {
        return Response.json(
          {
            error: {
              code: 503,
              message: 'Service temporarily unavailable.',
              errors: [{ reason: 'backendFailed' }],
            },
          },
          { status: 503 },
        );
      }

      return Response.json({
        items: [
          {
            volumeInfo: {
              industryIdentifiers: [
                { type: 'ISBN_13', identifier: '9789044970777' },
              ],
              imageLinks: {
                thumbnail:
                  'https://books.google.com/books/content?id=scheiding',
              },
            },
          },
        ],
      });
    }) as typeof fetch,
  );

  assert.equal(requestCount, 2);
  assert.equal(
    coverUrl,
    'https://books.google.com/books/content?id=scheiding',
  );
});

test('classifies Google throttling as temporary rather than missing', async () => {
  clearGoogleBooksCoverCacheForTests();
  const result = await resolveGoogleBooksCoverResult(
    '9789044970777',
    (async () => new Response(null, { status: 429 })) as typeof fetch,
  );

  assert.equal(result.state, 'temporary_failure');
  assert.equal(result.coverUrl, null);
});

test('retains a last-known-good cover across temporary failures', () => {
  const existing: StoredCoverResolution = {
    workId: '1303',
    source: 'google_books',
    sourceKey: '9789044970777',
    state: 'resolved',
    coverUrl: 'https://books.google.com/books/content?id=scheiding',
    verifiedAt: '2026-09-01T00:00:00.000Z',
    checkedAt: '2026-09-01T00:00:00.000Z',
    retryAfter: null,
  };
  const now = new Date('2026-09-11T12:00:00.000Z');
  const merged = mergeStoredCoverResolution(
    '1303',
    existing,
    {
      source: 'google_books',
      sourceKey: '9789044970777',
      state: 'temporary_failure',
      coverUrl: null,
    },
    now,
  );

  assert.equal(merged.state, 'temporary_failure');
  assert.equal(merged.coverUrl, existing.coverUrl);
  assert.equal(merged.verifiedAt, existing.verifiedAt);
  assert.equal(
    shouldRefreshStoredCover(
      merged,
      merged.sourceKey,
      now.getTime() + 4 * 60 * 1_000,
    ),
    false,
  );
  assert.equal(
    shouldRefreshStoredCover(
      merged,
      merged.sourceKey,
      now.getTime() + 6 * 60 * 1_000,
    ),
    true,
  );
});

test('does not reuse a cached cover for a different source key', () => {
  const existing: StoredCoverResolution = {
    workId: '1303',
    source: 'google_books',
    sourceKey: '9789044970777',
    state: 'resolved',
    coverUrl: 'https://books.google.com/books/content?id=scheiding',
    verifiedAt: '2026-09-01T00:00:00.000Z',
    checkedAt: '2026-09-01T00:00:00.000Z',
    retryAfter: null,
  };
  const merged = mergeStoredCoverResolution(
    '1303',
    existing,
    {
      source: 'google_books',
      sourceKey: '9789044933192',
      state: 'temporary_failure',
      coverUrl: null,
    },
  );

  assert.equal(merged.coverUrl, null);
  assert.equal(merged.verifiedAt, null);
});

test('deduplicates simultaneous Google Books lookups and caches success', async () => {
  clearGoogleBooksCoverCacheForTests();
  let requestCount = 0;
  const fetchImplementation = (async () => {
    requestCount += 1;
    return Response.json({
      items: [
        {
          volumeInfo: {
            industryIdentifiers: [
              { type: 'ISBN_13', identifier: '9789044933192' },
            ],
            imageLinks: {
              medium: 'https://books.google.com/books/content?id=dwaalspoor',
            },
          },
        },
      ],
    });
  }) as typeof fetch;

  const [first, second] = await Promise.all([
    resolveGoogleBooksCover('9789044933192', fetchImplementation),
    resolveGoogleBooksCover('9789044933192', fetchImplementation),
  ]);

  assert.equal(first, 'https://books.google.com/books/content?id=dwaalspoor');
  assert.equal(second, first);
  assert.equal(requestCount, 1);
});

test('caches failed Google Books lookups', async () => {
  clearGoogleBooksCoverCacheForTests();
  let requestCount = 0;
  const fetchImplementation = (async () => {
    requestCount += 1;
    return Response.json({ totalItems: 0, items: [] });
  }) as typeof fetch;

  assert.equal(
    await resolveGoogleBooksCover('9789044970814', fetchImplementation),
    null,
  );
  assert.equal(
    await resolveGoogleBooksCover('9789044970814', fetchImplementation),
    null,
  );
  assert.equal(requestCount, 1);
});

test('keeps Open Library first while adding a verified Google fallback', async () => {
  clearGoogleBooksCoverCacheForTests();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(
      typeof input === 'string' || input instanceof URL ? input : input.url,
    );
    if (url.hostname === 'openlibrary.org' && url.pathname === '/works/OL456W.json') {
      return Response.json({ covers: [123456] });
    }
    if (
      url.hostname === 'openlibrary.org' &&
      url.pathname === '/works/OL456W/editions.json'
    ) {
      return Response.json({ size: 0, entries: [] });
    }
    if (url.hostname === 'www.googleapis.com') {
      return Response.json({
        items: [
          {
            volumeInfo: {
              industryIdentifiers: [
                { type: 'ISBN_13', identifier: '9789044970777' },
              ],
              imageLinks: {
                thumbnail:
                  'https://books.google.com/books/content?id=scheiding',
              },
            },
          },
        ],
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  try {
    const urls = await resolveBookCoverCandidates({
      workId: 'OL456W',
      isbn13: '9789044970777',
      title: 'De scheiding',
      author: 'Suzanne Vermeer',
    });
    assert.deepEqual(urls, [
      'https://covers.openlibrary.org/b/id/123456-L.jpg?default=false',
      'https://books.google.com/books/content?id=scheiding',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('native work without an Open Library ID can use Google Books', async () => {
  clearGoogleBooksCoverCacheForTests();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json({
      items: [
        {
          volumeInfo: {
            industryIdentifiers: [
              { type: 'ISBN_13', identifier: '9789400516267' },
            ],
            imageLinks: {
              small: 'https://books.google.com/books/content?id=vallei',
            },
          },
        },
      ],
    })) as typeof fetch;

  try {
    assert.deepEqual(
      await resolveBookCoverCandidates({
        workId: null,
        isbn13: '9789400516267',
        title: 'De vallei',
        author: 'Suzanne Vermeer',
      }),
      ['https://books.google.com/books/content?id=vallei'],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('failed or mismatched fallback leaves the LumiScore placeholder', async () => {
  clearGoogleBooksCoverCacheForTests();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json({
      items: [
        {
          volumeInfo: {
            industryIdentifiers: [
              { type: 'ISBN_13', identifier: '9789400516267' },
            ],
            imageLinks: {
              thumbnail: 'https://books.google.com/books/content?id=wrong',
            },
          },
        },
      ],
    })) as typeof fetch;

  try {
    assert.deepEqual(
      await resolveBookCoverCandidates({
        workId: null,
        isbn13: '9789044970777',
        title: 'De scheiding',
        author: 'Suzanne Vermeer',
      }),
      [],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
