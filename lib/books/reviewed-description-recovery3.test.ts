import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import type { Book } from '../../app/data/books.ts';
import { withStrictEdition } from './strict-edition.ts';
import { bookPageJsonLd } from '../seo/book-json-ld.ts';
import { getBookMetadataDescription } from './book-detail.ts';
import { getInitialPublicBookDescription, loadPublicBookDescriptionState } from './public-description.ts';
import { resolveBookDescription } from './description-resolution.ts';
import { publicDescriptionSource } from './description-source.ts';
import { descriptionBinding, isDescriptionSnapshotWithdrawn, type DescriptionSnapshot } from './description-snapshot.ts';

// Frozen identities from the independently captured round3 candidate-audit.json.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {"id":"1811","editionId":"1961","locale":"en","title":"Season of Migration to the North","author":"al-Ṭayyib Ṣāliḥ","isbn":"9780894101991","source":"official_publisher","href":"https://www.rienner.com/title/Season_of_Migration_to_the_North_A_Novel", marker: new RegExp("Mustafa"), start: new RegExp("^After studying") },
  {"id":"8318","editionId":"8477","locale":"en","title":"Outline","author":"Rachel Cusk","isbn":"9780374228347","source":"official_publisher","href":"https://us.macmillan.com/books/9781250081544/outline/", marker: new RegExp("ten conversations"), start: new RegExp("^A novelist travels") },
  {"id":"1795","editionId":"1945","locale":"en","title":"Repatriated","author":"Adriaan Van Dis","isbn":"9780434011803","source":"official_publisher","href":"https://www.penguin.co.nz/books/repatriated-9781785150845", marker: new RegExp("Mr Java"), start: new RegExp("^In a seaside town") },
  {"id":"7414","editionId":"7573","locale":"en","title":"On Bullshit","author":"Harry G. Frankfurt","isbn":"9780691122946","source":"official_publisher","href":"https://upguk.com/wp-content/uploads/2024/01/Philosophy-s24.pdf", marker: new RegExp("indifference"), start: new RegExp("^Harry G") },
  {"id":"4804","editionId":"4963","locale":"en","title":"Personal Memoirs of U. S. Grant","author":"Ulysses S. Grant","isbn":"9781421934679","source":"official_catalog","href":"https://www.gutenberg.org/files/4367/4367-h/4367-h.htm", marker: new RegExp("American Civil War"), start: new RegExp("^Ulysses S") },
  {"id":"4490","editionId":"4649","locale":"en","title":"The Time of the Doves (La Plaza del Diamante)","author":"Mercè Rodoreda","isbn":"9780915308750","source":"official_publisher","href":"https://books-events.graywolfpress.org/books/time-doves", marker: new RegExp("Natalia"), start: new RegExp("^Natalia") },
  {"id":"8116","editionId":"8275","locale":"en","title":"Hunter × Hunter, Volume 1","author":"冨樫義博","isbn":"9781591167532","source":"official_publisher","href":"https://www.viz.com/manga-books/manga/hunter-x-hunter-volume-1/product/339/paperback", marker: new RegExp("Kurapika"), start: new RegExp("^Gon leaves") },
  {"id":"2970","editionId":"3129","locale":"en","title":"As Long as the Lemon Trees Grow","author":"Zoulfa Katouh","isbn":"9781526648549","source":"official_publisher","href":"https://www.bloomsbury.com/au/as-long-as-the-lemon-trees-grow-9781526648549/", marker: new RegExp("Khawf"), start: new RegExp("^The Syrian revolution") },
  {"id":"3625","editionId":"3784","locale":"en","title":"Boy-Crazy Stacey (The Baby-Sitters Club #8)","author":"Ann M. Martin","isbn":"9780590435093","source":"official_publisher","href":"https://www.scholastic.com/thebabysittersclub/aboutTheBooks.htm", marker: new RegExp("Mary Anne"), start: new RegExp("^Stacey and Mary Anne") },
  {"id":"9969","editionId":"10128","locale":"en","title":"This Lie Will Kill You","author":"Chelsea Pitcher","isbn":"9781534443266","source":"official_publisher","href":"https://www.simonandschuster.com/books/This-Lie-Will-Kill-You/Chelsea-Pitcher/9781534443266", marker: new RegExp("remote mansion"), start: new RegExp("^Five teenagers") },
  {"id":"3789","editionId":"3948","locale":"en","title":"Come as You Are","author":"Amy J. Fetzer","isbn":"9780758216571","source":"official_catalog","href":"https://clc.overdrive.com/clc-35/content/media/147576", marker: new RegExp("Logan Chambliss"), start: new RegExp("^A covert assignment") },
  {"id":"10139","editionId":"10300","locale":"en","title":"Threshing Day","author":"Rebecca Yarros","isbn":"9780349450612","source":"official_publisher","href":"https://www.littlebrown.co.uk/titles/rebecca-yarros/untitled-empyrean-not-book-four/9780349450612/", marker: new RegExp("Thirteen stories"), start: new RegExp("^Thirteen stories") },
  {"id":"1309","editionId":"1316","locale":"nl","title":"Harry Potter en de Orde van de Feniks","author":"J. K. Rowling","isbn":"9789061697008","source":"official_publisher","href":"https://www.deharmonie.nl/titel/harry-potter-en-de-orde-van-de-feniks-2/", marker: new RegExp("Duffelingen"), start: new RegExp("^Tijdens zijn zomervakantie") },
  {"id":"168","editionId":"1311","locale":"en","title":"Harry Potter and the Prisoner of Azkaban","author":"J. K. Rowling","isbn":"9780786222742","source":"official_catalog","href":"https://www.harrypotter.com/discover/books/harry-potter-and-the-prisoner-of-azkaban", marker: new RegExp("Sirius Black"), start: new RegExp("^Harry") },
  {"id":"8027","editionId":"8186","locale":"en","title":"The Death of Truth [Hardcover] Michiko Kakutani","author":"michiko kakutani","isbn":"9780008312787","source":"official_publisher","href":"https://www.penguinrandomhouse.com/books/573029/the-death-of-truth-by-michiko-kakutani/", marker: new RegExp("Hannah Arendt"), start: new RegExp("^Writing in the context") }
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

  test(`recovery3 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery3 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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


// Exercise the corrected display through the real strict-edition loader: the
// clean title must still resolve the independently bound original synopsis.
test('recovery3 8027: clean display and schema preserve the raw edition and its synopsis binding', () => {
  const fixture = editions.find(row => row.id === '8027')!;
  const original = selectedBook(fixture);
  const corrected = withStrictEdition(original, {
    id: fixture.editionId, work_id: fixture.id, title: fixture.title,
    language: 'eng', isbn_13: fixture.isbn, open_library_edition_id: original.openLibraryEditionId!,
  }, 'en')!;
  assert.ok(corrected);
  assert.equal(corrected.title, 'The Death of Truth');
  assert.equal(corrected.author, 'Michiko Kakutani');
  assert.equal(corrected.editionTitle, fixture.title);
  assert.equal(corrected.isbn13, fixture.isbn);
  assert.equal(descriptionBinding(corrected, 'en'), descriptionBinding(original, 'en'));
  const description = getInitialPublicBookDescription(corrected, 'en');
  assert.ok(description);
  assert.deepEqual(description, getInitialPublicBookDescription(original, 'en'));
  assert.match(description.text, fixture.marker);
  assert.equal(publicDescriptionSource(description)?.href, fixture.href);
  assert.match(getBookMetadataDescription(corrected, 'en', description), fixture.start);
  const graph = bookPageJsonLd(corrected, 'en')['@graph'];
  assert.equal(graph.find(row => row['@type'] === 'WebPage')?.name, corrected.title);
  assert.equal(graph.find(row => row['@id'] === 'https://lumisco.re/#edition-' + fixture.editionId)?.name, corrected.title);
  assert.equal(graph.find(row => row['@type'] === 'Person')?.name, corrected.author);
  assert.equal(original.title, fixture.title, 'display correction does not mutate the source record');
});

test('all fifteen recovery summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery3-tests', plugins: [react()],
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
      assert.match(html, edition.marker, edition.id);
      assert.ok(html.includes('href="' + edition.href + '"'), edition.id);
      assert.match(html, /class="description-source"/);
      assert.doesNotMatch(html, /Loading the description|De beschrijving wordt geladen|could not load|kon tijdelijk niet|not available yet|geen geverifieerde|<[^>]+\shidden(?:\s|=|>)/);
    }
  } finally { await vite.close(); }
});
