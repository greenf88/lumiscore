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
import { getReviewedDescription } from './reviewed-descriptions.ts';

// Frozen identities from the independently captured round5 candidate-audit.json.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "1412",
    "editionId": "1465",
    "locale": "en",
    "title": "The Ballad of Never After",
    "author": "Stephanie Garber",
    "isbn": "9781529380965",
    "sourceKey": "9781529380965",
    "source": "official_publisher",
    "href": "https://www.hachette.co.uk/titles/stephanie-garber-2/the-ballad-of-never-after/9781399643894/",
    "marker": "Evangeline Fox",
    "start": "Evangeline Fox"
  },
  {
    "id": "1385",
    "editionId": "1427",
    "locale": "en",
    "title": "Powerless",
    "author": "Lauren Roberts",
    "isbn": "9781398529489",
    "sourceKey": "9781398529489",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.co.uk/books/Powerless/Lauren-Roberts/The-Powerless-Trilogy/9781398529489",
    "marker": "Paedyn Gray",
    "start": "Paedyn Gray"
  },
  {
    "id": "8442",
    "editionId": "8601",
    "locale": "en",
    "title": "Murtagh",
    "author": "Christopher Paolini",
    "isbn": "9780241651407",
    "sourceKey": "9780241651407",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/456485/murtagh-by-paolini-christopher/9780241651407",
    "marker": "dragon Thorn",
    "start": "Murtagh and his"
  },
  {
    "id": "2187",
    "editionId": "2398",
    "locale": "en",
    "title": "A Memory of Light",
    "author": "Robert Jordan",
    "isbn": "9780765325952",
    "sourceKey": "9780765325952",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9780765325952/amemoryoflight/",
    "marker": "Brandon Sanderson",
    "start": "Rand al'Thor"
  },
  {
    "id": "3084",
    "editionId": "3243",
    "locale": "en",
    "title": "Feet of Clay",
    "author": "Terry Pratchett",
    "isbn": "9780575059009",
    "sourceKey": "9780575059009",
    "source": "official_catalog",
    "href": "https://www.terrypratchettbooks.com/books/feet-of-clay/",
    "marker": "City Watch",
    "start": "Sam Vimes"
  },
  {
    "id": "2070",
    "editionId": "2271",
    "locale": "en",
    "title": "The Jungle Book",
    "author": "Rudyard Kipling",
    "isbn": "9781421808673",
    "sourceKey": "9781421808673",
    "source": "official_catalog",
    "href": "https://www.gutenberg.org/files/236/236-h/236-h.htm",
    "marker": "Rikki-Tikki-Tavi",
    "start": "Rudyard Kipling"
  },
  {
    "id": "2426",
    "editionId": "2659",
    "locale": "en",
    "title": "A dangerous fortune",
    "author": "Ken Follett",
    "isbn": "9780440217497",
    "sourceKey": "9780440217497",
    "source": "official_catalog",
    "href": "https://ken-follett.com/books/a-dangerous-fortune/",
    "marker": "Pilaster",
    "start": "A schoolboy"
  },
  {
    "id": "4975",
    "editionId": "5134",
    "locale": "nl",
    "title": "Op Vleugels Van De Adelaar",
    "author": "Ken Follett",
    "isbn": "9789026978692",
    "sourceKey": "9789026978692",
    "source": "official_catalog",
    "href": "https://ken-follett.com/books/on-wings-of-eagles/",
    "marker": "Ross Perot",
    "start": "Twee medewerkers"
  },
  {
    "id": "1658",
    "editionId": "1797",
    "locale": "nl",
    "title": "Fantoompijn",
    "author": "Arnon Grunberg",
    "isbn": "9789038826950",
    "sourceKey": "9789038826950",
    "source": "official_publisher",
    "href": "https://www.singeluitgeverijen.nl/nijgh-van-ditmar/boek/fantoompijn-3/",
    "marker": "Mehlman",
    "start": "Robert G."
  },
  {
    "id": "1513",
    "editionId": "1614",
    "locale": "nl",
    "title": "DE KLANK VAN SNEEUW.",
    "author": "Arthur Japin",
    "isbn": null,
    "isbn10": "9029563362",
    "sourceKey": "9789029563369",
    "source": "official_catalog",
    "href": "https://www.arthurjapin.nl/luisterboek-de-klank-van-sneeuw",
    "marker": "Dooi",
    "start": "Arthur Japin"
  },
  {
    "id": "2437",
    "editionId": "2671",
    "locale": "en",
    "title": "The Year of Magical Thinking",
    "author": "Joan Didion",
    "isbn": "9780307386410",
    "sourceKey": "9780307386410",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouseretail.com/book/?isbn=9780307386410",
    "marker": "theatrical adaptation",
    "start": "Joan Didion adapts"
  },
  {
    "id": "2468",
    "editionId": "2703",
    "locale": "en",
    "title": "Purple Cow",
    "author": "Seth Godin",
    "isbn": "9781591840213",
    "sourceKey": "9781591840213",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/Purple_Cow.html?id=fNoOAAAACAAJ",
    "marker": "products worth noticing",
    "start": "Seth Godin argues"
  },
  {
    "id": "2779",
    "editionId": "2938",
    "locale": "en",
    "title": "Last Thing He Told Me",
    "author": "Laura Dave",
    "isbn": "9781788168595",
    "sourceKey": "9781788168595",
    "source": "official_publisher",
    "href": "https://viperbooks.co.uk/work/the-last-thing-he-told-me/",
    "marker": "Bailey",
    "start": "Hannah Hall"
  },
  {
    "id": "9126",
    "editionId": "9285",
    "locale": "en",
    "title": "The Chemist",
    "author": "Stephenie Meyer",
    "isbn": "9780751568233",
    "sourceKey": "9780751568233",
    "source": "official_catalog",
    "href": "https://stepheniemeyer.com/project/the-chemist/",
    "marker": "secretive US agency",
    "start": "A former specialist"
  },
  {
    "id": "6348",
    "editionId": "6507",
    "locale": "nl",
    "title": "Niemand zeggen",
    "author": "Karen Rose",
    "isbn": "9789026139635",
    "sourceKey": "9789026139635",
    "source": "official_catalog",
    "href": "https://www.karenrosebooks.com/don-t-tell",
    "marker": "Caroline Stewart",
    "start": "Mary Grace"
  },
  {
    "id": "9545",
    "editionId": "9704",
    "locale": "en",
    "title": "Foul Lady Fortune",
    "author": "Chloe Gong",
    "isbn": "9781665905589",
    "sourceKey": "9781665905589",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/Foul-Lady-Fortune/Chloe-Gong/Foul-Lady-Fortune/9781665905589",
    "marker": "Rosalind Lang",
    "start": "In Shanghai"
  },
  {
    "id": "1966",
    "editionId": "2155",
    "locale": "en",
    "title": "The Economic Consequences of the Peace",
    "author": "John Maynard Keynes",
    "isbn": "9781432610302",
    "sourceKey": "9781432610302",
    "source": "official_catalog",
    "href": "https://www.gutenberg.org/files/15776/15776-h/15776-h.htm",
    "marker": "reparations",
    "start": "John Maynard Keynes"
  },
  {
    "id": "2304",
    "editionId": "2521",
    "locale": "en",
    "title": "Infinite Game",
    "author": "Simon Sinek",
    "isbn": "9780241295595",
    "sourceKey": "9780241295595",
    "source": "official_catalog",
    "href": "https://simonsinek.com/books/the-infinite-game",
    "marker": "James Carse",
    "start": "Simon Sinek contrasts"
  },
  {
    "id": "2372",
    "editionId": "2592",
    "locale": "nl",
    "title": "Zo werken wij",
    "author": "Sacha Bronwasser",
    "isbn": "9789056628017",
    "sourceKey": "9789056628017",
    "source": "official_catalog",
    "href": "https://www.kunsthal.nl/nl/plan-je-bezoek/tentoonstellingen/joost-van-den-broek/",
    "marker": "Joost van den Broek",
    "start": "Sacha Bronwasser volgt"
  },
  {
    "id": "8556",
    "editionId": "8715",
    "locale": "en",
    "title": "Ungifted",
    "author": "Gordon Korman",
    "isbn": "9781443119207",
    "sourceKey": "9781443119207",
    "source": "official_catalog",
    "href": "https://gordonkorman.com/the-books/novels/ungifted",
    "marker": "Donovan Curtis",
    "start": "Donovan Curtis expects"
  }
] as const;

