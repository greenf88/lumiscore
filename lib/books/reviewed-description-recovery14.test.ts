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

// Frozen identities from the independently captured round14 candidate-audit.json.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "10021",
    "editionId": "10180",
    "locale": "en",
    "title": "Holiday in death",
    "author": "Nora Roberts",
    "isbn": "9780753176924",
    "isbn10": null,
    "sourceKey": "9780753176924",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/341153/holiday-in-death-by-j-d-robb/",
    "marker": "Personally Yours",
    "start": "In this In"
  },
  {
    "id": "1430",
    "editionId": "1494",
    "locale": "en",
    "title": "Twelfth Night",
    "author": "William Shakespeare",
    "isbn": "9780743452960",
    "isbn10": null,
    "sourceKey": "9780743452960",
    "source": "official_catalog",
    "href": "https://www.folger.edu/explore/shakespeares-works/twelfth-night/",
    "marker": "Viola",
    "start": "Separated from her"
  },
  {
    "id": "1664",
    "editionId": "1806",
    "locale": "en",
    "title": "The Moving Finger",
    "author": "Agatha Christie",
    "isbn": "9781417618545",
    "isbn10": null,
    "sourceKey": "9781417618545",
    "source": "official_publisher",
    "href": "https://www.agathachristie.com/en/stories/the-moving-finger",
    "marker": "Jerry Burton",
    "start": "Jerry Burton arrives"
  },
  {
    "id": "2147",
    "editionId": "2350",
    "locale": "en",
    "title": "Shakespeare",
    "author": "William Shakespeare",
    "isbn": "9780155805309",
    "isbn10": null,
    "sourceKey": "9780155805309",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL4945836M",
    "marker": "G. B. Harrison",
    "start": "Edited by G."
  },
  {
    "id": "4410",
    "editionId": "4569",
    "locale": "en",
    "title": "Remembered Death",
    "author": "Agatha Christie",
    "isbn": "9780671422332",
    "isbn10": null,
    "sourceKey": "9780671422332",
    "source": "official_publisher",
    "href": "https://www.agathachristie.com/en/stories/sparkling-cyanide",
    "marker": "Sparkling Cyanide",
    "start": "Remembered Death is"
  },
  {
    "id": "586",
    "editionId": "586",
    "locale": "en",
    "title": "Murder at Hazelmoor",
    "author": "Agatha Christie",
    "isbn": "9780553350241",
    "isbn10": null,
    "sourceKey": "9780553350241",
    "source": "official_publisher",
    "href": "https://www.agathachristie.com/en/stories/the-sittaford-mystery",
    "marker": "The Sittaford Mystery",
    "start": "Published in Britain"
  },
  {
    "id": "631",
    "editionId": "631",
    "locale": "en",
    "title": "Sleeping Murder",
    "author": "Agatha Christie",
    "isbn": "9780553350364",
    "isbn10": null,
    "sourceKey": "9780553350364",
    "source": "official_publisher",
    "href": "https://www.agathachristie.com/en/stories/sleeping-murder",
    "marker": "Gwenda",
    "start": "Gwenda's new seaside"
  },
  {
    "id": "8486",
    "editionId": "8645",
    "locale": "en",
    "title": "One Night With His Wife",
    "author": "Lynne Graham",
    "isbn": "9780263166866",
    "isbn10": null,
    "sourceKey": "9780263166866",
    "source": "official_publisher",
    "href": "https://www.lynnegraham.com/book/one-night-with-his-wife/",
    "marker": "Star",
    "start": "Luc and Star"
  },
  {
    "id": "9138",
    "editionId": "9297",
    "locale": "en",
    "title": "The Awakening",
    "author": "Nora Roberts",
    "isbn": "9781432884093",
    "isbn10": null,
    "sourceKey": "9781432884093",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9781250272607/theawakening/",
    "marker": "Breen Kelly",
    "start": "Breen Kelly feels"
  },
  {
    "id": "9344",
    "editionId": "9503",
    "locale": "en",
    "title": "Naive Bride, Defiant Wife",
    "author": "Lynne Graham",
    "isbn": "9780263215458",
    "isbn10": null,
    "sourceKey": "9780263215458",
    "source": "official_publisher",
    "href": "https://www.lynnegraham.com/book/naive-bride-defiant-wife-uk-jemimas-secret-us/",
    "marker": "Jemima",
    "start": "Alejandro has never"
  },
  {
    "id": "9793",
    "editionId": "9952",
    "locale": "en",
    "title": "The MacGregor Grooms",
    "author": "Nora Roberts",
    "isbn": "9780263890358",
    "isbn10": null,
    "sourceKey": "9780263890358",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9781250775511/themacgregorgrooms/",
    "marker": "D.C., Duncan and Ian",
    "start": "Daniel MacGregor has"
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

  test(`recovery14 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery14 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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


test('all eleven recovery summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery14-tests', plugins: [react()],
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
