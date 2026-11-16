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

// Frozen identities from the independently captured round16 candidate-audit.json.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "1625",
    "editionId": "1757",
    "locale": "nl",
    "title": "De graanrepubliek",
    "author": "Frank Westerman",
    "isbn": "9789045007663",
    "isbn10": null,
    "openLibraryWorkId": "OL868817W",
    "openLibraryEditionId": "OL35332267M",
    "sourceKey": "9789045007663",
    "source": "official_publisher",
    "href": "https://www.frankwesterman.nl/books/de-graanrepubliek",
    "marker": "Sicco Mansholt",
    "start": "Frank Westerman onderzoekt"
  },
  {
    "id": "9534",
    "editionId": "9693",
    "locale": "en",
    "title": "Circuit",
    "author": "Francisco Jimenez",
    "isbn": "9780439188968",
    "isbn10": null,
    "openLibraryWorkId": "OL8074352W",
    "openLibraryEditionId": "OL7510803M",
    "sourceKey": "9780439188968",
    "source": "official_publisher",
    "href": "https://www.unmpress.com/9780826317971/the-circuit/",
    "marker": "Panchito",
    "start": "Panchito grows up"
  },
  {
    "id": "3779",
    "editionId": "3938",
    "locale": "en",
    "title": "Children of the Matrix",
    "author": "David Icke",
    "isbn": "9780953881017",
    "isbn10": null,
    "openLibraryWorkId": "OL8726662W",
    "openLibraryEditionId": "OL8478735M",
    "sourceKey": "9780953881017",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL8478735M/Children_of_the_Matrix",
    "marker": "conspiracy theories",
    "start": "David Icke presents"
  },
  {
    "id": "1707",
    "editionId": "1852",
    "locale": "nl",
    "title": "De heilige Antonio",
    "author": "Arnon Grunberg",
    "isbn": null,
    "isbn10": "9074336396",
    "openLibraryWorkId": "OL850959W",
    "openLibraryEditionId": "OL434213M",
    "sourceKey": "9789074336390",
    "source": "official_publisher",
    "href": "https://www.arnongrunberg.com/words/1-netherlands-belgium/1-novels/122-de-heilige-antonio",
    "marker": "Paul en Tito",
    "start": "De Mexicaanse broers"
  },
  {
    "id": "3743",
    "editionId": "3902",
    "locale": "en",
    "title": "Making of a Manager",
    "author": "Julie Zhuo",
    "isbn": "9780753552896",
    "isbn10": null,
    "openLibraryWorkId": "OL20159758W",
    "openLibraryEditionId": "OL28688687M",
    "sourceKey": "9780753552896",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/438595/the-making-of-a-manager-by-julie-zhuo/9780753554548",
    "marker": "Julie Zhuo",
    "start": "Julie Zhuo draws"
  },
  {
    "id": "3674",
    "editionId": "3833",
    "locale": "en",
    "title": "Diana Her True Story",
    "author": "Andrew Morton",
    "isbn": "9781854791917",
    "isbn10": null,
    "openLibraryWorkId": "OL461064W",
    "openLibraryEditionId": "OL8990946M",
    "sourceKey": "9781854791917",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/Diana-Her-True-Story/Andrew-Morton/9780743546508",
    "marker": "Andrew Morton",
    "start": "Andrew Morton examines"
  },
  {
    "id": "1894",
    "editionId": "2068",
    "locale": "en",
    "title": "The Haunting of Hill House",
    "author": "Shirley Jackson",
    "isbn": "9780899684307",
    "isbn10": null,
    "openLibraryWorkId": "OL3171069W",
    "openLibraryEditionId": "OL8276913M",
    "sourceKey": "9780899684307",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/the-read-down/the-best-horror-books-of-all-time/",
    "marker": "Dr. Montague",
    "start": "Dr. Montague gathers"
  },
  {
    "id": "605",
    "editionId": "605",
    "locale": "en",
    "title": "Blaze",
    "author": "Stephen King",
    "isbn": "9781416554844",
    "isbn10": null,
    "openLibraryWorkId": "OL2794739W",
    "openLibraryEditionId": "OL9379877M",
    "sourceKey": "9781416554844",
    "source": "official_publisher",
    "href": "https://stephenking.com/works/novel/blaze.html",
    "marker": "Clayton Blaisdell",
    "start": "Clayton Blaisdell,"
  },
  {
    "id": "8727",
    "editionId": "8886",
    "locale": "en",
    "title": "The Devil Wears Prada",
    "author": "Lauren Weisberger",
    "isbn": "9780767925952",
    "isbn10": null,
    "openLibraryWorkId": "OL5825377W",
    "openLibraryEditionId": "OL8065043M",
    "sourceKey": "9780767925952",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/188221/the-devil-wears-prada-by-lauren-weisberger/9780385510912/",
    "marker": "Andrea Sachs",
    "start": "Andrea Sachs hopes"
  },
  {
    "id": "1907",
    "editionId": "2083",
    "locale": "en",
    "title": "The Secret of Secrets",
    "author": "Dan Brown",
    "isbn": "9781787634558",
    "isbn10": null,
    "openLibraryWorkId": "OL42542598W",
    "openLibraryEditionId": "OL57745071M",
    "sourceKey": "9781787634558",
    "source": "official_publisher",
    "href": "https://danbrown.com/books/novels/the-secret-of-secrets/",
    "marker": "Katherine Solomon",
    "start": "Robert Langdon travels"
  },
  {
    "id": "8937",
    "editionId": "9096",
    "locale": "en",
    "title": "Rage of Dragons",
    "author": "Evan Winter",
    "isbn": "9780316489775",
    "isbn10": null,
    "openLibraryWorkId": "OL20084923W",
    "openLibraryEditionId": "OL29823816M",
    "sourceKey": "9780316489775",
    "source": "official_publisher",
    "href": "https://www.hachettebookgroup.com/titles/evan-winter/the-rage-of-dragons/9780316489775/",
    "marker": "Tau",
    "start": "Tau wants to"
  },
  {
    "id": "2760",
    "editionId": "2919",
    "locale": "en",
    "title": "Dangerous Path",
    "author": "Erin Hunter",
    "isbn": "9780007140060",
    "isbn10": null,
    "openLibraryWorkId": "OL5714284W",
    "openLibraryEditionId": "OL30697345M",
    "sourceKey": "9780007140060",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/A_Dangerous_Path.html?id=BdD8oQEACAAJ",
    "marker": "Fireheart",
    "start": "Fireheart faces growing"
  },
  {
    "id": "3458",
    "editionId": "3617",
    "locale": "nl",
    "title": "De kleuren van schaduw",
    "author": "V. E. Schwab",
    "isbn": "9789022584941",
    "isbn10": null,
    "openLibraryWorkId": "OL17714885W",
    "openLibraryEditionId": "OL60159932M",
    "sourceKey": "9789022584941",
    "source": "official_publisher",
    "href": "https://www.lannoo.com/nl-nl/fantasy-sciencefiction/de-kleuren-van-schaduw-9789402312829",
    "marker": "Element Spelen",
    "start": "Rood Londen bereidt"
  },
  {
    "id": "1347",
    "editionId": "1374",
    "locale": "nl",
    "title": "Jij zegt het",
    "author": "Connie Palmen",
    "isbn": "9789044633382",
    "isbn10": null,
    "openLibraryWorkId": "OL23985653W",
    "openLibraryEditionId": "OL31687130M",
    "sourceKey": "9789044633382",
    "source": "official_publisher",
    "href": "https://uitgeverijprometheus.nl/boeken/jij-zegt-het-paperback/",
    "marker": "Ted Hughes",
    "start": "Connie Palmen geeft"
  },
  {
    "id": "1703",
    "editionId": "1848",
    "locale": "nl",
    "title": "De virtuoos",
    "author": "Margriet de Moor",
    "isbn": "9789025402402",
    "isbn10": null,
    "openLibraryWorkId": "OL548812W",
    "openLibraryEditionId": "OL9088439M",
    "sourceKey": "9789025402402",
    "source": "official_publisher",
    "href": "https://www.debezigebij.nl/boek/de-virtuoos/",
    "marker": "Carlotta",
    "start": "In het achttiende-eeuwse"
  },
  {
    "id": "6290",
    "editionId": "6449",
    "locale": "nl",
    "title": "Spiegel spiegel schouder",
    "author": "Dorthe Nors",
    "isbn": "9789057598586",
    "isbn10": null,
    "openLibraryWorkId": "OL17918573W",
    "openLibraryEditionId": "OL58493991M",
    "sourceKey": "9789057598586",
    "source": "official_publisher",
    "href": "https://www.lannoo.com/nl-be/literatuur-romans/spiegel-spiegel-schouder-9789057598593",
    "marker": "Sonja",
    "start": "Sonja is de"
  },
  {
    "id": "3279",
    "editionId": "3438",
    "locale": "nl",
    "title": "Fascisme",
    "author": "Madeleine Korbel Albright",
    "isbn": "9789029523998",
    "isbn10": null,
    "openLibraryWorkId": "OL17931000W",
    "openLibraryEditionId": "OL30094818M",
    "sourceKey": "9789029523998",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/Fascism_A_Warning.html?id=R25TtAEACAAJ",
    "marker": "Madeleine Albright",
    "start": "Madeleine Albright onderzoekt"
  },
  {
    "id": "10049",
    "editionId": "10208",
    "locale": "en",
    "title": "Rosie Revere, Engineer",
    "author": "Andrea Beaty",
    "isbn": "9781419708459",
    "isbn10": null,
    "openLibraryWorkId": "OL17334846W",
    "openLibraryEditionId": "OL25911192M",
    "sourceKey": "9781419708459",
    "source": "official_publisher",
    "href": "https://www.abramsbooks.com/product/rosie-revere-engineer_9781419708459/",
    "marker": "great-great-aunt Rose",
    "start": "Rosie quietly makes"
  },
  {
    "id": "9494",
    "editionId": "9653",
    "locale": "en",
    "title": "Ish",
    "author": "Peter H. Reynolds",
    "isbn": "9780545303026",
    "isbn10": null,
    "openLibraryWorkId": "OL2435177W",
    "openLibraryEditionId": "OL25635909M",
    "sourceKey": "9780545303026",
    "source": "official_publisher",
    "href": "https://www.candlewick.com/9780763623449/ish/",
    "marker": "Marisol",
    "start": "Ramon draws whenever"
  },
  {
    "id": "2135",
    "editionId": "2338",
    "locale": "en",
    "title": "Little Bear's Visit (An I Can Read Book, Level 1)",
    "author": "Else Holmelund Minarik",
    "isbn": "9780060242657",
    "isbn10": null,
    "openLibraryWorkId": "OL2568814W",
    "openLibraryEditionId": "OL9231013M",
    "sourceKey": "9780060242657",
    "source": "official_catalog",
    "href": "https://books.google.com/books?id=3_T-PgAACAAJ",
    "marker": "Grandmother and Grandfather Bear",
    "start": "Little Bear visits"
  },
  {
    "id": "2353",
    "editionId": "2573",
    "locale": "nl",
    "title": "Het lammetje dat een varken is",
    "author": "Pim Lammers",
    "isbn": null,
    "isbn10": null,
    "openLibraryWorkId": "OL39641520W",
    "openLibraryEditionId": "OL53931749M",
    "sourceKey": "9789462911994",
    "source": "official_publisher",
    "href": "https://eenhoorn.be/shop/het-lammetje-dat-een-varken-is/",
    "marker": "Pim Lammers",
    "start": "De schapen staan"
  },
  {
    "id": "5023",
    "editionId": "5182",
    "locale": "nl",
    "title": "De Vijf en de schat op het Fluistereiland",
    "author": "Enid Blyton",
    "isbn": "9789023010999",
    "isbn10": null,
    "openLibraryWorkId": "OL1948516W",
    "openLibraryEditionId": "OL32987110M",
    "sourceKey": "9789023010999",
    "source": "official_publisher",
    "href": "https://www.hachette.co.uk/titles/enid-blyton-2/famous-five-five-have-a-mystery-to-solve/9781444927627/",
    "marker": "Fluistereiland",
    "start": "Over Fluistereiland doen"
  },
  {
    "id": "1828",
    "editionId": "1982",
    "locale": "nl",
    "title": "De droom van de leeuw",
    "author": "Arthur Japin",
    "isbn": null,
    "isbn10": "9029523344",
    "openLibraryWorkId": "OL660522W",
    "openLibraryEditionId": "OL3633343M",
    "sourceKey": "9789029523349",
    "source": "official_publisher",
    "href": "https://www.arthurjapin.nl/de-droom-van-de-leeuw",
    "marker": "Snaporaz",
    "start": "De oude Italiaanse"
  },
  {
    "id": "8029",
    "editionId": "8188",
    "locale": "en",
    "title": "Kolyma Tales",
    "author": "Varlam Tikhonovich Shalamov",
    "isbn": "9780393013245",
    "isbn10": null,
    "openLibraryWorkId": "OL619700W",
    "openLibraryEditionId": "OL4416298M",
    "sourceKey": "9780393013245",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/17302/kolyma-tales-by-shalamov-varlan/9780140186956",
    "marker": "forced-labour camps",
    "start": "Varlam Shalamov draws"
  },
  {
    "id": "10114",
    "editionId": "10273",
    "locale": "en",
    "title": "Into the Forest",
    "author": "Jean Hegland",
    "isbn": "9780553106688",
    "isbn10": null,
    "openLibraryWorkId": "OL3294077W",
    "openLibraryEditionId": "OL7817366M",
    "sourceKey": "9780553106688",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/77877/into-the-forest-by-jean-hegland/9780307573568/",
    "marker": "Nell and Eva",
    "start": "Teenage sisters Nell"
  },
  {
    "id": "3660",
    "editionId": "3819",
    "locale": "en",
    "title": "Spirit Bares Its Teeth",
    "author": "Andrew Joseph White",
    "isbn": "9781682638149",
    "isbn10": null,
    "openLibraryWorkId": "OL34061150W",
    "openLibraryEditionId": "OL57565079M",
    "sourceKey": "9781682638149",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/727063/the-spirit-bares-its-teeth-by-andrew-joseph-white/",
    "marker": "Silas Bell",
    "start": "In an alternative"
  },
  {
    "id": "9762",
    "editionId": "9921",
    "locale": "en",
    "title": "Cipher, The",
    "author": "Kathe Koja",
    "isbn": "9780440207825",
    "isbn10": null,
    "openLibraryWorkId": "OL1885990W",
    "openLibraryEditionId": "OL7518912M",
    "sourceKey": "9780440207825",
    "source": "official_publisher",
    "href": "https://meerkatpress.com/books/the-cipher/",
    "marker": "Nicholas and Nakota",
    "start": "Nicholas and Nakota"
  },
  {
    "id": "8854",
    "editionId": "9013",
    "locale": "en",
    "title": "The babysitter II",
    "author": "Robert Lawrence Stine",
    "isbn": "9780590443326",
    "isbn10": null,
    "openLibraryWorkId": "OL15093826W",
    "openLibraryEditionId": "OL24200907M",
    "sourceKey": "9780590443326",
    "source": "official_catalog",
    "href": "https://books.google.com/books?id=PeAbHAAACAAJ",
    "marker": "Jenny",
    "start": "Jenny is trying"
  },
  {
    "id": "4442",
    "editionId": "4601",
    "locale": "en",
    "title": "Missing",
    "author": "Robert Lawrence Stine",
    "isbn": "9780671694104",
    "isbn10": null,
    "openLibraryWorkId": "OL72303W",
    "openLibraryEditionId": "OL24381261M",
    "sourceKey": "9780671694104",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/Missing/R-L-Stine/Fear-Street/9781534482920",
    "marker": "Mark and Cara",
    "start": "Mark and Cara"
  },
  {
    "id": "3753",
    "editionId": "3912",
    "locale": "en",
    "title": "I Heard You Paint Houses",
    "author": "Charles Brandt",
    "isbn": "9781586420772",
    "isbn10": null,
    "openLibraryWorkId": "OL4979625W",
    "openLibraryEditionId": "OL8820425M",
    "sourceKey": "9781586420772",
    "source": "official_publisher",
    "href": "https://steerforth.com/product/i-heard-you-paint-houses-9781586422387/",
    "marker": "Frank Sheeran",
    "start": "Charles Brandt reconstructs"
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

  test(`recovery17 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery17 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
    const otherLocale = locale === 'en' ? 'nl' : 'en';
    for (const mismatch of [
      { isbn13: '9780141439518' }, ...(edition.id === '2353' ? [
        { isbn10:'0306406152' }, { workId:'999999' }, { editionId:'999999' },
        { openLibraryWorkId:'OL999999W' }, { openLibraryEditionId:'OL999999M' },
        { openLibraryWorkId:null }, { openLibraryEditionId:null },
      ] : [{ isbn13: null, isbn10: null }]),
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


test('all thirty recovery summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery17-tests', plugins: [react()],
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
      if (edition.id === '9494') assert.ok(renderedParagraphs.every(paragraph => !paragraph.endsWith('Peter H.')), 'Ish must not split the author name across paragraphs');
      assert.ok(html.includes('href="' + edition.href + '"'), edition.id);
      assert.match(html, /class="description-source"/);
      assert.doesNotMatch(html, /Loading the description|De beschrijving wordt geladen|could not load|kon tijdelijk niet|not available yet|geen geverifieerde|<[^>]+\shidden(?:\s|=|>)/);
    }
  } finally { await vite.close(); }
});
