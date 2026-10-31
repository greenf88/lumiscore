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
const EN_COPY = 'A young reader discovers that the story of her family is not what she expected. With the help of a friend, she follows the clues through the city while the people around her try to keep their secrets. She must decide who she can trust and what the truth will mean for her future.';
const NL_COPY = 'Een jonge lezer ontdekt dat het verhaal van haar familie anders is dan zij dacht. Met de hulp van een vriend volgt zij de aanwijzingen door de stad, terwijl de mensen om haar heen hun geheimen proberen te bewaren. Zij moet beslissen wie zij kan vertrouwen en wat de waarheid voor haar toekomst betekent.';

test('normalizes Open Library string and object descriptions without keeping HTML', () => {
  assert.equal(
    normalizeBookDescription({ value: '<p>First&nbsp;paragraph.</p><p>Second paragraph.</p>' }),
    'First paragraph.\n\nSecond paragraph.',
  );
  assert.equal(normalizeBookDescription(' Plain text. '), 'Plain text.');
});

test('bibliographic containment links are not synopses, but surrounding story facts are preserved', () => {
  for (const value of [
    'Also contained in:\n\n- [Collected Novellas](https://openlibrary.org/works/OL274508W)',
    { value: 'Included in: [Collected stories](https://example.org/collection)' },
    'Ook opgenomen in:\n* [Verhalen](https://example.org/bundel)\n* [Alle verhalen](https://example.org/alles)',
  ]) assert.equal(normalizeBookDescription(value), null);
  const synopsis = 'A witness returns to investigate a murder. Also contained in: [Collected Novellas](https://example.org/collection)';
  assert.equal(normalizeBookDescription(synopsis), synopsis);
  assert.equal(normalizeBookDescription('A collection of linked stories follows a family through three generations.'), 'A collection of linked stories follows a family through three generations.');
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

test('unlabelled Work descriptions are never assumed English', async () => {
  clearBookDescriptionCacheForTests();
  const requestedUrls: string[] = [];
  const resolution = await resolveBookDescription(
    { openLibraryWorkId: 'OL893415W', isbn13: '9780441172719' },
    async (input) => {
      requestedUrls.push(String(input));
      return jsonResponse({ description: { value: 'Exact work description.' } });
    },
  );

  assert.equal(resolution.description, null);
  assert.equal(requestedUrls.length, 1);
  assert.ok(requestedUrls.every(url=>!url.includes('/works/')));
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
              description: `<p>${EN_COPY}</p>`,
            },
          },
        ],
      }),
  );

  assert.equal(resolution.state, 'resolved');
  assert.equal(resolution.description?.source, 'google_books');
  assert.equal(resolution.description?.sourceKey, '9780441172719');
  assert.equal(resolution.description?.text, EN_COPY);
});

test('an exact ISBN with a contradictory title or author cannot supply another book description',async()=>{
 const lookup={isbn13:'9780441172719',editionTitle:'Dune',author:'Frank Herbert',editionLanguage:'eng',locale:'en' as const};
 const response=(title:string,authors:string[])=>async()=>jsonResponse({items:[{volumeInfo:{title,authors,language:'en',industryIdentifiers:[{type:'ISBN_13',identifier:lookup.isbn13}],description:EN_COPY}}]});
 clearBookDescriptionCacheForTests();
 assert.equal((await resolveBookDescription(lookup,response('Other book',['Frank Herbert']))).description,null);
 clearBookDescriptionCacheForTests();
 assert.equal((await resolveBookDescription(lookup,response('Dune',['Other author']))).description,null);
 clearBookDescriptionCacheForTests();
 assert.equal((await resolveBookDescription(lookup,response('Dune',['Frank Herbert']))).state,'resolved');
 // A previous successful ISBN cache must not override a changed binding.
 assert.equal((await resolveBookDescription({...lookup,author:'Other author'},response('Dune',['Frank Herbert']))).description,null);
});

test('ignores unlabelled Work copy and uses an exact language-labelled Google ISBN', async () => {
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
              description: EN_COPY,
            },
          },
        ],
      });
    },
  );

  assert.equal(calls, 1);
  assert.equal(resolution.description?.source, 'google_books');
  assert.equal(resolution.description?.text, EN_COPY);
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
            description: NL_COPY,
          },
        }],
      });
    },
  );

  assert.equal(resolution.description?.source, 'google_books');
  assert.equal(resolution.description?.language, 'nl');
  assert.equal(resolution.description?.text, NL_COPY);
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
            description: EN_COPY,
          },
        },
      ],
    }),
  );

  assert.equal(resolution.description?.language, 'en');
  assert.equal(resolution.description?.text, EN_COPY);
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

