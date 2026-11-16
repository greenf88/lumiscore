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
    "id": "7437",
    "editionId": "7596",
    "locale": "en",
    "title": "Power of Letting Go",
    "author": "John Purkiss",
    "isbn": "9781783253630",
    "isbn10": null,
    "openLibraryWorkId": "OL20744779W",
    "openLibraryEditionId": "OL28058698M",
    "sourceKey": "9781783253630",
    "source": "official_publisher",
    "href": "https://www.hachette.co.uk/titles/john-purkiss-5/the-power-of-letting-go/9781783253630/",
    "marker": "John Purkiss",
    "start": "John Purkiss explores"
  },
  {
    "id": "1839",
    "editionId": "1996",
    "locale": "nl",
    "title": "Pericles",
    "author": "William Shakespeare",
    "isbn": null,
    "isbn10": "9035104552",
    "openLibraryWorkId": "OL361665W",
    "openLibraryEditionId": "OL24405551M",
    "sourceKey": "9789035104556",
    "source": "official_catalog",
    "href": "https://www.folger.edu/explore/shakespeares-works/pericles/",
    "marker": "Pericles",
    "start": "Prins Pericles van"
  },
  {
    "id": "5895",
    "editionId": "6054",
    "locale": "nl",
    "title": "Vlucht Voor De Tovenaar",
    "author": "Iris Murdoch",
    "isbn": "9789025463922",
    "isbn10": null,
    "openLibraryWorkId": "OL1326306W",
    "openLibraryEditionId": "OL12800826M",
    "sourceKey": "9789025463922",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/355269/the-flight-from-the-enchanter-by-murdoch-iris/9780099283690",
    "marker": "Mischa Fox",
    "start": "Annette verlaat haar"
  },
  {
    "id": "5469",
    "editionId": "5628",
    "locale": "nl",
    "title": "De wanhoopsdaad",
    "author": "Sidney Smeets",
    "isbn": "9789460037184",
    "isbn10": null,
    "openLibraryWorkId": "OL23300806W",
    "openLibraryEditionId": "OL31147442M",
    "sourceKey": "9789460037184",
    "source": "official_publisher",
    "href": "https://www.boom.nl/geschiedenis/e-book/100-3022_De-wanhoopsdaad",
    "marker": "Herschel Grynszpan",
    "start": "Sidney Smeets reconstrueert"
  },
  {
    "id": "5579",
    "editionId": "5738",
    "locale": "nl",
    "title": "Smalle marges",
    "author": "Joggli Meihuizen",
    "isbn": "9789085069416",
    "isbn10": null,
    "openLibraryWorkId": "OL16005454W",
    "openLibraryEditionId": "OL24909638M",
    "sourceKey": "9789085069416",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL24909638M",
    "marker": "Joggli Meihuizen",
    "start": "Joggli Meihuizen onderzoekt"
  },
  {
    "id": "6628",
    "editionId": "6787",
    "locale": "en",
    "title": "Introductory Econometrics",
    "author": "Jeffrey M. Wooldridge",
    "isbn": "9781305270107",
    "isbn10": null,
    "openLibraryWorkId": "OL21108634W",
    "openLibraryEditionId": "OL28573325M",
    "sourceKey": "9781305270107",
    "source": "official_publisher",
    "href": "https://www.cengage.com/c/introductory-econometrics-a-modern-approach-6e-wooldridge/9781305270107",
    "marker": "Jeffrey Wooldridge",
    "start": "Jeffrey Wooldridge introduces"
  },
  {
    "id": "8207",
    "editionId": "8366",
    "locale": "en",
    "title": "The day I stopped drinking milk",
    "author": "Sudha Murti",
    "isbn": "9780143418658",
    "isbn10": null,
    "openLibraryWorkId": "OL23344895W",
    "openLibraryEditionId": "OL31196130M",
    "sourceKey": "9780143418658",
    "source": "official_publisher",
    "href": "https://www.penguin.co.in/book/the-day-i-stopped-drinking-milk-2/",
    "marker": "Sudha Murty",
    "start": "Sudha Murty gathers"
  },
  {
    "id": "5408",
    "editionId": "5567",
    "locale": "nl",
    "title": "Opvoeden",
    "author": "Emmeliek Boost",
    "isbn": "9789021583532",
    "isbn10": null,
    "openLibraryWorkId": "OL26190609W",
    "openLibraryEditionId": "OL35340929M",
    "sourceKey": "9789021583532",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL35340929M",
    "marker": "Opvoeddesk",
    "start": "Emmeliek Boost bundelt"
  },
  {
    "id": "3771",
    "editionId": "3930",
    "locale": "en",
    "title": "How to Develop Self-Confidence",
    "author": "Dale Carnegie",
    "isbn": "9780671424145",
    "isbn10": null,
    "openLibraryWorkId": "OL1063296W",
    "openLibraryEditionId": "OL7647333M",
    "sourceKey": "9780671424145",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/346668/how-to-develop-self-confidence-by-dale-carnegie/9781446490792",
    "marker": "public speaking",
    "start": "Dale Carnegie approaches"
  },
  {
    "id": "9298",
    "editionId": "9457",
    "locale": "en",
    "title": "Sierra (Spirit of the Cimarron)",
    "author": "Kathleen Duey",
    "isbn": "9780142300961",
    "isbn10": null,
    "openLibraryWorkId": "OL88756W",
    "openLibraryEditionId": "OL7360462M",
    "sourceKey": "9780142300961",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/Sierra.html?id=vIvKPdu3XbUC",
    "marker": "Sierra",
    "start": "A natural disaster"
  },
  {
    "id": "1965",
    "editionId": "2154",
    "locale": "en",
    "title": "American Notes",
    "author": "Charles Dickens",
    "isbn": "9780781251211",
    "isbn10": null,
    "openLibraryWorkId": "OL8300173W",
    "openLibraryEditionId": "OL9564568M",
    "sourceKey": "9780781251211",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/34402/american-notes-by-charles-dickens-edited-with-an-introduction-and-notes-by-patricia-ingham-chronology-stephen-wall/9780140436495",
    "marker": "1842",
    "start": "Charles Dickens records"
  },
  {
    "id": "4291",
    "editionId": "4450",
    "locale": "en",
    "title": "Charlotte's Web",
    "author": "Jennifer Frantz",
    "isbn": "9780060882846",
    "isbn10": null,
    "openLibraryWorkId": "OL221977W",
    "openLibraryEditionId": "OL9238189M",
    "sourceKey": "9780060882846",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/Charlotte_s_Web_Wilbur_s_Prize.html?id=Ss4gOCuyFoMC",
    "marker": "Wilbur’s Prize",
    "start": "Wilbur hopes to"
  },
  {
    "id": "5684",
    "editionId": "5843",
    "locale": "nl",
    "title": "Zorg voor de ziel bij ziekte",
    "author": "Moore, Thomas",
    "isbn": "9789021549071",
    "isbn10": null,
    "openLibraryWorkId": "OL16526045W",
    "openLibraryEditionId": "OL25218337M",
    "sourceKey": "9789021549071",
    "source": "official_catalog",
    "href": "https://rozet.nl/catalogus/832100/",
    "marker": "Thomas Moore",
    "start": "Thomas Moore richt"
  },
  {
    "id": "7855",
    "editionId": "8014",
    "locale": "en",
    "title": "Play in the System",
    "author": "Anna Watkins Fisher",
    "isbn": "9781478009702",
    "isbn10": null,
    "openLibraryWorkId": "OL21674212W",
    "openLibraryEditionId": "OL29482004M",
    "sourceKey": "9781478009702",
    "source": "official_publisher",
    "href": "https://www.dukeupress.edu/the-play-in-the-system",
    "marker": "Anna Watkins Fisher",
    "start": "Anna Watkins Fisher"
  },
  {
    "id": "3217",
    "editionId": "3376",
    "locale": "nl",
    "title": "Rode regen",
    "author": "Cees Nooteboom",
    "isbn": "9789045000794",
    "isbn10": null,
    "openLibraryWorkId": "OL643698W",
    "openLibraryEditionId": "OL17057741M",
    "sourceKey": "9789045000794",
    "source": "official_publisher",
    "href": "https://www.debezigebij.nl/boek/rode-regen/",
    "marker": "Menorca",
    "start": "Vanuit zijn huis"
  },
  {
    "id": "5165",
    "editionId": "5324",
    "locale": "nl",
    "title": "Nisa",
    "author": "Marjorie Shostak",
    "isbn": "9789058312921",
    "isbn10": null,
    "openLibraryWorkId": "OL4217111W",
    "openLibraryEditionId": "OL32373471M",
    "sourceKey": "9789058312921",
    "source": "official_catalog",
    "href": "https://books.google.com/books?id=O7DtAAAAMAAJ",
    "marker": "Nisa",
    "start": "Antropologe Marjorie Shostak"
  },
  {
    "id": "3725",
    "editionId": "3884",
    "locale": "en",
    "title": "Skilled Helper",
    "author": "Gerard Egan",
    "isbn": "9781285065717",
    "isbn10": null,
    "openLibraryWorkId": "OL19902350W",
    "openLibraryEditionId": "OL28489586M",
    "sourceKey": "9781285065717",
    "source": "official_publisher",
    "href": "https://www.cengage.com/c/student/9781285065717/?filterBy=Student",
    "marker": "Gerard Egan",
    "start": "Gerard Egan presents"
  },
  {
    "id": "7672",
    "editionId": "7831",
    "locale": "en",
    "title": "The secret destiny of America",
    "author": "Manly Palmer Hall",
    "isbn": "9781585426621",
    "isbn10": null,
    "openLibraryWorkId": "OL11981208W",
    "openLibraryEditionId": "OL16942891M",
    "sourceKey": "9781585426621",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/302642/the-secret-destiny-of-america-by-manly-p-hall/",
    "marker": "Manly Hall",
    "start": "Manly Hall interprets"
  },
  {
    "id": "1503",
    "editionId": "1599",
    "locale": "nl",
    "title": "Richard III",
    "author": "William Shakespeare",
    "isbn": null,
    "isbn10": "9035107527",
    "openLibraryWorkId": "OL362684W",
    "openLibraryEditionId": "OL24405548M",
    "sourceKey": "9789035107526",
    "source": "official_catalog",
    "href": "https://www.folger.edu/explore/shakespeares-works/richard-iii/about-shakespeares-richard-iii/",
    "marker": "Richard",
    "start": "Richard, hertog van"
  },
  {
    "id": "1482",
    "editionId": "1563",
    "locale": "nl",
    "title": "Powerfood",
    "author": "Rens Kroes",
    "isbn": "9789000341016",
    "isbn10": null,
    "openLibraryWorkId": "OL17061410W",
    "openLibraryEditionId": "OL25630690M",
    "sourceKey": "9789000341016",
    "source": "official_publisher",
    "href": "https://www.lannoo.com/nl-be/kookboeken/powerfood-9789000341023",
    "marker": "Rens Kroes",
    "start": "Rens Kroes verzamelt"
  },
  {
    "id": "7404",
    "editionId": "7563",
    "locale": "en",
    "title": "The happiest refugee",
    "author": "Anh Do",
    "isbn": "9781742372389",
    "isbn10": null,
    "openLibraryWorkId": "OL16962315W",
    "openLibraryEditionId": "OL25555615M",
    "sourceKey": "9781742372389",
    "source": "official_publisher",
    "href": "https://www.allenandunwin.com/browse/book/Anh-Do-Happiest-Refugee-9781742372389",
    "marker": "Anh Do",
    "start": "Anh Do recounts"
  },
  {
    "id": "5130",
    "editionId": "5289",
    "locale": "nl",
    "title": "Een duister voorgevoel",
    "author": "Cees Nooteboom",
    "isbn": "9789023497936",
    "isbn10": null,
    "openLibraryWorkId": "OL45293903W",
    "openLibraryEditionId": "OL61742652M",
    "sourceKey": "9789023497936",
    "source": "official_publisher",
    "href": "https://www.debezigebij.nl/boek/een-duister-voorgevoel/",
    "marker": "Jheronimus Bosch",
    "start": "Cees Nooteboom reist"
  },
  {
    "id": "3293",
    "editionId": "3452",
    "locale": "nl",
    "title": "De wereld van Het Lied van Ijs en Vuur",
    "author": "George R. R. Martin",
    "isbn": "9789024562930",
    "isbn10": null,
    "openLibraryWorkId": "OL17553509W",
    "openLibraryEditionId": "OL27538527M",
    "sourceKey": "9789024562930",
    "source": "official_catalog",
    "href": "https://metadata.isbn.nl/2034834/a-knight-of-the-seven-kingdoms.html",
    "marker": "Dunk en Ei",
    "start": "Deze uitgave bevat"
  },
  {
    "id": "5438",
    "editionId": "5597",
    "locale": "nl",
    "title": "Eerlijke wetenschap",
    "author": "Gustaaf C. Cornelis",
    "isbn": "9789401413312",
    "isbn10": null,
    "openLibraryWorkId": "OL23317557W",
    "openLibraryEditionId": "OL31166247M",
    "sourceKey": "9789401413312",
    "source": "official_publisher",
    "href": "https://www.lannoo.com/nl-nl/onderwijs-didactiek-opvoeding/eerlijke-wetenschap-9789401413312",
    "marker": "wetenschappelijke integriteit",
    "start": "Gustaaf Cornelis onderzoekt"
  },
  {
    "id": "9420",
    "editionId": "9579",
    "locale": "en",
    "title": "The Sadeian Woman",
    "author": "Angela Carter",
    "isbn": "9780394758930",
    "isbn10": null,
    "openLibraryWorkId": "OL697439W",
    "openLibraryEditionId": "OL7462939M",
    "sourceKey": "9780394758930",
    "source": "official_publisher",
    "href": "https://www.hachette.co.uk/titles/angela-carter/the-sadeian-woman/9781844083770/",
    "marker": "Angela Carter",
    "start": "Angela Carter examines"
  },
  {
    "id": "5820",
    "editionId": "5979",
    "locale": "nl",
    "title": "Op dit moment",
    "author": "Karen Kingsbury",
    "isbn": "9789043531191",
    "isbn10": null,
    "openLibraryWorkId": "OL17800879W",
    "openLibraryEditionId": "OL42518928M",
    "sourceKey": "9789043531191",
    "source": "official_publisher",
    "href": "https://www.kokboekencentrum.nl/boek/op-dit-moment/",
    "marker": "Wendell Quinn",
    "start": "Rector Wendell Quinn"
  },
  {
    "id": "9654",
    "editionId": "9813",
    "locale": "en",
    "title": "Deliverance",
    "author": "James Dickey",
    "isbn": "9780385313872",
    "isbn10": null,
    "openLibraryWorkId": "OL14856962W",
    "openLibraryEditionId": "OL7439054M",
    "sourceKey": "9780385313872",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/Deliverance.html?id=Z4pjPjG2nLMC",
    "marker": "Georgia",
    "start": "Four men leave"
  },
  {
    "id": "5277",
    "editionId": "5436",
    "locale": "nl",
    "title": "Het grote lobbyboek",
    "author": "Erik van Venetië",
    "isbn": "9789058072719",
    "isbn10": null,
    "openLibraryWorkId": "OL28767742W",
    "openLibraryEditionId": "OL39482771M",
    "sourceKey": "9789058072719",
    "source": "official_publisher",
    "href": "https://erikvanvenetie.nl/boeken/",
    "marker": "Jaap Luikenaar",
    "start": "Erik van Venetië"
  },
  {
    "id": "5546",
    "editionId": "5705",
    "locale": "nl",
    "title": "Meditatiegids",
    "author": "Margit Dahlke",
    "isbn": "9789055134014",
    "isbn10": null,
    "openLibraryWorkId": "OL24990518W",
    "openLibraryEditionId": "OL33220218M",
    "sourceKey": "9789055134014",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL33220218M",
    "marker": "dierenriem",
    "start": "Margit en Ruediger"
  },
  {
    "id": "1676",
    "editionId": "1820",
    "locale": "nl",
    "title": "Doem der verdenking",
    "author": "Agatha Christie",
    "isbn": null,
    "isbn10": "9024546222",
    "openLibraryWorkId": "OL472145W",
    "openLibraryEditionId": "OL34721194M",
    "sourceKey": "9789024546220",
    "source": "official_publisher",
    "href": "https://www.agathachristie.com/en/stories/ordeal-by-innocence",
    "marker": "Arthur Calgary",
    "start": "Arthur Calgary ontdekt"
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

  test(`recovery18 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery18 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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


test('all thirty recovery summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery18-tests', plugins: [react()],
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
