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

// Frozen round28 public identities; existing stored descriptions remain authoritative.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "3037",
    "editionId": "3196",
    "locale": "en",
    "title": "Diary of an 8-Bit Warrior : Forging Destiny",
    "author": "Cube Kid",
    "isbn": "9781449494469",
    "isbn10": null,
    "openLibraryWorkId": "OL19368094W",
    "openLibraryEditionId": "OL28900074M",
    "sourceKey": "9781449494469",
    "source": "official_publisher",
    "href": "https://publishing.andrewsmcmeel.com/book/diary-of-an-8-bit-warrior-forging-destiny-book-6-8-bit-warrior-series/",
    "marker": "Runt and Breeze",
    "start": "Runt and Breeze"
  },
  {
    "id": "3650",
    "editionId": "3809",
    "locale": "en",
    "title": "Power play",
    "author": "Kate William",
    "isbn": "9780553820690",
    "isbn10": "0553820699",
    "openLibraryWorkId": "OL3551997W",
    "openLibraryEditionId": "OL32345258M",
    "sourceKey": "9780553820690",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL32345258M",
    "marker": "Robin Wilson",
    "start": "Robin Wilson wants"
  },
  {
    "id": "3769",
    "editionId": "3928",
    "locale": "en",
    "title": "Basic econometrics",
    "author": "Damodar N. Gujarati",
    "isbn": "9780070660052",
    "isbn10": "0070660050",
    "openLibraryWorkId": "OL1823523W",
    "openLibraryEditionId": "OL32079548M",
    "sourceKey": "9780070660052",
    "source": "official_catalog",
    "href": "https://opac.juniv.edu/cgi-bin/koha/opac-detail.pl?biblionumber=576",
    "marker": "Regression",
    "start": "This fourth edition"
  },
  {
    "id": "3948",
    "editionId": "4107",
    "locale": "en",
    "title": "The Cambridge History of Warfare",
    "author": "Geoffrey Parker",
    "isbn": "9780521618953",
    "isbn10": "0521618959",
    "openLibraryWorkId": "OL218764W",
    "openLibraryEditionId": "OL7748897M",
    "sourceKey": "9780521618953",
    "source": "official_publisher",
    "href": "https://assets.cambridge.org/052185/3591/frontmatter/0521853591_frontmatter.pdf",
    "marker": "Geoffrey Parker",
    "start": "Geoffrey Parker brings"
  },
  {
    "id": "4710",
    "editionId": "4869",
    "locale": "en",
    "title": "Story",
    "author": "Robert McKee",
    "isbn": "9780060391683",
    "isbn10": "0060391685",
    "openLibraryWorkId": "OL273896W",
    "openLibraryEditionId": "OL677814M",
    "sourceKey": "9780060391683",
    "source": "official_publisher",
    "href": "https://mckeestory.com/books/story",
    "marker": "Robert McKee",
    "start": "Robert McKee develops"
  },
  {
    "id": "5718",
    "editionId": "5877",
    "locale": "nl",
    "title": "Seksuele gezondheid in Nederland 2006",
    "author": "Floor Bakker",
    "isbn": "9789059721364",
    "isbn10": "9059721365",
    "openLibraryWorkId": "OL41920817W",
    "openLibraryEditionId": "OL56925640M",
    "sourceKey": "9789059721364",
    "source": "official_catalog",
    "href": "https://metadata.isbn.nl/329547/seksuele-gezondheid-in-nederland-2006.html",
    "marker": "19 tot 70",
    "start": "Deze onderzoeksbundel, onder"
  },
  {
    "id": "5773",
    "editionId": "5932",
    "locale": "nl",
    "title": "Tilly",
    "author": "Frank E. Peretti",
    "isbn": "9789071864414",
    "isbn10": "9071864413",
    "openLibraryWorkId": "OL8199337W",
    "openLibraryEditionId": "OL36697328M",
    "sourceKey": "9789071864414",
    "source": "official_catalog",
    "href": "https://www.bibliotheek.nl/catalogus/titel.100941044.html/tilly/",
    "marker": "negen jaar",
    "start": "Een echtpaar wordt"
  },
  {
    "id": "6075",
    "editionId": "6234",
    "locale": "nl",
    "title": "Vang de haas",
    "author": "Lana Bastašić",
    "isbn": "9789029093958",
    "isbn10": "9029093951",
    "openLibraryWorkId": "OL20824310W",
    "openLibraryEditionId": "OL41739145M",
    "sourceKey": "9789029093958",
    "source": "official_publisher",
    "href": "https://www.meulenhoff.nl/sites/default/files/books/issuu/9789029093958.pdf",
    "marker": "Lejla",
    "start": "Sara heeft in"
  },
  {
    "id": "6601",
    "editionId": "6760",
    "locale": "en",
    "title": "Overdressed",
    "author": "Elizabeth L. Cline",
    "isbn": "9781591846543",
    "isbn10": null,
    "openLibraryWorkId": "OL16510092W",
    "openLibraryEditionId": "OL34486640M",
    "sourceKey": "9781591846543",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/309019/overdressed-by-elizabeth-l-cline/",
    "marker": "Elizabeth L. Cline",
    "start": "Elizabeth L. Cline"
  },
  {
    "id": "6803",
    "editionId": "6962",
    "locale": "en",
    "title": "Democratizing innovation",
    "author": "Eric von Hippel",
    "isbn": "9780262720472",
    "isbn10": "0262720477",
    "openLibraryWorkId": "OL5275396W",
    "openLibraryEditionId": "OL23241531M",
    "sourceKey": "9780262720472",
    "source": "official_publisher",
    "href": "https://mitpress.mit.edu/9780262720472/democratizing-innovation/",
    "marker": "Eric von Hippel",
    "start": "Eric von Hippel"
  },
  {
    "id": "7054",
    "editionId": "7213",
    "locale": "en",
    "title": "A History of American Architecture",
    "author": "Mark Gelernter",
    "isbn": "9781584651369",
    "isbn10": "1584651369",
    "openLibraryWorkId": "OL2003970W",
    "openLibraryEditionId": "OL8793689M",
    "sourceKey": "9781584651369",
    "source": "official_catalog",
    "href": "https://www.pritzkermilitary.org/explore/library/online-catalog/view/oclc/607259269",
    "marker": "Mark Gelernter",
    "start": "Mark Gelernter traces"
  },
  {
    "id": "7088",
    "editionId": "7247",
    "locale": "en",
    "title": "The discovery of poetry",
    "author": "Frances Mayes",
    "isbn": "9780155001626",
    "isbn10": "0155001620",
    "openLibraryWorkId": "OL14860157W",
    "openLibraryEditionId": "OL1752207M",
    "sourceKey": "9780155001626",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL1752207M",
    "marker": "Frances Mayes",
    "start": "Frances Mayes brings"
  },
  {
    "id": "7350",
    "editionId": "7509",
    "locale": "en",
    "title": "Sociological insight",
    "author": "Randall Collins",
    "isbn": "9780195074420",
    "isbn10": "0195074424",
    "openLibraryWorkId": "OL28951W",
    "openLibraryEditionId": "OL24871009M",
    "sourceKey": "9780195074420",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL24871009M",
    "marker": "Randall Collins",
    "start": "Randall Collins uses"
  },
  {
    "id": "7368",
    "editionId": "7527",
    "locale": "en",
    "title": "You'd Be Paranoid Too (If Everyone Was Out to Get You)",
    "author": "Awsten Knight",
    "isbn": "9781733661010",
    "isbn10": "1733661018",
    "openLibraryWorkId": "OL20860273W",
    "openLibraryEditionId": "OL28244927M",
    "sourceKey": "9781733661010",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL28244927M",
    "marker": "Awsten Knight",
    "start": "Awsten Knight gathers"
  },
  {
    "id": "8340",
    "editionId": "8499",
    "locale": "en",
    "title": "The British Chronicles, Book One",
    "author": "David Hughes",
    "isbn": "9780788433016",
    "isbn10": "0788433016",
    "openLibraryWorkId": "OL2850964W",
    "openLibraryEditionId": "OL11104395M",
    "sourceKey": "9780788433016",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL11104395M",
    "marker": "David Hughes",
    "start": "David Hughes follows"
  },
  {
    "id": "8476",
    "editionId": "8635",
    "locale": "en",
    "title": "The Seven Sisters",
    "author": "Lucinda Riley",
    "isbn": "9781501108877",
    "isbn10": null,
    "openLibraryWorkId": "OL20779796W",
    "openLibraryEditionId": "OL28801278M",
    "sourceKey": "9781501108877",
    "source": "official_publisher",
    "href": "https://books.google.com/books/about/The_Seven_Sisters.html?id=HLu2CAAAQBAJ",
    "marker": "Maia",
    "start": "After their adoptive"
  },
  {
    "id": "8668",
    "editionId": "8827",
    "locale": "en",
    "title": "Either or",
    "author": "Søren Kierkegaard",
    "isbn": "9780691019772",
    "isbn10": "0691019770",
    "openLibraryWorkId": "OL112738W",
    "openLibraryEditionId": "OL7756522M",
    "sourceKey": "9780691019772",
    "source": "official_publisher",
    "href": "https://press.princeton.edu/books/ebook/9781400846948/eitheror-part-ii",
    "marker": "Judge William",
    "start": "This edition contains"
  },
  {
    "id": "8703",
    "editionId": "8862",
    "locale": "en",
    "title": "Bride at Whangatapu",
    "author": "Robyn Donald",
    "isbn": "9780263725674",
    "isbn10": "0263725677",
    "openLibraryWorkId": "OL3476070W",
    "openLibraryEditionId": "OL14980046M",
    "sourceKey": "9780263725674",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL14980046M",
    "marker": "Fiona",
    "start": "Five years after"
  },
  {
    "id": "8942",
    "editionId": "9101",
    "locale": "en",
    "title": "The Land of Painted Caves",
    "author": "Jean M. Auel",
    "isbn": "9780553289435",
    "isbn10": "0553289438",
    "openLibraryWorkId": "OL15488687W",
    "openLibraryEditionId": "OL32937437M",
    "sourceKey": "9780553289435",
    "source": "official_catalog",
    "href": "https://bookshop.org/p/books/the-land-of-painted-caves-jean-m-auel/20ddbf90b8245d7b?ean=9780553289435",
    "marker": "Jonayla",
    "start": "Ayla lives with"
  },
  {
    "id": "4507",
    "editionId": "4666",
    "locale": "en",
    "title": "The Wave",
    "author": "Todd Strasser",
    "isbn": "9780140371888",
    "isbn10": "0140371885",
    "openLibraryWorkId": "OL999053W",
    "openLibraryEditionId": "OL7354156M",
    "sourceKey": "9780140371888",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL7354156M",
    "marker": "Laurie",
    "start": "A history lesson"
  },
  {
    "id": "3245",
    "editionId": "3404",
    "locale": "nl",
    "title": "De ontmoeting",
    "author": "Maas, Marique pseud. van Esther Verhoef",
    "isbn": "9789041424198",
    "isbn10": "9041424199",
    "openLibraryWorkId": "OL26174459W",
    "openLibraryEditionId": "OL35323690M",
    "sourceKey": "9789041424198",
    "source": "official_catalog",
    "href": "https://metadata.isbn.nl/176254/muren-van-glas-de-ontmoeting.html",
    "marker": "Nadine",
    "start": "Nadine leidt in"
  },
  {
    "id": "7092",
    "editionId": "7251",
    "locale": "en",
    "title": "Zayn",
    "author": "Zayn",
    "isbn": "9780718185756",
    "isbn10": "0718185757",
    "openLibraryWorkId": "OL20045478W",
    "openLibraryEditionId": "OL28242076M",
    "sourceKey": "9780718185756",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/300636/zayn-by-zayn/9780718185756",
    "marker": "One Direction",
    "start": "Zayn looks back"
  },
  {
    "id": "7636",
    "editionId": "7795",
    "locale": "en",
    "title": "Teeth",
    "author": "Mary Otto",
    "isbn": "9781620971444",
    "isbn10": "1620971445",
    "openLibraryWorkId": "OL20052301W",
    "openLibraryEditionId": "OL27232321M",
    "sourceKey": "9781620971444",
    "source": "official_catalog",
    "href": "https://www.nasw.org/member_article/mary-otto-teeth",
    "marker": "Deamonte Driver",
    "start": "Mary Otto begins"
  },
  {
    "id": "6940",
    "editionId": "7099",
    "locale": "en",
    "title": "Get the scoop, Geronimo!",
    "author": "Elisabetta Dami",
    "isbn": "9780545835503",
    "isbn10": "054583550X",
    "openLibraryWorkId": "OL17114708W",
    "openLibraryEditionId": "OL27191341M",
    "sourceKey": "9780545835503",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL27191341M",
    "marker": "Geronimo Stiltonoot",
    "start": "Geronimo Stiltonoot wants"
  },
  {
    "id": "8536",
    "editionId": "8695",
    "locale": "en",
    "title": "Untouched Wife",
    "author": "Rachel Lindsay",
    "isbn": "9780373104673",
    "isbn10": "0373104677",
    "openLibraryWorkId": "OL17179785W",
    "openLibraryEditionId": "OL10738120M",
    "sourceKey": "9780373104673",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL10738120M",
    "marker": "Sharley",
    "start": "Photographs make it"
  },
  {
    "id": "2273",
    "editionId": "2490",
    "locale": "en",
    "title": "The Lottery and Other Stories",
    "author": "Shirley Jackson",
    "isbn": "9780679640394",
    "isbn10": "0679604398",
    "openLibraryWorkId": "OL3171083W",
    "openLibraryEditionId": "OL6784334M",
    "sourceKey": "9780679640394",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL6784334M",
    "marker": "The Daemon Lover",
    "start": "A village prepares"
  },
  {
    "id": "4465",
    "editionId": "4624",
    "locale": "en",
    "title": "No and me",
    "author": "Delphine de Vigan",
    "isbn": "9781444805178",
    "isbn10": "1444805177",
    "openLibraryWorkId": "OL12948406W",
    "openLibraryEditionId": "OL32811174M",
    "sourceKey": "9781444805178",
    "source": "official_publisher",
    "href": "https://www.bloomsbury.com/uk/no-and-me-9781408813959/",
    "marker": "Lou Bertignac",
    "start": "Lou Bertignac’s school"
  },
  {
    "id": "4902",
    "editionId": "5061",
    "locale": "en",
    "title": "Grenade",
    "author": "Alan Gratz",
    "isbn": "9781338245691",
    "isbn10": null,
    "openLibraryWorkId": "OL19755255W",
    "openLibraryEditionId": "OL26968287M",
    "sourceKey": "9781338245691",
    "source": "official_catalog",
    "href": "https://catalog.wake.gov/GroupedWork/d6270202-c734-d29c-3cd9-e675115adb27/Home",
    "marker": "Hideki",
    "start": "On Okinawa in"
  },
  {
    "id": "6326",
    "editionId": "6485",
    "locale": "nl",
    "title": "Door het dode land",
    "author": "Teng, Tais pseud. van Thijs van Ebbenhorst Tengbergen",
    "isbn": "9789027642134",
    "isbn10": "9027642133",
    "openLibraryWorkId": "OL26182962W",
    "openLibraryEditionId": "OL35332809M",
    "sourceKey": "9789027642134",
    "source": "official_catalog",
    "href": "https://www.bibliotheek.nl/catalogus/titel.181976307.html/door-het-dode-land/",
    "marker": "Endar",
    "start": "Hakim reist met"
  },
  {
    "id": "8684",
    "editionId": "8843",
    "locale": "en",
    "title": "The first fifteen lives of Harry August",
    "author": "Claire North",
    "isbn": "9780356502588",
    "isbn10": "0356502589",
    "openLibraryWorkId": "OL19159115W",
    "openLibraryEditionId": "OL28227679M",
    "sourceKey": "9780356502588",
    "source": "official_publisher",
    "href": "https://www.hachette.co.uk/titles/claire-north/the-first-fifteen-lives-of-harry-august/9780356502588/",
    "marker": "eleventh life",
    "start": "Whenever Harry August"
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

  test(`recovery28 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery28 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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
    cacheDir: root + '.wrangler/node_modules/recovery28-tests', plugins: [react()],
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

