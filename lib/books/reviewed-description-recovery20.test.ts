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

// Frozen round20 identities, corrected against the separately reviewed catalogue evidence.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "5297",
    "editionId": "5456",
    "locale": "nl",
    "title": "Koppensnellers, uitrangeerders en selecteurs",
    "author": "Stefan Lievens",
    "isbn": "9789034105974",
    "isbn10": null,
    "openLibraryWorkId": "OL26414790W",
    "openLibraryEditionId": "OL35663776M",
    "sourceKey": "9789034105974",
    "source": "official_catalog",
    "href": "https://biblio.ugent.be/publication/8607876",
    "marker": "Pol Coetsier",
    "start": "Pol Coetsier en"
  },
  {
    "id": "7570",
    "editionId": "7729",
    "locale": "en",
    "title": "Law and Legal Information Directory",
    "author": "Laurie J. Fundukian",
    "isbn": "9780787698003",
    "isbn10": null,
    "openLibraryWorkId": "OL27712336W",
    "openLibraryEditionId": "OL11095612M",
    "sourceKey": "9780787698003",
    "source": "official_catalog",
    "href": "https://lawlibrary.arizona.edu/law-library-reference-resources",
    "marker": "nineteenth edition",
    "start": "The nineteenth edition"
  },
  {
    "id": "9368",
    "editionId": "9527",
    "locale": "en",
    "title": "Fatal Deception",
    "author": "Sally Wentworth",
    "isbn": "9780750503211",
    "isbn10": null,
    "openLibraryWorkId": "OL3770471W",
    "openLibraryEditionId": "OL10807049M",
    "sourceKey": "9780750503211",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL10807049M",
    "marker": "Norrie",
    "start": "Norrie has rebuilt"
  },
  {
    "id": "7434",
    "editionId": "7593",
    "locale": "en",
    "title": "Diego Rivera: Illustrious Words, 1886–1921",
    "author": "Diego Rivera",
    "isbn": "9789708021128",
    "isbn10": null,
    "openLibraryWorkId": "OL2156995W",
    "openLibraryEditionId": "OL23167065M",
    "sourceKey": "9789708021128",
    "source": "official_catalog",
    "href": "https://ci.nii.ac.jp/ncid/BA8912454X",
    "marker": "1886–1921",
    "start": "This illustrated exhibition"
  },
  {
    "id": "9937",
    "editionId": "10096",
    "locale": "en",
    "title": "The Broken Link",
    "author": "Yvonne Whittal",
    "isbn": "9780263726503",
    "isbn10": null,
    "openLibraryWorkId": "OL15714082W",
    "openLibraryEditionId": "OL24228997M",
    "sourceKey": "9780263726503",
    "source": "official_catalog",
    "href": "https://openlibrary.org/works/OL15714082W/The_Broken_Link",
    "marker": "Janey",
    "start": "Janey still loves"
  },
  {
    "id": "5566",
    "editionId": "5725",
    "locale": "nl",
    "title": "Viglius van Aytta als hoogleraar te Ingolstadt",
    "author": "J. G. B. Pikkemaat",
    "isbn": "9789071478772",
    "isbn10": null,
    "openLibraryWorkId": "OL13845580W",
    "openLibraryEditionId": "OL23648916M",
    "sourceKey": "9789071478772",
    "source": "official_catalog",
    "href": "https://www.gbv.de/dms/spk/sbb/recht/toc/606081879.pdf",
    "marker": "Viglius van Aytta",
    "start": "J.G.B. Pikkemaat onderzoekt"
  },
  {
    "id": "7666",
    "editionId": "7825",
    "locale": "en",
    "title": "Fertility, Food and Fever",
    "author": "David Henley",
    "isbn": "9789067182096",
    "isbn10": null,
    "openLibraryWorkId": "OL8464207W",
    "openLibraryEditionId": "OL9456769M",
    "sourceKey": "9789067182096",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/Fertility_Food_and_Fever.html?id=5_ZHAAAAMAAJ",
    "marker": "Sulawesi",
    "start": "David Henley examines"
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

  test(`recovery20 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery20 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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


test('all seven recovery summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery20-tests', plugins: [react()],
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

// Independently recorded pre-correction values must not activate the new text.
test('recovery20 rejects the two wrong-book ISBNs and the old imported titles',()=>{
 const stale=[['9937',{isbn13:'9780373708185',isbn10:'0263726509'}],['7666',{isbn13:'9789067181655',isbn10:'906718165X'}],['5297',{editionTitle:'Koppensnellers, uitrangeerders en selecteurs (Jeadhunters and selectors)'}],['5566',{editionTitle:'Viglius van Aytta als hoogleeraar te Ingolstadt'}],['7434',{editionTitle:'Diego Rivera'}]] as const;
 for(const [id,mismatch] of stale){const edition=editions.find(e=>e.id===id)!;assert.equal(getInitialPublicBookDescription({...selectedBook(edition),...mismatch},edition.locale),null,id);}
});
