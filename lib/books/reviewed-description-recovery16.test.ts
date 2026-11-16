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

// Frozen identities from the independently captured round16 candidate-audit.json.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "7801",
    "editionId": "7960",
    "locale": "en",
    "title": "Against the Grain",
    "author": "James C. Scott",
    "isbn": "9780300182910",
    "isbn10": null,
    "sourceKey": "9780300182910",
    "source": "official_publisher",
    "href": "https://yalebooks.yale.edu/book/9780300240214/against-the-grain/",
    "marker": "grain cultivation",
    "start": "James C. Scott"
  },
  {
    "id": "7928",
    "editionId": "8087",
    "locale": "en",
    "title": "The Romanovs",
    "author": "Simon Sebag-Montefiore",
    "isbn": "9780307266521",
    "isbn10": null,
    "sourceKey": "9780307266521",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/116185/the-romanovs-by-simon-sebag-montefiore/",
    "marker": "Court intrigue",
    "start": "Simon Sebag Montefiore"
  },
  {
    "id": "4277",
    "editionId": "4436",
    "locale": "en",
    "title": "Nineteen Minutes",
    "author": "Jodi Picoult",
    "isbn": "9781444754360",
    "isbn10": null,
    "sourceKey": "9781444754360",
    "source": "official_publisher",
    "href": "https://www.hachette.co.uk/titles/jodi-picoult/nineteen-minutes/9781444754360/",
    "marker": "town of Sterling",
    "start": "A school shooting"
  },
  {
    "id": "1402",
    "editionId": "1450",
    "locale": "en",
    "title": "Les Miserables",
    "author": "Victor Hugo",
    "isbn": "9780848805357",
    "isbn10": null,
    "sourceKey": "9780848805357",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/84269/les-miserables-by-victor-hugo/9780679643333/",
    "marker": "Jean Valjean",
    "start": "Jean Valjean tries"
  },
  {
    "id": "7248",
    "editionId": "7407",
    "locale": "en",
    "title": "Secrets of The lost symbol",
    "author": "John Michael Greer",
    "isbn": "9780738721699",
    "isbn10": null,
    "sourceKey": "9780738721699",
    "source": "official_publisher",
    "href": "https://www.llewellyn.com/journal/article/2075",
    "marker": "unauthorised companion",
    "start": "John Michael Greer"
  },
  {
    "id": "7185",
    "editionId": "7344",
    "locale": "en",
    "title": "Surviving Hitler",
    "author": "Andrea Warren",
    "isbn": "9781435264922",
    "isbn10": null,
    "sourceKey": "9781435264922",
    "source": "official_publisher",
    "href": "https://www.andreawarren.com/surviving-hitler",
    "marker": "Jack Mandelbaum",
    "start": "Andrea Warren tells"
  },
  {
    "id": "7611",
    "editionId": "7770",
    "locale": "en",
    "title": "Dust Bowl",
    "author": "Donald Worster",
    "isbn": "9780195032123",
    "isbn10": null,
    "sourceKey": "9780195032123",
    "source": "official_catalog",
    "href": "https://agris.fao.org/search/en/providers/122535/records/65ddf9b063b8185d9ca64330",
    "marker": "two affected communities",
    "start": "Donald Worster examines"
  },
  {
    "id": "8901",
    "editionId": "9060",
    "locale": "en",
    "title": "Out of Darkness",
    "author": "Ashley Hope Pérez",
    "isbn": "9780823445035",
    "isbn10": null,
    "sourceKey": "9780823445035",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/645341/out-of-darkness-by-by-ashley-hope-perez/9780823445035/",
    "marker": "Naomi Vargas",
    "start": "In New London,"
  },
  {
    "id": "1307",
    "editionId": "1309",
    "locale": "en",
    "title": "Harry Potter and the Chamber of Secrets",
    "author": "J. K. Rowling",
    "isbn": "9780439064866",
    "isbn10": null,
    "sourceKey": "9780439064866",
    "source": "official_publisher",
    "href": "https://www.jkrowling.com/book/harry-potter-chamber-secrets/",
    "marker": "house-elf named Dobby",
    "start": "Harry Potter wants"
  },
  {
    "id": "9797",
    "editionId": "9956",
    "locale": "en",
    "title": "Beware!",
    "author": "Robert Lawrence Stine",
    "isbn": "9780066238425",
    "isbn10": null,
    "sourceKey": "9780066238425",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/Beware.html?id=Kd3guGuzbmcC",
    "marker": "selector as well as a contributor",
    "start": "R. L. Stine"
  },
  {
    "id": "3269",
    "editionId": "3428",
    "locale": "nl",
    "title": "Een spoor van vernieling",
    "author": "Tim Weiner",
    "isbn": "9789023426684",
    "isbn10": null,
    "sourceKey": "9789023426684",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/188076/legacy-of-ashes-national-book-award-winner-by-tim-weiner/9780307455628/",
    "marker": "Nederlandse vertaling van Legacy of Ashes",
    "start": "Tim Weiner onderzoekt"
  },
  {
    "id": "6488",
    "editionId": "6647",
    "locale": "nl",
    "title": "De gentleman-bandiet",
    "author": "Marije Plomp",
    "isbn": "9789085065456",
    "isbn10": null,
    "sourceKey": "9789085065456",
    "source": "official_catalog",
    "href": "https://brill.com/edcollbook-oa/book/edcoll/9789004253513/9789004253513_webready_content_text.pdf",
    "marker": "jaren 1930–1960",
    "start": "Marije Plomp brengt"
  },
  {
    "id": "4886",
    "editionId": "5045",
    "locale": "en",
    "title": "A Swim in a Pond in the Rain",
    "author": "George Saunders",
    "isbn": "9781984856029",
    "isbn10": null,
    "sourceKey": "9781984856029",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/609280/a-swim-in-a-pond-in-the-rain-by-george-saunders/",
    "marker": "seven Russian short stories",
    "start": "George Saunders invites"
  },
  {
    "id": "8713",
    "editionId": "8872",
    "locale": "en",
    "title": "The Summer I Died",
    "author": "Ryan C. Thomas",
    "isbn": "9781897217405",
    "isbn10": null,
    "sourceKey": "9781897217405",
    "source": "official_publisher",
    "href": "https://www.ryancthomas.com/books",
    "marker": "Bobcat Mountain",
    "start": "Roger Huntington returns"
  },
  {
    "id": "6686",
    "editionId": "6845",
    "locale": "en",
    "title": "Charlie Hernández and the League of Shadows",
    "author": "Ryan Calejo",
    "isbn": "9781534426603",
    "isbn10": null,
    "sourceKey": "9781534426603",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/Charlie-Hernandez-the-League-of-Shadows/Ryan-Calejo/Charlie-Hernandez/9781534426597",
    "marker": "Violet Rey",
    "start": "Charlie Hernández has"
  },
  {
    "id": "8326",
    "editionId": "8485",
    "locale": "en",
    "title": "Life expectancy",
    "author": "Dean Koontz",
    "isbn": "9780007796649",
    "isbn10": null,
    "sourceKey": "9780007796649",
    "source": "official_publisher",
    "href": "https://www.deankoontz.com/book/life-expectancy/",
    "marker": "five dates",
    "start": "On the night"
  },
  {
    "id": "6756",
    "editionId": "6915",
    "locale": "en",
    "title": "LAST WATCH (Night Watch)",
    "author": "Sergeĭ Lukʹi͡anenko",
    "isbn": "9781401309275",
    "isbn10": null,
    "sourceKey": "9781401309275",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/393378/the-last-watch-by-sergei-lukyanenko/9781409036029",
    "marker": "tourist in Edinburgh",
    "start": "The death of"
  },
  {
    "id": "5714",
    "editionId": "5873",
    "locale": "nl",
    "title": "Gent, Rabot",
    "author": "Bart de Wilde",
    "isbn": "9789020970579",
    "isbn10": null,
    "sourceKey": "9789020970579",
    "source": "official_catalog",
    "href": "https://openjournals.ugent.be/vmd/article/76088/galley/200190/view/",
    "marker": "Gentse Rabotwijk",
    "start": "Bart De Wilde"
  },
  {
    "id": "7482",
    "editionId": "7641",
    "locale": "en",
    "title": "Too Late to Say Goodbye",
    "author": "Ann Rule",
    "isbn": "9781597224116",
    "isbn10": null,
    "sourceKey": "9781597224116",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/Too-Late-to-Say-Goodbye/Ann-Rule/9781668276723",
    "marker": "Jenn Corbin and Dorothy Hearn",
    "start": "Ann Rule investigates"
  },
  {
    "id": "9856",
    "editionId": "10015",
    "locale": "en",
    "title": "Lily the Lost Puppy (Puppy Friends)",
    "author": "Jenny Dale",
    "isbn": "9780689834042",
    "isbn10": null,
    "sourceKey": "9780689834042",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/Lily_the_Lost_Puppy.html?id=9eujmgp_l44C",
    "marker": "accidentally left behind",
    "start": "Lily's family is"
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

  test(`recovery16 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery16 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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


test('all twenty recovery summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery16-tests', plugins: [react()],
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
