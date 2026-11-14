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

// Frozen identities from the independently captured round8 candidate-audit.json.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "8305",
    "editionId": "8464",
    "locale": "en",
    "title": "Eastern Body, Western Mind",
    "author": "Anodea Judith",
    "isbn": "9781587612251",
    "sourceKey": "9781587612251",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/197177/eastern-body-western-mind-by-anodea-judith/",
    "marker": "seven chakras",
    "start": "Anodea Judith"
  },
  {
    "id": "9487",
    "editionId": "9646",
    "locale": "en",
    "title": "In Other Lands",
    "author": "Sarah Rees Brennan",
    "isbn": "9781618731203",
    "sourceKey": "9781618731203",
    "source": "official_publisher",
    "href": "https://reactormag.com/excerpts-sarah-rees-brennan-in-other-lands/",
    "marker": "possibility of peace",
    "start": "Elliot enters"
  },
  {
    "id": "5440",
    "editionId": "5599",
    "locale": "nl",
    "title": "Wijsgerig misverstand",
    "author": "Broer Jansma",
    "isbn": "9789079378111",
    "sourceKey": "9789079378111",
    "source": "official_publisher",
    "href": "https://www.geertgrote.nl/wp-content/uploads/2021/10/210722dupcatalogus.pdf",
    "marker": "wetenschapsleer van Karl Popper",
    "start": "Broer Jansma onderzoekt"
  },
  {
    "id": "9738",
    "editionId": "9897",
    "locale": "en",
    "title": "Revolting Recipes",
    "author": "Roald Dahl",
    "isbn": "9780606130240",
    "sourceKey": "9780606130240",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/324135/roald-dahls-revolting-recipes-by-roald-dahl-illustrated-by-quentin-blake/",
    "marker": "Felicity Dahl and Josie Fison",
    "start": "The imaginary foods"
  },
  {
    "id": "9999",
    "editionId": "10158",
    "locale": "en",
    "title": "Highland Wolf",
    "author": "Hannah Howell",
    "isbn": "9781420142662",
    "sourceKey": "9781420142662",
    "source": "official_publisher",
    "href": "https://www.kensingtonbooks.com/shop/highland-wolf/",
    "marker": "James Drummond",
    "start": "Annora MacKay"
  },
  {
    "id": "7580",
    "editionId": "7739",
    "locale": "en",
    "title": "The Anarchist Handbook",
    "author": "Michael Malice",
    "isbn": "9798748719629",
    "sourceKey": "9798748719629",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/The_Anarchist_Handbook.html?id=B_HuEAAAQBAJ",
    "marker": "Josiah Warren",
    "start": "Michael Malice brings"
  },
  {
    "id": "8197",
    "editionId": "8356",
    "locale": "en",
    "title": "Plant Witchery",
    "author": "Juliet Diaz",
    "isbn": "9781401960209",
    "sourceKey": "9781401960209",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/647505/plant-witchery-by-juliet-diaz/",
    "marker": "contemporary witchcraft",
    "start": "Juliet Diaz presents"
  },
  {
    "id": "9087",
    "editionId": "9246",
    "locale": "en",
    "title": "The Spanish Billionaire's Pregnant Wife",
    "author": "Lynne Graham",
    "isbn": "9780263207118",
    "sourceKey": "9780263207118",
    "source": "official_publisher",
    "href": "https://harlequin.com/products/the-spanish-billionaires-pregnant-wife",
    "marker": "family expectations",
    "start": "Molly works"
  }
] as const;

function selectedBook(edition: typeof editions[number]): Book {
  return {
    id: 'work-' + edition.id, source: 'supabase', workId: edition.id, title: edition.title,
    editionTitle: edition.title, author: edition.author, isbn13: edition.isbn, editionAvailable: true,
    isbn10: null,
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

  test(`recovery8 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery8 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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


test('all eight recovery summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery8-tests', plugins: [react()],
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
