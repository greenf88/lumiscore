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

// Frozen identities from the independently captured round4 candidate-audit.json.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "4884",
    "editionId": "5043",
    "locale": "en",
    "title": "A cactus in the desert",
    "author": "Teresa Wairimu Kinyanjui",
    "isbn": "9789966749604",
    "source": "official_catalog",
    "href": "https://fem-international.org/about/reverend-teresa-wairimu-none-none/founder/",
    "marker": "rural Kenya",
    "start": "Teresa Wairimu"
  },
  {
    "id": "4770",
    "editionId": "4929",
    "locale": "en",
    "title": "Child bride",
    "author": "Suzanne Finstad",
    "isbn": "9780099228523",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/49734/child-bride-by-suzanne-finstad/",
    "marker": "Priscilla",
    "start": "Suzanne Finstad"
  },
  {
    "id": "9586",
    "editionId": "9745",
    "locale": "en",
    "title": "Elsewhere",
    "author": "Gabrielle Zevin",
    "isbn": "9780747580348",
    "source": "official_catalog",
    "href": "https://gabriellezevin.com/books/elsewhere/",
    "marker": "Liz Hall",
    "start": "Fifteen-year-old Liz"
  },
  {
    "id": "1468",
    "editionId": "1540",
    "locale": "en",
    "title": "Salammbo",
    "author": "Gustave Flaubert",
    "isbn": "9781582871042",
    "source": "official_catalog",
    "href": "https://www.gutenberg.org/ebooks/1290",
    "marker": "Matho",
    "start": "In ancient"
  },
  {
    "id": "6640",
    "editionId": "6799",
    "locale": "en",
    "title": "The No Asshole Rule",
    "author": "Robert I. Sutton",
    "isbn": "9780446526562",
    "source": "official_publisher",
    "href": "https://www.hachettebookgroup.com/titles/robert-i-sutton-phd/the-no-asshole-rule/9780759518018/",
    "marker": "hostile behaviour",
    "start": "Robert I."
  },
  {
    "id": "9644",
    "editionId": "9803",
    "locale": "en",
    "title": "Ring of Fire",
    "author": "Margaret Way",
    "isbn": "9780373707706",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL24373751M/Ring_of_Fire",
    "marker": "Marsh McConnell",
    "start": "Jo is"
  },
  {
    "id": "9741",
    "editionId": "9900",
    "locale": "en",
    "title": "Akira, Vol. 1",
    "author": "Katsuhiro Ōtomo",
    "isbn": "9781935429005",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/643406/akira-1-by-katsuhiro-otomo/",
    "marker": "Neo-Tokyo",
    "start": "Neo-Tokyo stands"
  },
  {
    "id": "7731",
    "editionId": "7890",
    "locale": "en",
    "title": "The philanthropy of George Soros",
    "author": "Chuck Sudetic",
    "isbn": "9781586488222",
    "source": "official_publisher",
    "href": "https://www.hachettebookgroup.com/titles/chuck-sudetic/the-philanthropy-of-george-soros/9781586488598/?lens=publicaffairs",
    "marker": "Sarajevo",
    "start": "Chuck Sudetic"
  },
  {
    "id": "7971",
    "editionId": "8130",
    "locale": "en",
    "title": "Introduction to machine learning",
    "author": "Ethem Alpaydin",
    "isbn": "9780262012430",
    "source": "official_publisher",
    "href": "https://mitpress.mit.edu/9780262012430/introduction-to-machine-learning/",
    "marker": "second edition",
    "start": "Ethem Alpaydin"
  },
  {
    "id": "7094",
    "editionId": "7253",
    "locale": "en",
    "title": "BOY ERASED",
    "author": "Garrard Conley",
    "isbn": "9780008294908",
    "source": "official_catalog",
    "href": "https://garrardconley.com/boy-erased/",
    "marker": "Arkansas",
    "start": "Growing up"
  },
  {
    "id": "5234",
    "editionId": "5393",
    "locale": "nl",
    "title": "Koning Willem III en zijn bastaarden",
    "author": "H. de Iongh",
    "isbn": "9789461532213",
    "source": "official_catalog",
    "href": "https://www.bibliotheek.nl/catalogus/titel.343720620.html/koning-willem-iii-en-zijn-bastaarden/",
    "marker": "vermeende",
    "start": "Hanno de"
  },
  {
    "id": "8911",
    "editionId": "9070",
    "locale": "en",
    "title": "The Cyberiad",
    "author": "Stanisław Lem",
    "isbn": "9780156027595",
    "source": "official_catalog",
    "href": "https://lem.pl/en/works/novels/the-cyberiad",
    "marker": "Klapaucius",
    "start": "The constructors"
  },
  {
    "id": "8492",
    "editionId": "8651",
    "locale": "en",
    "title": "Without Trust",
    "author": "Penny Jordan",
    "isbn": "9780263761122",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL28973668M/Without_Trust",
    "marker": "Lark Cummings",
    "start": "Accused of"
  },
  {
    "id": "8355",
    "editionId": "8514",
    "locale": "en",
    "title": "Down Girl",
    "author": "Kate Manne",
    "isbn": "9780141990729",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/313936/down-girl-by-manne-kate/9780141990729",
    "marker": "male dominance",
    "start": "Kate Manne"
  },
  {
    "id": "5410",
    "editionId": "5569",
    "locale": "nl",
    "title": "Kinderen opvoeden",
    "author": "Stef Desodt",
    "isbn": "9789020941159",
    "source": "official_publisher",
    "href": "https://www.bol.com/nl/nl/p/kinderen-opvoeden/666871538/?offerType=secondhand",
    "marker": "grootouders",
    "start": "Stef Desodt"
  },
  {
    "id": "2738",
    "editionId": "2897",
    "locale": "en",
    "title": "The Caves of Steel",
    "author": "Isaac Asimov",
    "isbn": "9780345329004",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/5630/the-caves-of-steel-by-isaac-asimov/",
    "marker": "Daneel",
    "start": "Detective Elijah"
  },
  {
    "id": "7140",
    "editionId": "7299",
    "locale": "en",
    "title": "Holt science & technology life science",
    "author": "Holt, Rinehart and Winston, Inc.",
    "isbn": "9780030519499",
    "source": "official_catalog",
    "href": "https://archive.org/details/holtsciencetechn00aust",
    "marker": "heredity",
    "start": "This life-science"
  },
  {
    "id": "6837",
    "editionId": "6996",
    "locale": "en",
    "title": "Exodus",
    "author": "Paul Collier",
    "isbn": "9780195398656",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/Exodus.html?id=2XgxAAAAQBAJ",
    "marker": "Collier",
    "start": "Paul Collier"
  },
  {
    "id": "7321",
    "editionId": "7480",
    "locale": "en",
    "title": "Spark",
    "author": "John J. Ratey",
    "isbn": "9780316113502",
    "source": "official_publisher",
    "href": "https://www.hachettebookgroup.com/titles/john-j-ratey-md/spark/9780316113502/",
    "marker": "Naperville",
    "start": "John J."
  }
] as const;

