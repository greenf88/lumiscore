import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import type { Book } from '../../app/data/books.ts';
import { getBookMetadataDescription } from './book-detail.ts';
import { getInitialPublicBookDescription, loadPublicBookDescriptionState } from './public-description.ts';
import { resolveBookDescription } from './description-resolution.ts';
import { publicDescriptionSource } from './description-source.ts';
import { descriptionBinding, isDescriptionSnapshotWithdrawn, type DescriptionSnapshot } from './description-snapshot.ts';

// Frozen round25 public identities; existing stored descriptions remain authoritative.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "1787",
    "editionId": "1937",
    "locale": "en",
    "title": "Mismatch",
    "author": "Ronald Giphart",
    "isbn": "9781472139702",
    "isbn10": null,
    "openLibraryWorkId": "OL21616033W",
    "openLibraryEditionId": "OL29361703M",
    "sourceKey": "9781472139702",
    "source": "official_publisher",
    "href": "https://www.hachette.co.uk/titles/ronald-giphart-2/mismatch/9781472139702/",
    "marker": "Mark van Vugt",
    "start": "Ronald Giphart and"
  },
  {
    "id": "5609",
    "editionId": "5768",
    "locale": "nl",
    "title": "Huusraet",
    "author": "B. Dubbe",
    "isbn": "9789081706308",
    "isbn10": "9081706306",
    "openLibraryWorkId": "OL32806190W",
    "openLibraryEditionId": "OL44630785M",
    "sourceKey": "9789081706308",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/Huusraet.html?id=Fr_BMwEACAAJ",
    "marker": "huisraad",
    "start": "B. Dubbe onderzoekt"
  },
  {
    "id": "5984",
    "editionId": "6143",
    "locale": "nl",
    "title": "De val",
    "author": "Melanie Raabe",
    "isbn": "9789023495437",
    "isbn10": "9023495438",
    "openLibraryWorkId": "OL20231411W",
    "openLibraryEditionId": "OL28120761M",
    "sourceKey": "9789023495437",
    "source": "official_catalog",
    "href": "https://metadata.isbn.nl/691934/de-val.html",
    "marker": "Linda Conrads",
    "start": "Schrijfster Linda Conrads"
  },
  {
    "id": "7709",
    "editionId": "7868",
    "locale": "en",
    "title": "People & Places (World of Wonder)",
    "author": "Laurie Triefeldt",
    "isbn": "9781884956713",
    "isbn10": "1884956718",
    "openLibraryWorkId": "OL9850946W",
    "openLibraryEditionId": "OL12171795M",
    "sourceKey": "9781884956713",
    "source": "official_catalog",
    "href": "https://books.google.com/books?id=6FJENAU_gLoC",
    "marker": "Angkor",
    "start": "Laurie Triefeldt collects"
  },
  {
    "id": "8139",
    "editionId": "8298",
    "locale": "en",
    "title": "The Practice of Dream Healing",
    "author": "Edward Tick",
    "isbn": "9780835608060",
    "isbn10": "0835608069",
    "openLibraryWorkId": "OL4815742W",
    "openLibraryEditionId": "OL8191141M",
    "sourceKey": "9780835608060",
    "source": "official_publisher",
    "href": "https://redwheelweiser.com/book/the-practice-of-dream-healing-9780835607995/",
    "marker": "Asklepios",
    "start": "Edward Tick explores"
  },
  {
    "id": "9914",
    "editionId": "10073",
    "locale": "en",
    "title": "The Beggars' Strike",
    "author": "Aminata Sow Fall",
    "isbn": "9780582002432",
    "isbn10": "0582002435",
    "openLibraryWorkId": "OL3075656W",
    "openLibraryEditionId": "OL7879199M",
    "sourceKey": "9780582002432",
    "source": "official_publisher",
    "href": "https://www.editionsdurocher.fr/product/86956/la-greve-des-battu/",
    "marker": "Mour Ndiaye",
    "start": "Officials order beggars"
  },
  {
    "id": "2473",
    "editionId": "2709",
    "locale": "en",
    "title": "The True True Story of Raja the Gullible (and His Mother)",
    "author": "Rabih Alameddine",
    "isbn": "9780802166487",
    "isbn10": null,
    "openLibraryWorkId": "OL44257696W",
    "openLibraryEditionId": "OL60494766M",
    "sourceKey": "9780802166487",
    "source": "official_publisher",
    "href": "https://groveatlantic.com/book/the-true-true-story-of-raja-the-gullible-and-his-mother/",
    "marker": "Zalfa",
    "start": "Raja, a sixty-three-year-old"
  },
  {
    "id": "3066",
    "editionId": "3225",
    "locale": "en",
    "title": "The Starlight Crystal",
    "author": "Christopher Pike",
    "isbn": "9780671550288",
    "isbn10": "0671550284",
    "openLibraryWorkId": "OL1000803W",
    "openLibraryEditionId": "OL30181462M",
    "sourceKey": "9780671550288",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL824159M/The_starlight_crystal",
    "marker": "Paige Christian",
    "start": "Paige Christian joins"
  },
  {
    "id": "6995",
    "editionId": "7154",
    "locale": "en",
    "title": "Martin Luther King",
    "author": "Alan C. McLean",
    "isbn": "9780194233934",
    "isbn10": "0194233936",
    "openLibraryWorkId": "OL5900189W",
    "openLibraryEditionId": "OL23637757M",
    "sourceKey": "9780194233934",
    "source": "official_publisher",
    "href": "https://www.oup.es/martin-luther-king/",
    "marker": "civil rights",
    "start": "Alan C. McLean"
  },
  {
    "id": "9115",
    "editionId": "9274",
    "locale": "en",
    "title": "Love Games",
    "author": "Charlotte Lamb",
    "isbn": "9780373107728",
    "isbn10": "0373107722",
    "openLibraryWorkId": "OL11277328W",
    "openLibraryEditionId": "OL10738334M",
    "sourceKey": "9780373107728",
    "source": "official_catalog",
    "href": "https://romancewiki.bham.ac.uk/index.php/Love_Games",
    "marker": "Dinah",
    "start": "Dinah has worked"
  },
  {
    "id": "3214",
    "editionId": "3373",
    "locale": "nl",
    "title": "Wie Begrijpt Ooit Wat?",
    "author": "Jeroen Brouwers",
    "isbn": "9789068017403",
    "isbn10": "9068017403",
    "openLibraryWorkId": "OL702818W",
    "openLibraryEditionId": "OL12849554M",
    "sourceKey": "9789068017403",
    "source": "official_catalog",
    "href": "https://www.bol.com/be/nl/p/wie-begrijpt-ooit-wat/666884466/",
    "marker": "Gerd de Ley",
    "start": "Gerd de Ley"
  },
  {
    "id": "2876",
    "editionId": "3035",
    "locale": "en",
    "title": "Docile",
    "author": "K. M. Szpara",
    "isbn": "9781250216151",
    "isbn10": null,
    "openLibraryWorkId": "OL20755817W",
    "openLibraryEditionId": "OL28085728M",
    "sourceKey": "9781250216151",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9781250216335/docile/",
    "marker": "Elisha Wilder",
    "start": "Elisha Wilder takes"
  },
  {
    "id": "4472",
    "editionId": "4631",
    "locale": "en",
    "title": "The Celestine Prophecy",
    "author": "James Redfield",
    "isbn": "9780446518628",
    "isbn10": "044651862X",
    "openLibraryWorkId": "OL53168W",
    "openLibraryEditionId": "OL22141062M",
    "sourceKey": "9780446518628",
    "source": "official_publisher",
    "href": "https://shop.hachettebookgroup.com/products/the-celestine-prophecy-9780446545556",
    "marker": "Peru",
    "start": "A journey to"
  },
  {
    "id": "4784",
    "editionId": "4943",
    "locale": "en",
    "title": "Brown girl, brownstones",
    "author": "Paule Marshall",
    "isbn": "9781558614987",
    "isbn10": "1558614982",
    "openLibraryWorkId": "OL15829612W",
    "openLibraryEditionId": "OL3413070M",
    "sourceKey": "9781558614987",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL3413070M",
    "marker": "Selina Boyce",
    "start": "Selina Boyce grows"
  },
  {
    "id": "6327",
    "editionId": "6486",
    "locale": "nl",
    "title": "Blinde obsessie",
    "author": "Val McDermid",
    "isbn": "9789021804590",
    "isbn10": "902180459X",
    "openLibraryWorkId": "OL17297952W",
    "openLibraryEditionId": "OL33338194M",
    "sourceKey": "9789021804590",
    "source": "official_publisher",
    "href": "https://www.lsuitgeverij.nl/boek/blinde-obsessie/",
    "marker": "Charlie Flint",
    "start": "Psychiater Charlie Flint"
  },
  {
    "id": "2898",
    "editionId": "3057",
    "locale": "en",
    "title": "Pills and starships",
    "author": "Lydia Millet",
    "isbn": "9781617752759",
    "isbn10": "1617752754",
    "openLibraryWorkId": "OL17925619W",
    "openLibraryEditionId": "OL26498479M",
    "sourceKey": "9781617752759",
    "source": "official_publisher",
    "href": "https://www.akashicbooks.com/catalog/pills-starships/",
    "marker": "Nat",
    "start": "Nat and her"
  },
  {
    "id": "1066",
    "editionId": "1066",
    "locale": "nl",
    "title": "Bezonken rood",
    "author": "Jeroen Brouwers",
    "isbn": "9789045070476",
    "isbn10": null,
    "openLibraryWorkId": "OL702827W",
    "openLibraryEditionId": "OL25447455M",
    "sourceKey": "9789045070476",
    "source": "official_catalog",
    "href": "https://www.letterenfonds.nl/en/books/sunken-red",
    "marker": "Tjideng",
    "start": "Het bericht dat"
  },
  {
    "id": "6783",
    "editionId": "6942",
    "locale": "en",
    "title": "Discovering Public Relations",
    "author": "Karen Freberg",
    "isbn": "9781544355375",
    "isbn10": null,
    "openLibraryWorkId": "OL22004789W",
    "openLibraryEditionId": "OL30014057M",
    "sourceKey": "9781544355375",
    "source": "official_publisher",
    "href": "https://edge.sagepub.com/frebergpr",
    "marker": "Karen Freberg",
    "start": "Karen Freberg introduces"
  }
] as const;

