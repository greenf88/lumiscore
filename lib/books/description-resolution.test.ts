import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  clearBookDescriptionCacheForTests,
  resolveBookDescription,
} from './description-resolution.ts';
import {
  normalizeBookDescription,
  normalizeVerifiedBookDescription,
  splitBookDescriptionParagraphs,
} from './description-text.ts';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

test('normalizes Open Library string and object descriptions without keeping HTML', () => {
  assert.equal(
    normalizeBookDescription({ value: '<p>First&nbsp;paragraph.</p><p>Second paragraph.</p>' }),
    'First paragraph.\n\nSecond paragraph.',
  );
  assert.equal(normalizeBookDescription(' Plain text. '), 'Plain text.');
});

test('removes unsafe and layout-breaking markup while retaining all readable text', () => {
  const normalized = normalizeBookDescription(
    '<script>alert(1)</script><p>Hello <strong>reader</strong>.</p>' +
      '<iframe>bad</iframe><div>Next &amp; final paragraph.</div>',
  );
  assert.equal(normalized, 'Hello reader.\n\nNext & final paragraph.');
  assert.equal(normalized?.includes('alert'), false);
  assert.equal(normalized?.includes('<'), false);
});

test('normalizes empty trusted-source payloads to no description', () => {
  const metadata = {
    source: 'google_books',
    sourceKey: '9789048854943',
    verifiedAt: '2026-09-13T00:00:00.000Z',
  } as const;

  assert.equal(
    normalizeVerifiedBookDescription({ ...metadata, text: '' }),
    null,
  );
  assert.equal(
    normalizeVerifiedBookDescription({ ...metadata, text: ' \n\t ' }),
    null,
  );
  assert.equal(
    normalizeVerifiedBookDescription({
      ...metadata,
      text: '<p>&nbsp;</p><script>not readable</script>',
    }),
    null,
  );
});

test('uses only the exact Open Library work and keeps it ahead of Google Books', async () => {
  clearBookDescriptionCacheForTests();
  const requestedUrls: string[] = [];
  const resolution = await resolveBookDescription(
    { openLibraryWorkId: 'OL893415W', isbn13: '9780441172719' },
    async (input) => {
      requestedUrls.push(String(input));
      return jsonResponse({ description: { value: 'Exact work description.' } });
    },
  );

  assert.equal(resolution.description?.source, 'open_library');
  assert.equal(resolution.description?.sourceKey, 'OL893415W');
  assert.equal(resolution.description?.text, 'Exact work description.');
  assert.equal(requestedUrls.length, 1);
  assert.match(requestedUrls[0], /\/works\/OL893415W\.json$/);
});

test('accepts a Google Books description only for an exact valid ISBN-13', async () => {
  clearBookDescriptionCacheForTests();
  const resolution = await resolveBookDescription(
    { openLibraryWorkId: null, isbn13: '9780441172719' },
    async () =>
      jsonResponse({
        items: [
          {
            volumeInfo: {
              language: 'en',
              industryIdentifiers: [
                { type: 'ISBN_13', identifier: '9780441172719' },
              ],
              description: '<p>Verified Google description.</p>',
            },
          },
        ],
      }),
  );

  assert.equal(resolution.state, 'resolved');
  assert.equal(resolution.description?.source, 'google_books');
  assert.equal(resolution.description?.sourceKey, '9780441172719');
  assert.equal(resolution.description?.text, 'Verified Google description.');
});

test('falls back from a missing exact Open Library work description to exact Google ISBN', async () => {
  clearBookDescriptionCacheForTests();
  let calls = 0;
  const resolution = await resolveBookDescription(
    { openLibraryWorkId: 'OL99W', isbn13: '9780441172719' },
    async (input) => {
      calls += 1;
      if (String(input).includes('/works/OL99W.json')) {
        return jsonResponse({});
      }
      return jsonResponse({
        items: [
          {
            volumeInfo: {
              language: 'en',
              industryIdentifiers: [
                { type: 'ISBN_13', identifier: '9780441172719' },
              ],
              description: 'Exact fallback description.',
            },
          },
        ],
      });
    },
  );

  assert.equal(calls, 2);
  assert.equal(resolution.description?.source, 'google_books');
  assert.equal(resolution.description?.text, 'Exact fallback description.');
});

test('rejects Google Books descriptions when the exact ISBN-13 is absent', async () => {
  clearBookDescriptionCacheForTests();
  const resolution = await resolveBookDescription(
    { openLibraryWorkId: null, isbn13: '9780441172719' },
    async () =>
      jsonResponse({
        items: [
          {
            volumeInfo: {
              language: 'en',
              industryIdentifiers: [
                { type: 'ISBN_13', identifier: '9780593099322' },
              ],
              description: 'Wrong edition description.',
            },
          },
        ],
      }),
  );

  assert.equal(resolution.state, 'confirmed_missing');
  assert.equal(resolution.description, null);
});

