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

// Frozen identities from the independently captured round13 candidate-audit.json.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "1477",
    "editionId": "1553",
    "locale": "en",
    "title": "Poirot Investigates",
    "author": "Agatha Christie",
    "isbn": "9780007265206",
    "isbn10": null,
    "sourceKey": "9780007265206",
    "source": "official_publisher",
    "href": "https://www.agathachristie.com/en/stories/poirot-investigates",
    "marker": "Hastings",
    "start": "Hercule Poirot and"
  },
  {
    "id": "1502",
    "editionId": "1598",
    "locale": "en",
    "title": "Henry IV (New Shakespeare)",
    "author": "William Shakespeare",
    "isbn": "9780521075329",
    "isbn10": null,
    "sourceKey": "9780521075329",
    "source": "official_catalog",
    "href": "https://www.folger.edu/explore/shakespeares-works/henry-iv-part-1/",
    "marker": "Hal",
    "start": "This volume contains"
  },
  {
    "id": "1615",
    "editionId": "1745",
    "locale": "en",
    "title": "Timon of Athens",
    "author": "William Shakespeare",
    "isbn": "9781434494146",
    "isbn10": null,
    "sourceKey": "9781434494146",
    "source": "official_catalog",
    "href": "https://www.folger.edu/explore/shakespeares-works/timon-of-athens/",
    "marker": "Timon",
    "start": "Timon is celebrated"
  },
  {
    "id": "1676",
    "editionId": "1819",
    "locale": "en",
    "title": "Ordeal by Innocence",
    "author": "Agatha Christie",
    "isbn": "9780553350678",
    "isbn10": null,
    "sourceKey": "9780553350678",
    "source": "official_publisher",
    "href": "https://www.agathachristie.com/en/stories/ordeal-by-innocence",
    "marker": "Calgary",
    "start": "Dr Arthur Calgary"
  },
  {
    "id": "1944",
    "editionId": "2124",
    "locale": "en",
    "title": "The Taming of the Shrew",
    "author": "William Shakespeare",
    "isbn": "9781726243452",
    "isbn10": null,
    "sourceKey": "9781726243452",
    "source": "official_catalog",
    "href": "https://www.folger.edu/explore/shakespeares-works/the-taming-of-the-shrew/",
    "marker": "Bianca",
    "start": "Bianca's father will"
  },
  {
    "id": "2122",
    "editionId": "2324",
    "locale": "en",
    "title": "Dominoes Starter The Tempest",
    "author": "William Shakespeare",
    "isbn": "9780194243940",
    "isbn10": null,
    "sourceKey": "9780194243940",
    "source": "official_publisher",
    "href": "https://www.oup.es/the-tempest/",
    "marker": "Bill Bowler",
    "start": "This Dominoes Starter"
  },
  {
    "id": "2148",
    "editionId": "2351",
    "locale": "en",
    "title": "Murder on the Links (Royal Collector's Edition) (Case Laminate Hardcover with Jacket)",
    "author": "Agatha Christie",
    "isbn": "9781774760994",
    "isbn10": null,
    "sourceKey": "9781774760994",
    "source": "official_publisher",
    "href": "https://www.agathachristie.com/en/stories/murder-on-the-links",
    "marker": "Poirot",
    "start": "An urgent request"
  },
  {
    "id": "4360",
    "editionId": "4519",
    "locale": "en",
    "title": "Murder with Mirrors",
    "author": "Agatha Christie",
    "isbn": "9780671829605",
    "isbn10": null,
    "sourceKey": "9780671829605",
    "source": "official_publisher",
    "href": "https://www.agathachristie.com/en/stories/they-do-it-with-mirrors",
    "marker": "Marple",
    "start": "Miss Marple visits"
  },
  {
    "id": "633",
    "editionId": "633",
    "locale": "en",
    "title": "River's End",
    "author": "Nora Roberts",
    "isbn": "9780515127836",
    "isbn10": null,
    "sourceKey": "9780515127836",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/355052/rivers-end-by-nora-roberts/",
    "marker": "Olivia",
    "start": "Olivia's childhood was"
  },
  {
    "id": "8430",
    "editionId": "8589",
    "locale": "en",
    "title": "Married by Arrangement",
    "author": "Lynne Graham",
    "isbn": "9780263841510",
    "isbn10": null,
    "sourceKey": "9780263841510",
    "source": "official_publisher",
    "href": "https://www.lynnegraham.com/book/married-by-arrangement/",
    "marker": "Sophie",
    "start": "Antonio Rocha discovers"
  },
  {
    "id": "8805",
    "editionId": "8964",
    "locale": "en",
    "title": "Hot ice",
    "author": "Nora Roberts",
    "isbn": "9780553264616",
    "isbn10": null,
    "sourceKey": "9780553264616",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/155746/hot-ice-by-nora-roberts/",
    "marker": "Whitney",
    "start": "Whitney MacAllister has"
  },
  {
    "id": "9231",
    "editionId": "9390",
    "locale": "en",
    "title": "Farewell to Love",
    "author": "Jessica Steele",
    "isbn": "9780373030415",
    "isbn10": null,
    "sourceKey": "9780373030415",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL24943721M",
    "marker": "Meredith",
    "start": "Meredith believes her"
  },
  {
    "id": "9814",
    "editionId": "9973",
    "locale": "en",
    "title": "Innocent Abroad",
    "author": "Jessica Steele",
    "isbn": "9780373024469",
    "isbn10": null,
    "sourceKey": "9780373024469",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL10691249M",
    "marker": "Reggie",
    "start": "Reggie's sister Bella"
  },
  {
    "id": "9846",
    "editionId": "10005",
    "locale": "en",
    "title": "Married for Revenge",
    "author": "Lynne Graham",
    "isbn": "9780263917871",
    "isbn10": null,
    "sourceKey": "9780263917871",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL29286658M",
    "marker": "three",
    "start": "This collection brings"
  }
] as const;

function selectedBook(edition: typeof editions[number]): Book {
  return {
    id: 'work-' + edition.id, source: 'supabase', workId: edition.id, title: edition.title,
    editionTitle: edition.title, author: edition.author, isbn13: edition.isbn, editionAvailable: true,
    isbn10: edition.isbn10,
    editionLanguage: ({ nl: 'nld', en: 'eng' } as const)[edition.locale], strictEditionLanguage: edition.locale,
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

  test(`recovery13 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery13 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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


test('all fourteen recovery summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery13-tests', plugins: [react()],
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