function selectedBook(edition: typeof editions[number]): Book {
  return {
    id: 'work-' + edition.id, source: 'supabase', workId: edition.id, title: edition.title,
    editionTitle: edition.title, author: edition.author, isbn13: edition.isbn, editionAvailable: true,
    editionLanguage: edition.locale === 'nl' ? 'nld' : 'eng', strictEditionLanguage: edition.locale,
    // Remaining storage identifiers are synthetic; tests never query a real catalogue.
    editionId: edition.editionId, authorId: '70002', openLibraryWorkId: 'OL70001W', openLibraryEditionId: 'OL70001M',
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

  test(`recovery4 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
    const initial = getInitialPublicBookDescription(book, locale);
    assert.ok(initial);
    assert.match(initial.text, new RegExp(edition.marker));
    assert.equal(initial.language, locale);
    assert.equal(initial.sourceKey, edition.isbn);
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

  test(`recovery4 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
    const otherLocale = locale === 'en' ? 'nl' : 'en';
    for (const mismatch of [
      { isbn13: '9780141439518' }, { isbn13: null },
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


test('all nineteen recovery summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery4-tests', plugins: [react()],
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
      assert.ok(html.includes('href="' + edition.href + '"'), edition.id);
      assert.match(html, /class="description-source"/);
      assert.doesNotMatch(html, /Loading the description|De beschrijving wordt geladen|could not load|kon tijdelijk niet|not available yet|geen geverifieerde|<[^>]+\shidden(?:\s|=|>)/);
    }
  } finally { await vite.close(); }
});
