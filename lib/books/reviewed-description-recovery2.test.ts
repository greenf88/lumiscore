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

// Independently recorded public page identities. Do not derive these fixtures
// from the recovery implementation: swapped ISBNs or titles must fail here.
const editions = [
  { id: '2062', locale: 'en', title: 'Summa Theologiae', author: 'Thomas Aquinas', isbn: '9780521393508',
    marker: /Knowing and Naming God/, start: /^This edition contains/, source: 'official_catalog',
    href: 'https://books.google.com/books?id=mBsCPQAACAAJ' },
  { id: '6545', locale: 'nl', title: 'Tweede persoon enkelvoud', author: 'Sayed Qashu', isbn: '9789041418371',
    marker: /Oost-Jeruzalem/, start: /^Een advocaat/, source: 'official_publisher',
    href: 'https://books.apple.com/us/book/tweede-persoon-enkelvoud/id536182533/' },
  { id: '8055', locale: 'en', title: 'Eyes of the Tailless Animals', author: 'Soon Ok Lee', isbn: '9780882643359',
    marker: /North Korea/, start: /^Soon Ok Lee recounts/, source: 'official_catalog',
    href: 'https://www.judiciary.senate.gov/imo/media/doc/lee_testimony_06_21_02.pdf' },
  { id: '2830', locale: 'en', title: 'The Mediterranean Caper', author: 'Clive Cussler', isbn: '9780671670429',
    marker: /Dirk Pitt/, start: /^An attack/, source: 'official_publisher',
    href: 'https://www.penguinrandomhouse.com/books/293798/the-mediterranean-caper-by-clive-cussler/' },
  { id: '4911', locale: 'en', title: 'Undaunted Courage', author: 'Stephen E. Ambrose', isbn: '9780684826974',
    marker: /Meriwether Lewis/, start: /^Stephen E\. Ambrose follows/, source: 'official_publisher',
    href: 'https://www.simonandschuster.com/books/Undaunted-Courage/Stephen-E-Ambrose/9780684826974' },
  { id: '10062', locale: 'en', title: 'The Universe Versus Alex Woods', author: 'Gavin Extence', isbn: '9780316246576',
    marker: /Mr\. Peterson/, start: /^A childhood encounter with a meteorite/, source: 'official_publisher',
    href: 'https://www.netgalley.com/catalog/book/24935' },
  { id: '4825', locale: 'en', title: "Where Do Chicks Come From? (Let's-Read-and-Find-Out Science 1)", author: 'Amy E. Sklansky', isbn: '9780060288921',
    marker: /fertilized egg/, start: /^A hen sitting/, source: 'official_catalog',
    href: 'https://books.google.com/books/about/Where_Do_Chicks_Come_From.html?id=g5zCEcflZ28C' },
  { id: '9508', locale: 'en', title: 'Hard Eight (Stephanie Plum Series #8)', author: 'Janet Evanovich', isbn: '9780312983864',
    marker: /Stephanie Plum/, start: /^A request from a neighbour/, source: 'official_publisher',
    href: 'https://us.macmillan.com/books/9780312983864/hardeight/' },
  { id: '9306', locale: 'en', title: 'Grief Is the Thing with Feathers', author: 'Max Porter', isbn: '9780571327232',
    marker: /Crow/, start: /^After their mother's sudden death/, source: 'official_catalog',
    href: 'https://books.google.com/books/about/Grief_is_the_Thing_with_Feathers.html?id=SGFHjgEACAAJ' },
  { id: '8463', locale: 'en', title: 'The Tale of the Body Thief', author: 'Anne Rice', isbn: '9780345384751',
    marker: /Raglan James/, start: /^Lestat accepts/, source: 'official_catalog',
    href: 'https://annerice.com/Bookshelf-BodyThief.html' },
  { id: '4363', locale: 'en', title: "There's a Boy in the Girls' Bathroom", author: 'Louis Sachar', isbn: '9780679805960',
    marker: /Bradley Chalkers/, start: /^Bradley Chalkers is older/, source: 'official_publisher',
    href: 'https://www.penguinrandomhouse.com/books/159544/theres-a-boy-in-the-girls-bathroom-by-louis-sachar/' },
] as const;

function selectedBook(edition: typeof editions[number]): Book {
  return {
    id: 'work-' + edition.id, source: 'supabase', workId: edition.id, title: edition.title,
    editionTitle: edition.title, author: edition.author, isbn13: edition.isbn, editionAvailable: true,
    editionLanguage: edition.locale === 'nl' ? 'nld' : 'eng', strictEditionLanguage: edition.locale,
    // Synthetic storage identities only; tests never query a real catalogue.
    editionId: '70001', authorId: '70002', openLibraryWorkId: 'OL70001W', openLibraryEditionId: 'OL70001M',
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

  test(`recovery2 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
    const initial = getInitialPublicBookDescription(book, locale);
    assert.ok(initial);
    assert.match(initial.text, edition.marker);
    assert.equal(initial.language, locale);
    assert.equal(initial.sourceKey, edition.isbn);
    assert.equal(initial.source, edition.source);
    assert.equal(publicDescriptionSource(initial)?.href, edition.href);
    const metadata = getBookMetadataDescription(book, locale, initial);
    assert.match(metadata, edition.start);
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

  test(`recovery2 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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

test('all eleven recovery summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery2-tests', plugins: [react()],
    css: { postcss: { plugins: [] } }, resolve: { alias: { '@': root }, dedupe: ['react', 'react-dom'] },
    server: { middlewareMode: true, hmr: false },
  });
  try {
    const { LumiScoreBookDescription: Description } = await vite.ssrLoadModule('/app/components/LumiScoreBookDescription.tsx');
    const { LumiScoreLocaleProvider: Provider } = await vite.ssrLoadModule('/app/components/LumiScoreLocale.tsx');
    for (const edition of editions) {
      const description = getInitialPublicBookDescription(selectedBook(edition), edition.locale);
      const html = renderToStaticMarkup(createElement(Provider, { initialLocale: edition.locale, hasPersistedChoice: true, initialPath: '/book/' + edition.id },
        createElement(Description, { description })));
      assert.match(html, edition.marker, edition.id);
      assert.ok(html.includes('href="' + edition.href + '"'), edition.id);
      assert.match(html, /class="description-source"/);
      assert.doesNotMatch(html, /Loading the description|De beschrijving wordt geladen|could not load|kon tijdelijk niet|not available yet|geen geverifieerde|<[^>]+\shidden(?:\s|=|>)/);
    }
  } finally { await vite.close(); }
});