function selectedBook(edition: typeof editions[number]): Book {
  return {
    id: 'work-' + edition.id, source: 'supabase', workId: edition.id, title: edition.title,
    editionTitle: edition.title, author: edition.author, isbn13: edition.isbn, editionAvailable: true,
    isbn10: 'isbn10' in edition ? edition.isbn10 : null,
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

  test(`recovery5 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery5 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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


test('the reviewed Japin ISBN-10 alias resolves the same paperback and preserves all identity guards', () => {
  const edition = editions.find(row => row.id === '1513')!;
  const book = selectedBook(edition);
  const expected = getReviewedDescription(book, 'nl');
  assert.ok(expected);
  assert.equal(expected.sourceKey, '9789029563369');
  for (const identifiers of [
    { isbn13: null, isbn10: '90-295-6336-2' },
    { isbn13: '978-90-295-6336-9', isbn10: null },
    { isbn13: '9029563362', isbn10: null },
  ]) assert.deepEqual(getReviewedDescription({ ...book, ...identifiers }, 'nl'), expected);
  for (const mismatch of [
    { isbn10: '9029563363' }, { isbn10: null },
    { isbn13: '9789054441519' }, // Audio edition, despite the retained paperback ISBN-10.
    { isbn13: '9789029574938' }, // Ebook edition.
    { isbn13: 'unknown' },
    { editionTitle: 'Dooi' }, { author: 'Different author' }, { editionLanguage: 'eng' },
  ]) assert.equal(getReviewedDescription({ ...book, ...mismatch }, 'nl'), null, JSON.stringify(mismatch));
  assert.equal(getReviewedDescription(book, 'en'), null);
});

test('all twenty recovery summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery5-tests', plugins: [react()],
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
