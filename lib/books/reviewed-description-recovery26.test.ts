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

// Frozen round26 public identities; existing stored descriptions remain authoritative.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "9481",
    "editionId": "9640",
    "locale": "en",
    "title": "The De Santis Marriage",
    "author": "Michelle Reid",
    "isbn": "9780263204735",
    "isbn10": null,
    "openLibraryWorkId": "OL4233114W",
    "openLibraryEditionId": "OL29034760M",
    "sourceKey": "9780263204735",
    "source": "official_publisher",
    "href": "https://harlequin.com/en-ca/products/the-de-santis-marriage?variant=44990794137776",
    "marker": "Luciano",
    "start": "Luciano De Santis"
  },
  {
    "id": "8404",
    "editionId": "8563",
    "locale": "en",
    "title": "Impossible Bargain (Harlequin Presents, No 1125)",
    "author": "Patricia Wilson",
    "isbn": "9780373111251",
    "isbn10": "0373111258",
    "openLibraryWorkId": "OL8315359W",
    "openLibraryEditionId": "OL9746776M",
    "sourceKey": "9780373111251",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL9746776M/Impossible_Bargain_(Harlequin_Presents_No_1125)",
    "marker": "Merissa",
    "start": "Model Merissa is"
  },
  {
    "id": "7418",
    "editionId": "7577",
    "locale": "en",
    "title": "Footprints",
    "author": "Margaret Fishback Powers",
    "isbn": "9780310808664",
    "isbn10": "0310808669",
    "openLibraryWorkId": "OL1920675W",
    "openLibraryEditionId": "OL9352052M",
    "sourceKey": "9780310808664",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL9352052M/Footprints",
    "marker": "Scripture",
    "start": "This Footprints edition"
  },
  {
    "id": "8754",
    "editionId": "8913",
    "locale": "en",
    "title": "Passionate Scandal",
    "author": "Michelle Reid",
    "isbn": "9780263138993",
    "isbn10": "0263138992",
    "openLibraryWorkId": "OL4233148W",
    "openLibraryEditionId": "OL9752484M",
    "sourceKey": "9780263138993",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL9752484M/Passionate_Scandal",
    "marker": "Madeline",
    "start": "Madeline returns after"
  },
  {
    "id": "5958",
    "editionId": "6117",
    "locale": "nl",
    "title": "Blauwe plekken",
    "author": "Anke De Vries",
    "isbn": "9789060698310",
    "isbn10": "9060698312",
    "openLibraryWorkId": "OL30157271W",
    "openLibraryEditionId": "OL41450990M",
    "sourceKey": "9789060698310",
    "source": "official_publisher",
    "href": "https://www.zwijsen.nl/product/blauwe-plekken-9789047708278/",
    "marker": "Judith",
    "start": "Judith verbergt dat"
  },
  {
    "id": "2800",
    "editionId": "2959",
    "locale": "en",
    "title": "Ward D",
    "author": "Freida McFadden",
    "isbn": "9781464227271",
    "isbn10": "1464227276",
    "openLibraryWorkId": "OL42406707W",
    "openLibraryEditionId": "OL57563072M",
    "sourceKey": "9781464227271",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/Ward_D.html?id=I7jJ0AEACAAJ",
    "marker": "Amy",
    "start": "Medical student Amy"
  },
  {
    "id": "5131",
    "editionId": "5290",
    "locale": "nl",
    "title": "Revue Lanoye",
    "author": "Tom Lanoye",
    "isbn": "9789044629095",
    "isbn10": "9044629093",
    "openLibraryWorkId": "OL45258418W",
    "openLibraryEditionId": "OL61701123M",
    "sourceKey": "9789044629095",
    "source": "official_publisher",
    "href": "https://uitgeverijprometheus.nl/boeken/revue-lanoye-e-boek/",
    "marker": "Jonathan Jacob",
    "start": "Tom Lanoye brengt"
  },
  {
    "id": "9366",
    "editionId": "9525",
    "locale": "en",
    "title": "Abeng",
    "author": "Michelle Cliff",
    "isbn": "9780140153149",
    "isbn10": "0140153144",
    "openLibraryWorkId": "OL2736255W",
    "openLibraryEditionId": "OL7348902M",
    "sourceKey": "9780140153149",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/303279/abeng-by-michelle-cliff/",
    "marker": "Clare Savage",
    "start": "Twelve-year-old Clare Savage"
  },
  {
    "id": "5628",
    "editionId": "5787",
    "locale": "nl",
    "title": "70's in Nijmegen",
    "author": "Hans Timmermans",
    "isbn": "9789077503843",
    "isbn10": null,
    "openLibraryWorkId": "OL18629662W",
    "openLibraryEditionId": "OL24059506M",
    "sourceKey": "9789077503843",
    "source": "official_publisher",
    "href": "https://vantilt.nl/boeken/70s-in-nijmegen/",
    "marker": "Nijmegen",
    "start": "Hans Timmermans kijkt"
  },
  {
    "id": "1859",
    "editionId": "2025",
    "locale": "en",
    "title": "Hopscotch",
    "author": "Julio Cortázar",
    "isbn": null,
    "isbn10": null,
    "openLibraryWorkId": "OL14860424W",
    "openLibraryEditionId": "OL5662140M",
    "sourceKey": "OL5662140M",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/32202/hopscotch-by-julio-cortazar/",
    "marker": "Horacio Oliveira",
    "start": "Horacio Oliveira spends"
  },
  {
    "id": "1376",
    "editionId": "1414",
    "locale": "en",
    "title": "Against The Grain",
    "author": "Joris-Karl Huysmans",
    "isbn": "9781414230689",
    "isbn10": "1414230680",
    "openLibraryWorkId": "OL2239396W",
    "openLibraryEditionId": "OL8454856M",
    "sourceKey": "9781414230689",
    "source": "official_catalog",
    "href": "https://www.gutenberg.org/ebooks/12341",
    "marker": "Des Esseintes",
    "start": "Des Esseintes withdraws"
  },
  {
    "id": "2020",
    "editionId": "2220",
    "locale": "nl",
    "title": "Alleen maar nette mensen",
    "author": "Robert Vuijsje",
    "isbn": "9789038890616",
    "isbn10": null,
    "openLibraryWorkId": "OL20662980W",
    "openLibraryEditionId": "OL27941309M",
    "sourceKey": "9789038890616",
    "source": "official_publisher",
    "href": "https://www.uitgeverijathenaeum.nl/nijgh-van-ditmar/boek/alleen-maar-nette-mensen/",
    "marker": "David Samuels",
    "start": "David Samuels groeit"
  },
  {
    "id": "3913",
    "editionId": "4072",
    "locale": "en",
    "title": "Understanding the Human Being",
    "author": "Silvana Q. Montanaro",
    "isbn": "9781879341005",
    "isbn10": "187934100X",
    "openLibraryWorkId": "OL8889586W",
    "openLibraryEditionId": "OL8676722M",
    "sourceKey": "9781879341005",
    "source": "official_catalog",
    "href": "https://montessori.org.au/product/understanding-human-being-importance-first-three-years-life",
    "marker": "Montanaro",
    "start": "Silvana Quattrocchi Montanaro"
  },
  {
    "id": "4163",
    "editionId": "4322",
    "locale": "en",
    "title": "Case study research",
    "author": "Robert K. Yin",
    "isbn": "9781412960991",
    "isbn10": null,
    "openLibraryWorkId": "OL3918803W",
    "openLibraryEditionId": "OL16841559M",
    "sourceKey": "9781412960991",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/Case_Study_Research.html?id=k0WrN3rBz_sC",
    "marker": "Yin",
    "start": "Robert K. Yin"
  },
  {
    "id": "4740",
    "editionId": "4899",
    "locale": "en",
    "title": "Lives in the Shadow With J. Krishnamurti",
    "author": "Radha Rajagopal Sloss",
    "isbn": "9780201627015",
    "isbn10": "0201627019",
    "openLibraryWorkId": "OL4307141W",
    "openLibraryEditionId": "OL9800821M",
    "sourceKey": "9780201627015",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL9800821M/Lives_in_the_Shadow_With_J._Krishnamurti",
    "marker": "Sloss",
    "start": "Radha Rajagopal Sloss"
  },
  {
    "id": "5342",
    "editionId": "5501",
    "locale": "nl",
    "title": "Het palet van de psychologie",
    "author": "Jakop Rigter",
    "isbn": "9789062830305",
    "isbn10": "9062830307",
    "openLibraryWorkId": "OL26191388W",
    "openLibraryEditionId": "OL35341779M",
    "sourceKey": "9789062830305",
    "source": "official_publisher",
    "href": "https://portal.coutinho.nl/palet/studiemateriaal.html",
    "marker": "Rigter",
    "start": "Jakop Rigter zet"
  },
  {
    "id": "6857",
    "editionId": "7016",
    "locale": "en",
    "title": "When cultures collide",
    "author": "Richard D. Lewis",
    "isbn": "9781904838029",
    "isbn10": "1904838022",
    "openLibraryWorkId": "OL2977156W",
    "openLibraryEditionId": "OL23110464M",
    "sourceKey": "9781904838029",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL23110464M/When_cultures_collide",
    "marker": "Lewis",
    "start": "Richard D. Lewis"
  },
  {
    "id": "2314",
    "editionId": "2531",
    "locale": "nl",
    "title": "Lexie en pneumonoultramicroscopicsilicovolcanoconiosis",
    "author": "Kevin Hassing",
    "isbn": "9789465032719",
    "isbn10": "9465032719",
    "openLibraryWorkId": "OL44330659W",
    "openLibraryEditionId": "OL60578486M",
    "sourceKey": "9789465032719",
    "source": "official_publisher",
    "href": "https://onderwijs.cpnb.nl/campagnes/kinderboekenweek-2025",
    "marker": "Lexie",
    "start": "Lexie is dol"
  },
  {
    "id": "4096",
    "editionId": "4255",
    "locale": "en",
    "title": "Thinking Architecture",
    "author": "Peter Zumthor",
    "isbn": "9783764374976",
    "isbn10": "3764374977",
    "openLibraryWorkId": "OL586802W",
    "openLibraryEditionId": "OL9091046M",
    "sourceKey": "9783764374976",
    "source": "official_catalog",
    "href": "https://www.cca.qc.ca/en/search/details/library/publication/65207720",
    "marker": "Zumthor",
    "start": "Peter Zumthor reflects"
  },
  {
    "id": "5441",
    "editionId": "11691",
    "locale": "nl",
    "title": "Van Thomas Jefferson tot Pim Fortuyn",
    "author": "M. Fennema",
    "isbn": "9789055893058",
    "isbn10": null,
    "openLibraryWorkId": "OL22742188W",
    "openLibraryEditionId": null,
    "sourceKey": "9789055893058",
    "source": "official_catalog",
    "href": "https://rozet.nl/catalogus/1047107/",
    "marker": "Fennema",
    "start": "Meindert Fennema onderzoekt"
  },
  {
    "id": "6361",
    "editionId": "6520",
    "locale": "nl",
    "title": "Het lelietheater",
    "author": "Lulu Wang",
    "isbn": "9789022544945",
    "isbn10": "902254494X",
    "openLibraryWorkId": "OL850460W",
    "openLibraryEditionId": "OL35340668M",
    "sourceKey": "9789022544945",
    "source": "official_catalog",
    "href": "https://www.dbnl.org/tekst/_ons003199701_01/_ons003199701_01_0162.php",
    "marker": "Lian",
    "start": "Lian groeit op"
  },
  {
    "id": "8720",
    "editionId": "8879",
    "locale": "en",
    "title": "Except My Love",
    "author": "Mary Burchell",
    "isbn": "9780373017041",
    "isbn10": "0373017049",
    "openLibraryWorkId": "OL15335027W",
    "openLibraryEditionId": "OL24269823M",
    "sourceKey": "9780373017041",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL24269823M/Except_My_Love",
    "marker": "Erica",
    "start": "Erica loves her"
  },
  {
    "id": "1675",
    "editionId": "1818",
    "locale": "nl",
    "title": "Torenhoog en mijlen breed",
    "author": "Tonke Dragt",
    "isbn": null,
    "isbn10": "9025832547",
    "openLibraryWorkId": "OL3793469W",
    "openLibraryEditionId": "OL2990647M",
    "sourceKey": "9789025832544",
    "source": "official_catalog",
    "href": "https://metadata.isbn.nl/33725/torenhoog-en-mijlen-breed.html",
    "marker": "Edu",
    "start": "Planeetonderzoeker Edu komt"
  },
  {
    "id": "1983",
    "editionId": "2175",
    "locale": "en",
    "title": "The Odes and Carmen Saeculare of Horace",
    "author": "Horace",
    "isbn": "9781414270326",
    "isbn10": "1414270321",
    "openLibraryWorkId": "OL88217W",
    "openLibraryEditionId": "OL9544876M",
    "sourceKey": "9781414270326",
    "source": "official_catalog",
    "href": "https://www.gutenberg.org/cache/epub/5432/pg5432.html",
    "marker": "Horace",
    "start": "Horace’s Odes bring"
  },
  {
    "id": "4141",
    "editionId": "4300",
    "locale": "en",
    "title": "Die with Zero",
    "author": "Bill Perkins",
    "isbn": "9780358099765",
    "isbn10": null,
    "openLibraryWorkId": "OL20756743W",
    "openLibraryEditionId": "OL28086949M",
    "sourceKey": "9780358099765",
    "source": "official_publisher",
    "href": "https://diewithzerobook.com/",
    "marker": "Perkins",
    "start": "Bill Perkins argues"
  },
  {
    "id": "4347",
    "editionId": "4506",
    "locale": "en",
    "title": "Cows",
    "author": "Matthew Stokoe",
    "isbn": "9781840680058",
    "isbn10": "1840680059",
    "openLibraryWorkId": "OL5964735W",
    "openLibraryEditionId": "OL8916573M",
    "sourceKey": "9781840680058",
    "source": "official_publisher",
    "href": "https://www.matthewstokoe.com/cows-synopsis",
    "marker": "Steven",
    "start": "Steven lives with"
  },
  {
    "id": "6476",
    "editionId": "6635",
    "locale": "nl",
    "title": "De omweg",
    "author": "Gerbrand Bakker",
    "isbn": "9789059362949",
    "isbn10": null,
    "openLibraryWorkId": "OL22625196W",
    "openLibraryEditionId": "OL30649927M",
    "sourceKey": "9789059362949",
    "source": "official_publisher",
    "href": "https://www.uitgeverijcossee.nl/de-omweg/9789059363250",
    "marker": "Wales",
    "start": "Een Nederlandse vrouw"
  },
  {
    "id": "6518",
    "editionId": "6677",
    "locale": "nl",
    "title": "Parnassia",
    "author": "Josha Zwaan",
    "isbn": "9789047201670",
    "isbn10": null,
    "openLibraryWorkId": "OL16804097W",
    "openLibraryEditionId": "OL25427202M",
    "sourceKey": "9789047201670",
    "source": "official_publisher",
    "href": "https://www.uitgeverijorlando.nl/josha-zwaan-parnassia/",
    "marker": "Rivka",
    "start": "Het Joodse meisje"
  },
  {
    "id": "7798",
    "editionId": "7957",
    "locale": "en",
    "title": "Theatre Of The Real",
    "author": "Carol Martin",
    "isbn": "9780230281912",
    "isbn10": null,
    "openLibraryWorkId": "OL17469834W",
    "openLibraryEditionId": "OL26055453M",
    "sourceKey": "9780230281912",
    "source": "official_publisher",
    "href": "https://link.springer.com/book/10.1057/9781137295729",
    "marker": "Martin",
    "start": "Carol Martin investigates"
  },
  {
    "id": "5159",
    "editionId": "5318",
    "locale": "nl",
    "title": "Dagboek 1975",
    "author": "Jan Wolkers",
    "isbn": "9789023459439",
    "isbn10": null,
    "openLibraryWorkId": "OL22368141W",
    "openLibraryEditionId": "OL30452594M",
    "sourceKey": "9789023459439",
    "source": "official_catalog",
    "href": "https://metadata.isbn.nl/832829/dagboek-1975.html",
    "marker": "Amstelglorie",
    "start": "Jan Wolkers noteert"
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

  test(`recovery26 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery26 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
    const otherLocale = locale === 'en' ? 'nl' : 'en';
    for (const mismatch of [
      { isbn13: '9780141439518' },
      ...(edition.id === '1859' ? [{workId:'another-work'}, {editionId:'another-edition'}, {openLibraryWorkId:null}, {openLibraryEditionId:null}] : [{isbn13:null,isbn10:null}]),
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


test('all thirty reviewed summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery26-tests', plugins: [react()],
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