test('returns no description when an exact match has none', async () => {
  clearBookDescriptionCacheForTests();
  const resolution = await resolveBookDescription(
    { openLibraryWorkId: null, isbn13: '9780441172719' },
    async () =>
      jsonResponse({
        items: [
          {
            volumeInfo: {
              language: 'en',
              industryIdentifiers: [
                { type: 'ISBN_13', identifier: '9780441172719' },
              ],
            },
          },
        ],
      }),
  );

  assert.equal(resolution.state, 'confirmed_missing');
  assert.equal(resolution.description, null);
});

test('Vogeleiland does not resolve an empty exact-ISBN description', async () => {
  clearBookDescriptionCacheForTests();
  const resolution = await resolveBookDescription(
    { openLibraryWorkId: null, isbn13: '9789048854943' },
    async () =>
      jsonResponse({
        items: [
          {
            volumeInfo: {
              language: 'nl',
              industryIdentifiers: [
                { type: 'ISBN_13', identifier: '9789048854943' },
              ],
              description: '<p>&nbsp;</p>',
            },
          },
        ],
      }),
  );

  assert.equal(resolution.state, 'confirmed_missing');
  assert.equal(resolution.description, null);
});

test('Dutch exact-ISBN description beats an English edition description in NL mode', async () => {
  clearBookDescriptionCacheForTests();
  const requestedUrls: string[] = [];
  const resolution = await resolveBookDescription(
    {
      openLibraryWorkId: 'OL42W',
      openLibraryEditionId: 'OL42M',
      isbn13: '9789048854943',
      editionLanguage: 'nld',
      locale: 'nl',
    },
    async (input) => {
      requestedUrls.push(String(input));
      if (String(input).includes('/books/OL42M.json')) {
        return jsonResponse({
          works: [{ key: '/works/OL42W' }],
          languages: [{ key: '/languages/eng' }],
          description: 'English edition copy must not win.',
        });
      }
      return jsonResponse({
        items: [{
          volumeInfo: {
            language: 'nl',
            industryIdentifiers: [{ type: 'ISBN_13', identifier: '9789048854943' }],
            description: 'Exacte Nederlandse beschrijving.',
          },
        }],
      });
    },
  );

  assert.equal(resolution.description?.source, 'google_books');
  assert.equal(resolution.description?.language, 'nl');
  assert.equal(resolution.description?.text, 'Exacte Nederlandse beschrijving.');
  assert.equal(requestedUrls.length, 2);
});

test('English exact-ISBN description beats Dutch copy in EN mode', async () => {
  clearBookDescriptionCacheForTests();
  const resolution = await resolveBookDescription(
    { isbn13: '9780441172719', editionLanguage: 'eng', locale: 'en' },
    async () => jsonResponse({
      items: [
        {
          volumeInfo: {
            language: 'nl',
            industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780441172719' }],
            description: 'Nederlandse tekst.',
          },
        },
        {
          volumeInfo: {
            language: 'en',
            industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780441172719' }],
            description: 'English description.',
          },
        },
      ],
    }),
  );

  assert.equal(resolution.description?.language, 'en');
  assert.equal(resolution.description?.text, 'English description.');
});

test('wrong-language exact ISBN is not displayed and an edition cannot leak across works', async () => {
  clearBookDescriptionCacheForTests();
  const wrongLanguage = await resolveBookDescription(
    { isbn13: '9789048854943', editionLanguage: 'nld', locale: 'nl' },
    async () => jsonResponse({
      items: [{
        volumeInfo: {
          language: 'en',
          industryIdentifiers: [{ type: 'ISBN_13', identifier: '9789048854943' }],
          description: 'Unrelated English marketing copy.',
        },
      }],
    }),
  );
  assert.equal(wrongLanguage.description, null);

  clearBookDescriptionCacheForTests();
  const crossWork = await resolveBookDescription(
    {
      openLibraryWorkId: 'OL1W',
      openLibraryEditionId: 'OL2M',
      editionLanguage: 'eng',
      locale: 'en',
    },
    async (input) => String(input).includes('/books/')
      ? jsonResponse({
          works: [{ key: '/works/OL999W' }],
          languages: [{ key: '/languages/eng' }],
          description: 'Description from another work.',
        })
      : jsonResponse({}),
  );
  assert.equal(crossWork.description, null);
});

test('an English-only international edition may keep its exact English work description in NL UI', async () => {
  clearBookDescriptionCacheForTests();
  const resolution = await resolveBookDescription(
    {
      openLibraryWorkId: 'OL893415W',
      editionLanguage: 'eng',
      locale: 'nl',
    },
    async () => jsonResponse({ description: 'Exact English work description.' }),
  );

  assert.equal(resolution.description?.language, 'en');
  assert.equal(resolution.description?.text, 'Exact English work description.');
});