function selectedBook(edition: typeof editions[number]): Book {
  return {
    id: 'work-' + edition.id, source: 'supabase', workId: edition.id, title: edition.title,
    editionTitle: edition.title, author: edition.author, isbn13: edition.isbn, editionAvailable: true,
    isbn10: edition.isbn10,
    editionLanguage: ({ nl: 'nld', en: 'eng' } as const)[edition.locale], strictEditionLanguage: edition.locale,
    // Recorded public identities; all provider and storage access is replaced by test doubles.
    editionId: edition.editionId, authorId: '70002', openLibraryWorkId: edition.openLibraryWorkId, openLibraryEditionId: edition.openLibraryEditionId,
    score: null, ratingsCount: null, match: null, cover: 'orbit',
  };
}

function withdrawnSnapshot(book: Book, locale: 'nl' | 'en'): DescriptionSnapshot {
  return {
    work_id: book.workId!, edition_id: book.editionId!, locale, binding_hash: descriptionBinding(book, locale)!,
    bound_author_id: book.authorId!, bound_title: book.editionTitle!, bound_language: book.editionLanguage!,
    bound_isbn13: book.isbn13!, bound_open_library_work_id: book.openLibraryWorkId!,
    text: null, source_key: book.openLibraryEditionId!, provider_status: 'withdrawn',
    fetched_at: '2026-11-12T12:00:00.000Z', checked_at: '2026-11-13T12:00:00.000Z',
    validation: 'identity_and_language_verified',
  };
}

