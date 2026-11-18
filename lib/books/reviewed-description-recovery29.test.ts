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

// Frozen round29 public identities; existing stored descriptions remain authoritative.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "8965",
    "editionId": "9124",
    "locale": "en",
    "title": "The Guardians",
    "author": "John Grisham",
    "isbn": "9781473684614",
    "isbn10": "1473684617",
    "openLibraryWorkId": "OL20285172W",
    "openLibraryEditionId": "OL35674620M",
    "sourceKey": "9781473684614",
    "source": "official_publisher",
    "href": "https://jgrisham.com/the-guardians",
    "marker": "Quincy Miller",
    "start": "Quincy Miller has"
  },
  {
    "id": "8970",
    "editionId": "9129",
    "locale": "en",
    "title": "Streams of Silver",
    "author": "R. A. Salvatore",
    "isbn": "9780786942657",
    "isbn10": "0786942657",
    "openLibraryWorkId": "OL516753W",
    "openLibraryEditionId": "OL8144664M",
    "sourceKey": "9780786942657",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/752220/streams-of-silver-dungeons-and-dragons-by-ra-salvatore/",
    "marker": "Mithral Hall",
    "start": "Bruenor sets out"
  },
  {
    "id": "9011",
    "editionId": "9170",
    "locale": "en",
    "title": "Jake Howard's Wife",
    "author": "Anne Mather",
    "isbn": "9781472099693",
    "isbn10": null,
    "openLibraryWorkId": "OL3771277W",
    "openLibraryEditionId": "OL29249249M",
    "sourceKey": "9781472099693",
    "source": "official_publisher",
    "href": "https://www.millsandboon.co.uk/products/hqnsingle-07097823",
    "marker": "Helen",
    "start": "Jake Howard’s wealth"
  },
  {
    "id": "9036",
    "editionId": "9195",
    "locale": "en",
    "title": "Dark Pursuit",
    "author": "Charlotte Lamb",
    "isbn": "9780373113705",
    "isbn10": "0373113706",
    "openLibraryWorkId": "OL11277284W",
    "openLibraryEditionId": "OL9715184M",
    "sourceKey": "9780373113705",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL9715184M/Dark_Pursuit",
    "marker": "Caitlin",
    "start": "Caitlin’s marriage to"
  },
  {
    "id": "9108",
    "editionId": "9267",
    "locale": "en",
    "title": "Loving",
    "author": "Penny Jordan",
    "isbn": "9780263217070",
    "isbn10": null,
    "openLibraryWorkId": "OL11327956W",
    "openLibraryEditionId": "OL29029879M",
    "sourceKey": "9780263217070",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL29029879M/Loving",
    "marker": "Claire Richards",
    "start": "An inherited cottage"
  },
  {
    "id": "9300",
    "editionId": "9459",
    "locale": "en",
    "title": "Heartland Volume One",
    "author": "Lauren Brooke",
    "isbn": "9780760766057",
    "isbn10": "0760766053",
    "openLibraryWorkId": "OL5687691W",
    "openLibraryEditionId": "OL24237778M",
    "sourceKey": "9780760766057",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL24237778M/Heartland_Volume_One",
    "marker": "Amy",
    "start": "After her mother’s"
  },
  {
    "id": "9403",
    "editionId": "9562",
    "locale": "en",
    "title": "Mick Harte was here",
    "author": "Barbara Park",
    "isbn": "9780679882039",
    "isbn10": "0679882030",
    "openLibraryWorkId": "OL66285W",
    "openLibraryEditionId": "OL26343220M",
    "sourceKey": "9780679882039",
    "source": "official_publisher",
    "href": "https://penguinrandomhouseelementaryeducation.com/book/?isbn=9780679882039",
    "marker": "Phoebe",
    "start": "Phoebe remembers her"
  },
  {
    "id": "7728",
    "editionId": "7887",
    "locale": "en",
    "title": "The scenes of the street and other essays",
    "author": "Anthony Vidler",
    "isbn": "9781580932707",
    "isbn10": "1580932703",
    "openLibraryWorkId": "OL16121161W",
    "openLibraryEditionId": "OL25008226M",
    "sourceKey": "9781580932707",
    "source": "official_catalog",
    "href": "https://books.google.com/books?id=r927BLbRUgYC",
    "marker": "Anthony Vidler",
    "start": "Anthony Vidler examines"
  },
  {
    "id": "9671",
    "editionId": "9830",
    "locale": "en",
    "title": "She's Come Undone",
    "author": "Wally Lamb",
    "isbn": "9780671759216",
    "isbn10": "0671759213",
    "openLibraryWorkId": "OL1952158W",
    "openLibraryEditionId": "OL7664376M",
    "sourceKey": "9780671759216",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.biz/books/Shes-Come-Undone-%28Oprahs-Book-Club%29/Wally-Lamb/9780671003753",
    "marker": "Dolores Price",
    "start": "Dolores Price recounts"
  },
  {
    "id": "3166",
    "editionId": "3325",
    "locale": "nl",
    "title": "Afgunst",
    "author": "Saskia Noort",
    "isbn": "9789059650497",
    "isbn10": null,
    "openLibraryWorkId": "OL17203627W",
    "openLibraryEditionId": "OL25775413M",
    "sourceKey": "9789059650497",
    "source": "official_publisher",
    "href": "https://saskianoort.nl/boeken/afgunst-een-goed-huwelijk",
    "marker": "Susan van Doorn",
    "start": "Bestsellerschrijfster Susan van"
  },
  {
    "id": "5352",
    "editionId": "5511",
    "locale": "nl",
    "title": "Jiujitsu",
    "author": "Hans-Erik Petermann",
    "isbn": "9789059203303",
    "isbn10": "9059203305",
    "openLibraryWorkId": "OL8947267W",
    "openLibraryEditionId": "OL35326526M",
    "sourceKey": "9789059203303",
    "source": "official_publisher",
    "href": "https://www.bol.com/nl/nl/p/jiu-jitsu/1001004002382639/",
    "marker": "Petermann",
    "start": "Hans-Erik Petermann introduceert"
  },
  {
    "id": "8865",
    "editionId": "9024",
    "locale": "en",
    "title": "Slappy's Nightmare",
    "author": "Robert Lawrence Stine",
    "isbn": "9780439014144",
    "isbn10": "043901414X",
    "openLibraryWorkId": "OL15094768W",
    "openLibraryEditionId": "OL31939806M",
    "sourceKey": "9780439014144",
    "source": "official_catalog",
    "href": "https://www.arbookfind.com/bookdetailprint.aspx?2k=&l=EN&q=44174",
    "marker": "Jimmy",
    "start": "Slappy is used"
  },
  {
    "id": "4150",
    "editionId": "4309",
    "locale": "en",
    "title": "George vs. George",
    "author": "Rosalyn Schanzer",
    "isbn": "9781426300424",
    "isbn10": "1426300425",
    "openLibraryWorkId": "OL1888018W",
    "openLibraryEditionId": "OL8536522M",
    "sourceKey": "9781426300424",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL8536522M/George_vs._George",
    "marker": "George Washington",
    "start": "Rosalyn Schanzer places"
  },
  {
    "id": "4560",
    "editionId": "4719",
    "locale": "en",
    "title": "Betrayal in Bali",
    "author": "Sally Wentworth",
    "isbn": "9780373103966",
    "isbn10": "0373103964",
    "openLibraryWorkId": "OL3770466W",
    "openLibraryEditionId": "OL10738070M",
    "sourceKey": "9780373103966",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL10738070M/Betrayal_in_Bali",
    "marker": "Gael",
    "start": "Gael falls for"
  },
  {
    "id": "1684",
    "editionId": "1828",
    "locale": "nl",
    "title": "Bikkels",
    "author": "Carry Slee",
    "isbn": "9789074336499",
    "isbn10": "9074336493",
    "openLibraryWorkId": "OL24251025W",
    "openLibraryEditionId": "OL32080906M",
    "sourceKey": "9789074336499",
    "source": "official_catalog",
    "href": "https://books.google.co.il/books?hl=iw&id=3iG3SQAACAAJ&lr=&num=20",
    "marker": "Murat",
    "start": "Murat wil meedoen"
  },
  {
    "id": "5508",
    "editionId": "5667",
    "locale": "nl",
    "title": "Groei en evenwicht",
    "author": "A.H.S. Stemerding",
    "isbn": "9789014030517",
    "isbn10": "9014030517",
    "openLibraryWorkId": "OL24749291W",
    "openLibraryEditionId": "OL32859885M",
    "sourceKey": "9789014030517",
    "source": "official_publisher",
    "href": "https://beta.bol.com/nl/nl/p/groei-en-evenwicht-1e-dr/1001004005101551/",
    "marker": "Stemerding",
    "start": "Ad Stemerding beschrijft"
  },
  {
    "id": "3584",
    "editionId": "3743",
    "locale": "en",
    "title": "Egalia's Daughters",
    "author": "Gerd Brantenberg",
    "isbn": "9781580051255",
    "isbn10": "1580051251",
    "openLibraryWorkId": "OL16251842W",
    "openLibraryEditionId": "OL8760110M",
    "sourceKey": "9781580051255",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL8760110M/Egalia%27s_Daughters",
    "marker": "Egalia",
    "start": "In Egalia, women"
  },
  {
    "id": "9588",
    "editionId": "9747",
    "locale": "en",
    "title": "The Hike",
    "author": "Drew Magary",
    "isbn": "9780399563850",
    "isbn10": "0399563857",
    "openLibraryWorkId": "OL20035177W",
    "openLibraryEditionId": "OL27215218M",
    "sourceKey": "9780399563850",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL27215218M",
    "marker": "Ben",
    "start": "Ben takes a"
  },
  {
    "id": "5119",
    "editionId": "5278",
    "locale": "nl",
    "title": "De felomstreden kroon en deerniswekkende dood van koning Edward II & zijn favoriet, jonkheer Gaveston, onder wiens betovering hij zich afkeerde van zijn koningin en kroonprins, tot steeds grotere woede van de verzamelde adel en het voor de rest onwetende gewone volk",
    "author": "Tom Lanoye",
    "isbn": "9789044635522",
    "isbn10": "9044635522",
    "openLibraryWorkId": "OL43445080W",
    "openLibraryEditionId": "OL59204859M",
    "sourceKey": "9789044635522",
    "source": "official_publisher",
    "href": "https://www.bol.com/nl/nl/p/de-felomstreden-kroon-van-edward-ii/9200000079270592/",
    "marker": "Gaveston",
    "start": "Koning Edward II"
  },
  {
    "id": "6551",
    "editionId": "6710",
    "locale": "nl",
    "title": "Tilt",
    "author": "Michiel Stroink",
    "isbn": "9789029088916",
    "isbn10": "9029088915",
    "openLibraryWorkId": "OL39584410W",
    "openLibraryEditionId": "OL53850443M",
    "sourceKey": "9789029088916",
    "source": "official_catalog",
    "href": "https://rozet.nl/catalogus/1426236/",
    "marker": "Max",
    "start": "Pokerprofessional Max probeert"
  },
  {
    "id": "6913",
    "editionId": "7072",
    "locale": "en",
    "title": "The architecture of community",
    "author": "Léon Krier",
    "isbn": "9781597265782",
    "isbn10": "1597265780",
    "openLibraryWorkId": "OL857950W",
    "openLibraryEditionId": "OL22684961M",
    "sourceKey": "9781597265782",
    "source": "official_publisher",
    "href": "https://utpdistribution.com/9781597265782/the-architecture-of-community/",
    "marker": "Krier",
    "start": "Léon Krier sets"
  },
  {
    "id": "7484",
    "editionId": "7643",
    "locale": "en",
    "title": "Introduction to work and organizational behaviour",
    "author": "John Bratton",
    "isbn": "9781137408686",
    "isbn10": null,
    "openLibraryWorkId": "OL22316292W",
    "openLibraryEditionId": "OL30394488M",
    "sourceKey": "9781137408686",
    "source": "official_catalog",
    "href": "https://libkoha.alfaisal.edu/cgi-bin/koha/opac-MARCdetail.pl?biblionumber=7472",
    "marker": "John Bratton",
    "start": "John Bratton introduces"
  },
  {
    "id": "3572",
    "editionId": "3731",
    "locale": "en",
    "title": "A Nation of Idiots",
    "author": "Daksh Tyagi",
    "isbn": "9788194275015",
    "isbn10": "8194275016",
    "openLibraryWorkId": "OL27968141W",
    "openLibraryEditionId": "OL38233686M",
    "sourceKey": "9788194275015",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL38233686M",
    "marker": "Daksh Tyagi",
    "start": "Daksh Tyagi examines"
  },
  {
    "id": "1167",
    "editionId": "1167",
    "locale": "nl",
    "title": "De zeven vinkjes",
    "author": "Joris Luyendijk",
    "isbn": "9789493256675",
    "isbn10": null,
    "openLibraryWorkId": "OL28216089W",
    "openLibraryEditionId": "OL38629699M",
    "sourceKey": "9789493256675",
    "source": "official_publisher",
    "href": "https://www.boom.nl/management/leiderschap/100-20514_De-zeven-vinkjes",
    "marker": "Luyendijk",
    "start": "Joris Luyendijk onderzoekt"
  },
  {
    "id": "2519",
    "editionId": "2759",
    "locale": "en",
    "title": "The Cuckoo's Calling",
    "author": "Robert Galbraith",
    "isbn": "9780316206846",
    "isbn10": null,
    "openLibraryWorkId": "OL16806416W",
    "openLibraryEditionId": "OL25430214M",
    "sourceKey": "9780316206846",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL25430214M",
    "marker": "Cormoran Strike",
    "start": "Private investigator Cormoran"
  },
  {
    "id": "9524",
    "editionId": "9683",
    "locale": "en",
    "title": "The Spaniard's Marriage Bargain",
    "author": "Abby Green",
    "isbn": "9780373527236",
    "isbn10": "0373527233",
    "openLibraryWorkId": "OL15152632W",
    "openLibraryEditionId": "OL24220240M",
    "sourceKey": "9780373527236",
    "source": "official_publisher",
    "href": "https://harlequin.com/products/the-spaniards-marriage-bargain",
    "marker": "Rowan",
    "start": "Rowan once married"
  },
  {
    "id": "1148",
    "editionId": "1148",
    "locale": "nl",
    "title": "Reizen zonder John",
    "author": "Geert Mak",
    "isbn": "9789045020846",
    "isbn10": null,
    "openLibraryWorkId": "OL23233125W",
    "openLibraryEditionId": "OL31069297M",
    "sourceKey": "9789045020846",
    "source": "official_publisher",
    "href": "https://www.geertmak.nl/nl/amerika/boeken/reizen-zonder-john/",
    "marker": "Steinbeck",
    "start": "In 2010 vertrekt"
  },
  {
    "id": "6191",
    "editionId": "6350",
    "locale": "nl",
    "title": "De ijsmakers",
    "author": "Ernest Van der Kwast",
    "isbn": "9789023486381",
    "isbn10": "9023486382",
    "openLibraryWorkId": "OL20302179W",
    "openLibraryEditionId": "OL27504672M",
    "sourceKey": "9789023486381",
    "source": "official_publisher",
    "href": "https://debezigebij.nl/boek/ijsmakers-paperback/",
    "marker": "Giovanni",
    "start": "De familie Talamini"
  },
  {
    "id": "7498",
    "editionId": "7657",
    "locale": "en",
    "title": "Humble inquiry",
    "author": "Schein, Edgar H.",
    "isbn": "9781609949815",
    "isbn10": "1609949811",
    "openLibraryWorkId": "OL19980772W",
    "openLibraryEditionId": "OL27160915M",
    "sourceKey": "9781609949815",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL27160915M",
    "marker": "Edgar",
    "start": "Edgar H. Schein"
  },
  {
    "id": "7275",
    "editionId": "7434",
    "locale": "en",
    "title": "Thick",
    "author": "Tressie McMillan Cottom",
    "isbn": "9781620974360",
    "isbn10": "1620974363",
    "openLibraryWorkId": "OL19781746W",
    "openLibraryEditionId": "OL26993621M",
    "sourceKey": "9781620974360",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL26993621M",
    "marker": "Tressie",
    "start": "Tressie McMillan Cottom"
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

  test(`recovery29 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery29 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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


test('all thirty reviewed summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery29-tests', plugins: [react()],
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
      assert.ok(html.includes('href="' + edition.href.replaceAll('&', '&amp;') + '"'), edition.id);
      assert.match(html, /class="description-source"/);
      assert.doesNotMatch(html, /Loading the description|De beschrijving wordt geladen|could not load|kon tijdelijk niet|not available yet|geen geverifieerde|<[^>]+\shidden(?:\s|=|>)/);
    }
  } finally { await vite.close(); }
});