test('a Dutch edition label is not evidence that its source synopsis is Dutch', async () => {
  for (const provider of ['open_library', 'google_books']) {
    clearBookDescriptionCacheForTests();
    const out = await resolveBookDescription({openLibraryWorkId:'OL42W',openLibraryEditionId:'OL42M',isbn13:'9789048854943',editionLanguage:'nld',locale:'nl'}, async input => {
      if (String(input).includes('/books/')) return jsonResponse({works:[{key:'/works/OL42W'}],languages:[{key:'/languages/dut'}],description:provider==='open_library'?EN_COPY:null});
      return jsonResponse({items:[{volumeInfo:{language:'nl',industryIdentifiers:[{type:'ISBN_13',identifier:'9789048854943'}],description:provider==='google_books'?EN_COPY:null}}]});
    });
    assert.equal(out.description,null);
  }
});

test('uncertain source copy is reconsidered after five minutes, not retained as twelve-hour absence', async t => {
  clearBookDescriptionCacheForTests();let now=1_000,calls=0;
  t.mock.method(Date,'now',()=>now);
  const fetcher=async()=>{calls++;return jsonResponse({items:[{volumeInfo:{language:'nl',industryIdentifiers:[{type:'ISBN_13',identifier:'9789048854943'}],description:calls===1?EN_COPY:NL_COPY}}]});};
  const lookup={isbn13:'9789048854943',editionLanguage:'nld',locale:'nl' as const};
  assert.equal((await resolveBookDescription(lookup,fetcher)).description,null);
  now+=299_000;assert.equal((await resolveBookDescription(lookup,fetcher)).description,null);assert.equal(calls,1);
  now+=1_001;assert.equal((await resolveBookDescription(lookup,fetcher)).description?.language,'nl');assert.equal(calls,2);
});

test('an English-only international edition cannot turn a Dutch route into English copy', async () => {
  clearBookDescriptionCacheForTests();
  const resolution = await resolveBookDescription(
    {
      openLibraryWorkId: 'OL893415W',
      editionLanguage: 'eng',
      locale: 'nl',
    },
    async () => jsonResponse({ description: 'Exact English work description.' }),
  );

  assert.equal(resolution.description, null);
  assert.equal(resolution.state, 'confirmed_missing');
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
              ? NL_COPY
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
    NL_COPY,
  );
});

test('deduplicates and caches repeated source requests in the server process', async () => {
  clearBookDescriptionCacheForTests();
  let calls = 0;
  const fetchImplementation = async () => {
    calls += 1;
    return jsonResponse({works:[{key:'/works/OL42W'}],languages:[{key:'/languages/eng'}],description: EN_COPY });
  };

  const lookup = { openLibraryWorkId: 'OL42W',openLibraryEditionId:'OL42M',editionLanguage:'eng', isbn13: null };
  const [first, second] = await Promise.all([
    resolveBookDescription(lookup, fetchImplementation),
    resolveBookDescription(lookup, fetchImplementation),
  ]);
  const third = await resolveBookDescription(lookup, fetchImplementation);

  assert.equal(first.description?.text, EN_COPY);
  assert.equal(second.description?.text, EN_COPY);
  assert.equal(third.description?.text, EN_COPY);
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
      : jsonResponse({works:[{key:'/works/OL4242W'}],languages:[{key:'/languages/eng'}], description: EN_COPY });
  };
  const lookup = { openLibraryWorkId: 'OL4242W',openLibraryEditionId:'OL4242M',editionLanguage:'eng', isbn13: null };

  const first = await resolveBookDescription(lookup, fetchImplementation);
  const cachedTemporary = await resolveBookDescription(lookup, fetchImplementation);
  assert.equal(first.state, 'temporary_failure');
  assert.equal(cachedTemporary.state, 'temporary_failure');
  assert.equal(calls, 3);

  now += 2 * 60 * 1_000 + 1;
  const recovered = await resolveBookDescription(lookup, fetchImplementation);
  assert.equal(recovered.state, 'resolved');
  assert.equal(recovered.description?.text, EN_COPY);
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

test('book detail receives server copy without a robots-blocked hydration request', async () => {
  const [component, route] = await Promise.all([
    readFile(new URL('../../app/components/LumiScoreBookDescription.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../app/api/books/[workId]/description/route.ts', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(component, /fetch\(|useEffect|\/api\//);
  assert.match(component, /description\?\.language ===/);
  assert.match(component,/englishEditionFallback/);
  assert.match(component, /publicDescriptionSource/);
  assert.match(component, /geverifieerde Nederlandse beschrijving/);
  assert.match(route, /isLocale\(requestedLocale\)/);
  assert.match(route, /loadCatalogBook\(workId, locale, false, \{skipExternalCovers:true\}\)/);
  assert.match(route, /loadPublicBookDescriptionState\(book,locale\)/);
});