for (const edition of editions) {
  const book = selectedBook(edition);
  const { locale } = edition;

  test(`recovery25 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
    const initial = getInitialPublicBookDescription(book, locale);
    assert.ok(initial);
    assert.match(initial.text, new RegExp(edition.marker));
    assert.equal(initial.language, locale);
    assert.equal(initial.sourceKey, edition.sourceKey);
    assert.equal(initial.source, edition.source);
    assert.equal(publicDescriptionSource(initial)?.href, edition.href);
    const metadata = getBookMetadataDescription(book, locale, initial);
    assert.match(metadata, new RegExp('^' + edition.start));
    assert.ok(Array.from(metadata).length <= 160);
    assert.notEqual(metadata, getBookMetadataDescription(book, locale));
    const withoutEllipsis = metadata.endsWith('…') ? metadata.slice(0, -1) : metadata;
    assert.ok(initial.text.startsWith(withoutEllipsis));

    let providerCalls = 0;
    const unreachable: typeof fetch = async () => { providerCalls++; throw Error('No external request allowed'); };
    assert.deepEqual(await resolveBookDescription({ ...book, locale }, unreachable), { state: 'resolved', description: initial });
    const withdrawn = withdrawnSnapshot(book, locale);
    assert.equal(isDescriptionSnapshotWithdrawn(withdrawn, book, locale), true);
    let reads = 0, writes = 0;
    for (const outage of [false, true]) {
      const store = {
        loadDescriptionSnapshot: async () => { reads++; if (outage) throw Error('Snapshot unavailable'); return withdrawn; },
        saveDescriptionSnapshot: async () => { writes++; },
        markDescriptionSnapshotFailure: async () => { writes++; },
      };
      assert.deepEqual(await loadPublicBookDescriptionState(book, locale, unreachable, store), { state: 'resolved', description: initial });
    }
    assert.equal(reads, 0, 'independent original text does not read withdrawn-source status');
    assert.equal(writes, 0);
    assert.equal(providerCalls, 0);
  });

  test(`recovery25 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
    const otherLocale = locale === 'en' ? 'nl' : 'en';
    for (const mismatch of [
      { isbn13: '9780141439518' }, { isbn13: null, isbn10: null },
      { editionTitle: 'A different book' }, { editionTitle: null },
      { author: 'A different author' }, { author: '' },
      { editionLanguage: otherLocale === 'en' ? 'eng' : 'nld' }, { editionLanguage: null },
      { editionAvailable: false },
    ]) {
      const other = { ...book, ...mismatch };
      const initial = getInitialPublicBookDescription(other, locale);
      assert.equal(initial, null, JSON.stringify(mismatch));
      assert.equal(getBookMetadataDescription(other, locale, initial), getBookMetadataDescription(other, locale));
    }
    assert.equal(getInitialPublicBookDescription(book, otherLocale), null);

    // The new fallback must not accidentally revive the withdrawn OL source
    // when its own exact identity no longer matches.
    const other = { ...book, isbn13: '9780141439518' };
    let reads = 0, providerCalls = 0;
    const store = {
      loadDescriptionSnapshot: async () => { reads++; return withdrawnSnapshot(other, locale); },
      saveDescriptionSnapshot: async () => { throw Error('No source writes allowed'); },
      markDescriptionSnapshotFailure: async () => { throw Error('No source writes allowed'); },
    };
    const unreachable: typeof fetch = async () => { providerCalls++; throw Error('Withdrawn source must not be fetched'); };
    assert.deepEqual(await loadPublicBookDescriptionState(other, locale, unreachable, store), { state: 'confirmed_missing', description: null });
    assert.equal(reads, 1);
    assert.equal(providerCalls, 0);
  });
}


