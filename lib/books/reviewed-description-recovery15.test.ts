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

// Frozen identities from the independently captured round15 candidate-audit.json.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "1419",
    "editionId": "1477",
    "locale": "en",
    "title": "The Secret Adversary",
    "author": "Agatha Christie",
    "isbn": "9781940849676",
    "isbn10": null,
    "sourceKey": "9781940849676",
    "source": "official_publisher",
    "href": "https://www.agathachristie.com/en/stories/the-secret-adversary",
    "marker": "Young Adventurers",
    "start": "Tommy and Tuppence"
  },
  {
    "id": "1958",
    "editionId": "2144",
    "locale": "en",
    "title": "Midsummer Night's Dream",
    "author": "William Shakespeare",
    "isbn": "9781778786754",
    "isbn10": null,
    "sourceKey": "9781778786754",
    "source": "official_catalog",
    "href": "https://www.folger.edu/explore/shakespeares-works/a-midsummer-nights-dream/",
    "marker": "Oberon and Titania",
    "start": "A wedding in"
  },
  {
    "id": "2095",
    "editionId": "2297",
    "locale": "en",
    "title": "The Mystery of the Blue Train",
    "author": "Agatha Christie",
    "isbn": "9780553350685",
    "isbn10": null,
    "sourceKey": "9780553350685",
    "source": "official_publisher",
    "href": "https://www.agathachristie.com/en/stories/the-mystery-of-the-blue-train",
    "marker": "Ruth Kettering",
    "start": "A journey towards"
  },
  {
    "id": "2110",
    "editionId": "2312",
    "locale": "en",
    "title": "Antony and Cleopatra",
    "author": "William Shakespeare",
    "isbn": "9781904271000",
    "isbn10": null,
    "sourceKey": "9781904271000",
    "source": "official_catalog",
    "href": "https://www.folger.edu/explore/shakespeares-works/antony-and-cleopatra/",
    "marker": "Octavius Caesar",
    "start": "Mark Antony shares"
  },
  {
    "id": "3116",
    "editionId": "3275",
    "locale": "en",
    "title": "Three Fates",
    "author": "Nora Roberts",
    "isbn": "9780739424117",
    "isbn10": null,
    "sourceKey": "9780739424117",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/287811/three-fates-by-nora-roberts/",
    "marker": "Malachi, Gideon and Rebecca",
    "start": "A silver statue"
  },
  {
    "id": "686",
    "editionId": "686",
    "locale": "en",
    "title": "Face The Fire",
    "author": "Nora Roberts",
    "isbn": "9780739426067",
    "isbn10": null,
    "sourceKey": "9780739426067",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/290532/face-the-fire-by-nora-roberts/paperback/",
    "marker": "Mia Devlin",
    "start": "Mia Devlin has"
  },
  {
    "id": "8913",
    "editionId": "9072",
    "locale": "en",
    "title": "The Villa",
    "author": "Nora Roberts",
    "isbn": "9780425223871",
    "isbn10": null,
    "sourceKey": "9780425223871",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/290515/the-villa-by-nora-roberts/",
    "marker": "Sophia Giambelli",
    "start": "Sophia Giambelli understands"
  },
  {
    "id": "9112",
    "editionId": "9271",
    "locale": "en",
    "title": "The mysterious Mr Quin",
    "author": "Agatha Christie",
    "isbn": "9780002315791",
    "isbn10": null,
    "sourceKey": "9780002315791",
    "source": "official_publisher",
    "href": "https://www.agathachristie.com/en/stories/the-myserious-mr-quin",
    "marker": "Mr Satterthwaite",
    "start": "Mr Satterthwaite is"
  },
  {
    "id": "9213",
    "editionId": "9372",
    "locale": "en",
    "title": "Time and Again",
    "author": "Nora Roberts",
    "isbn": "9780786239832",
    "isbn10": null,
    "sourceKey": "9780786239832",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL32740473M",
    "marker": "Time Was and Times Change",
    "start": "Time and Again"
  },
  {
    "id": "9906",
    "editionId": "10065",
    "locale": "en",
    "title": "Reluctant Mistress, Blackmailed Wife",
    "author": "Lynne Graham",
    "isbn": "9780263192476",
    "isbn10": null,
    "sourceKey": "9780263192476",
    "source": "official_publisher",
    "href": "https://www.lynnegraham.com/book/reluctant-mistress-blackmailed-wife/",
    "marker": "Alexandros Christakis",
    "start": "Katie is raising"
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

  test(`recovery15 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery15 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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


test('all ten recovery summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery15-tests', plugins: [react()],
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
