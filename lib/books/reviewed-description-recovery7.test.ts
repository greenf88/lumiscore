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

// Frozen identities from the independently captured round7 candidate-audit.json.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "2219",
    "editionId": "2435",
    "locale": "en",
    "title": "Finale",
    "author": "Stephanie Garber",
    "isbn": "9781473666764",
    "sourceKey": "9781473666764",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9781250157669/finale/",
    "marker": "freed Fates",
    "start": "Tella must decide"
  },
  {
    "id": "135",
    "editionId": "135",
    "locale": "en",
    "title": "The Eye of the World",
    "author": "Robert Jordan",
    "isbn": "9780812579956",
    "sourceKey": "9780812579956",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9780312850098/theeyeoftheworld/",
    "marker": "Two Rivers",
    "start": "Rand al'Thor"
  },
  {
    "id": "1900",
    "editionId": "2074",
    "locale": "en",
    "title": "The Fires of Heaven",
    "author": "Robert Jordan",
    "isbn": "9780812550306",
    "sourceKey": "9780812550306",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9780765334640/thefiresofheaven/",
    "marker": "Four of the Forsaken",
    "start": "Rand al'Thor's"
  },
  {
    "id": "9770",
    "editionId": "9929",
    "locale": "en",
    "title": "Monstrous Regiment",
    "author": "Terry Pratchett",
    "isbn": "9780062307415",
    "sourceKey": "9780062307415",
    "source": "official_catalog",
    "href": "https://www.terrypratchettbooks.com/books/monstrous-regiment/",
    "marker": "Polly Perks",
    "start": "Polly Perks"
  },
  {
    "id": "1425",
    "editionId": "1487",
    "locale": "en",
    "title": "Fall of Giants",
    "author": "Ken Follett",
    "isbn": "9781509848515",
    "sourceKey": "9781509848515",
    "source": "official_publisher",
    "href": "https://www.panmacmillan.com/authors/ken-follett/fall-of-giants/9781035034246",
    "marker": "Billy Williams",
    "start": "Billy Williams"
  },
  {
    "id": "2848",
    "editionId": "3007",
    "locale": "en",
    "title": "Night Over Water",
    "author": "Ken Follett",
    "isbn": "9780451174109",
    "sourceKey": "9780451174109",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/293259/night-over-water-by-ken-follett/9780451211477/",
    "marker": "Pan Am Clipper",
    "start": "In September"
  },
  {
    "id": "596",
    "editionId": "596",
    "locale": "en",
    "title": "Eye of the Needle",
    "author": "Ken Follett",
    "isbn": "9780517454152",
    "sourceKey": "9780517454152",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/318741/eye-of-the-needle-by-ken-follett/9780143132042/",
    "marker": "German agent",
    "start": "A German agent"
  },
  {
    "id": "5108",
    "editionId": "5267",
    "locale": "nl",
    "title": "Het bestand",
    "author": "Arnon Grunberg",
    "isbn": "9789038899886",
    "sourceKey": "9789038899886",
    "source": "official_publisher",
    "href": "https://www.singeluitgeverijen.nl/nijgh-van-ditmar/boek/het-bestand/",
    "marker": "Banri Watanuki",
    "start": "Lillian ervaart"
  },
  {
    "id": "5065",
    "editionId": "5224",
    "locale": "nl",
    "title": "Het tweede bestand",
    "author": "Arnon Grunberg",
    "isbn": "9789038804125",
    "sourceKey": "9789038804125",
    "source": "official_publisher",
    "href": "https://www.singeluitgeverijen.nl/nijgh-van-ditmar/boek/het-tweede-bestand/",
    "marker": "Christus II",
    "start": "Lillian werkt"
  },
  {
    "id": "5067",
    "editionId": "5226",
    "locale": "nl",
    "title": "Het verraad van de tekst",
    "author": "Arnon Grunberg",
    "isbn": "9789038892979",
    "sourceKey": "9789038892979",
    "source": "official_catalog",
    "href": "https://www.arnongrunberg.com/words/1-netherlands-belgium/4-other/489-het-verraad-van-de-tekst",
    "marker": "Universiteit Leiden",
    "start": "Arnon Grunberg onderzoekt"
  },
  {
    "id": "9854",
    "editionId": "10013",
    "locale": "en",
    "title": "Son of the Mob",
    "author": "Gordon Korman",
    "isbn": "9780786815937",
    "sourceKey": "9780786815937",
    "source": "official_catalog",
    "href": "https://gordonkorman.com/the-books/teen/the-son-of-the-mob-novels",
    "marker": "Vince Luca",
    "start": "Vince Luca"
  },
  {
    "id": "2756",
    "editionId": "2915",
    "locale": "en",
    "title": "Wyrd Sisters",
    "author": "Terry Pratchett",
    "isbn": "9780061020667",
    "sourceKey": "9780061020667",
    "source": "official_catalog",
    "href": "https://www.terrypratchettbooks.com/books/wyrd-sisters/",
    "marker": "Granny Weatherwax",
    "start": "A king has"
  },
  {
    "id": "2201",
    "editionId": "2413",
    "locale": "en",
    "title": "World without end",
    "author": "Ken Follett",
    "isbn": "9780525950073",
    "sourceKey": "9780525950073",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/292256/world-without-end-by-ken-follett/9780451224996/",
    "marker": "Black Death",
    "start": "Two centuries"
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

  test(`recovery7 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery7 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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


test('all thirteen recovery summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery7-tests', plugins: [react()],
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