test('all eighteen reviewed summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery25-tests', plugins: [react()],
    css: { postcss: { plugins: [] } }, resolve: { alias: { '@': root }, dedupe: ['react', 'react-dom'] },
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  try {
    const { LumiScoreBookDescription: Description } = await vite.ssrLoadModule('/app/components/LumiScoreBookDescription.tsx');
    const { LumiScoreLocaleProvider: Provider } = await vite.ssrLoadModule('/app/components/LumiScoreLocale.tsx');
    for (const edition of editions) {
      const description = getInitialPublicBookDescription(selectedBook(edition), edition.locale);
      const html = renderToStaticMarkup(createElement(Provider, { initialLocale: edition.locale, hasPersistedChoice: true, initialPath: '/book/' + edition.id },
        createElement(Description, { description })));
      assert.match(html, new RegExp(edition.marker), edition.id);
      assert.ok(description);
      const renderedParagraphs = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(match => match[1]);
      const expectedText = renderToStaticMarkup(createElement('span', null, description.text)).replace(/^<span>|<\/span>$/g, '');
      assert.equal(renderedParagraphs.join(' ').replace(/\s+/g, ' ').trim(), expectedText.replace(/\s+/g, ' ').trim(), `${edition.id}: paragraph formatting preserves the complete text and punctuation`);
      assert.ok(html.includes('href="' + edition.href + '"'), edition.id);
      assert.match(html, /class="description-source"/);
      assert.doesNotMatch(html, /Loading the description|De beschrijving wordt geladen|could not load|kon tijdelijk niet|not available yet|geen geverifieerde|<[^>]+\shidden(?:\s|=|>)/);
    }
  } finally { await vite.close(); }
});