test('a bounded alternate edition ISBN of the same stored Work can supply the desired language', async () => {
  clearBookDescriptionCacheForTests();
  const requestedIsbns: string[] = [];
  const resolution = await resolveBookDescription(
    {
      isbn13: '9789048854943',
      editionLanguage: 'nld',
      editionCandidates: [{
        isbn13: '9789044933192',
        editionLanguage: 'nld',
      }],
      locale: 'nl',
    },
    async (input) => {
      const isbn = new URL(String(input)).searchParams.get('q')?.replace('isbn:', '') ?? '';
      requestedIsbns.push(isbn);
      return jsonResponse({
        items: [{
          volumeInfo: {
            language: 'nl',
            industryIdentifiers: [{ type: 'ISBN_13', identifier: isbn }],
            description: isbn === '9789044933192'
              ? 'Nederlandse beschrijving van een andere geverifieerde editie.'
              : undefined,
          },
        }],
      });
    },
  );

  assert.deepEqual(requestedIsbns, ['9789048854943', '9789044933192']);
  assert.equal(resolution.description?.language, 'nl');
  assert.equal(
    resolution.description?.text,
    'Nederlandse beschrijving van een andere geverifieerde editie.',
  );
});

test('deduplicates and caches repeated source requests in the server process', async () => {
  clearBookDescriptionCacheForTests();
  let calls = 0;
  const fetchImplementation = async () => {
    calls += 1;
    return jsonResponse({ description: 'Cached description.' });
  };

  const lookup = { openLibraryWorkId: 'OL42W', isbn13: null };
  const [first, second] = await Promise.all([
    resolveBookDescription(lookup, fetchImplementation),
    resolveBookDescription(lookup, fetchImplementation),
  ]);
  const third = await resolveBookDescription(lookup, fetchImplementation);

  assert.equal(first.description?.text, 'Cached description.');
  assert.equal(second.description?.text, 'Cached description.');
  assert.equal(third.description?.text, 'Cached description.');
  assert.equal(calls, 1);
});

test('temporary source failures expire instead of becoming permanent missing results', async (t) => {
  clearBookDescriptionCacheForTests();
  let now = 1_000;
  t.mock.method(Date, 'now', () => now);
  let calls = 0;
  const fetchImplementation = async () => {
    calls += 1;
    return calls <= 3
      ? jsonResponse({ error: 'temporary upstream failure' }, 503)
      : jsonResponse({ description: 'Recovered exact Work description.' });
  };
  const lookup = { openLibraryWorkId: 'OL4242W', isbn13: null };

  const first = await resolveBookDescription(lookup, fetchImplementation);
  const cachedTemporary = await resolveBookDescription(lookup, fetchImplementation);
  assert.equal(first.state, 'temporary_failure');
  assert.equal(cachedTemporary.state, 'temporary_failure');
  assert.equal(calls, 3);

  now += 2 * 60 * 1_000 + 1;
  const recovered = await resolveBookDescription(lookup, fetchImplementation);
  assert.equal(recovered.state, 'resolved');
  assert.equal(recovered.description?.text, 'Recovered exact Work description.');
  assert.equal(calls, 4);
});

test('splits long text for disclosure without dropping or rewriting its words', () => {
  const text = `${'A sentence with useful detail. '.repeat(25)}\n\nFinal paragraph.`.trim();
  const paragraphs = splitBookDescriptionParagraphs(text, 180);
  assert.equal(paragraphs.length > 3, true);
  assert.equal(paragraphs.join(' ').replace(/\s+/g, ' ').trim(), text.replace(/\s+/g, ' ').trim());
});

test('splits a long unpunctuated paragraph so the disclosure always reveals content', () => {
  const text = 'word '.repeat(250).trim();
  const paragraphs = splitBookDescriptionParagraphs(text, 160);
  assert.equal(paragraphs.length > 2, true);
  assert.equal(paragraphs.join(' '), text);
});

test('book detail description requests and resolves the active locale without an empty fallback section', async () => {
  const [component, route] = await Promise.all([
    readFile(new URL('../../app/components/LumiScoreBookDescription.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../app/api/books/[workId]/description/route.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(component, /description\?locale=\$\{encodeURIComponent\(locale\)\}/);
  assert.match(component, /if \(!description\) return null/);
  assert.doesNotMatch(component, /No description available|Nog geen beschrijving/);
  assert.match(route, /isLocale\(requestedLocale\)/);
  assert.match(route, /loadCatalogBook\(workId, locale\)/);
  assert.match(route, /openLibraryEditionId: book\.openLibraryEditionId/);
  assert.match(route, /editionLanguage: book\.editionLanguage/);
});
