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

// Frozen identities from the independently captured round12 candidate-audit.json.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "4702",
    "editionId": "4861",
    "locale": "en",
    "title": "Public Secrets",
    "author": "Nora Roberts",
    "isbn": "9781568950556",
    "isbn10": null,
    "sourceKey": "9781568950556",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/155747/public-secrets-by-nora-roberts/",
    "marker": "Emma",
    "start": "Emma McAvoy grows"
  },
  {
    "id": "8931",
    "editionId": "9090",
    "locale": "en",
    "title": "Private Scandals",
    "author": "Nora Roberts",
    "isbn": "9780425190388",
    "isbn10": null,
    "sourceKey": "9780425190388",
    "source": "official_catalog",
    "href": "https://books.google.com/books?id=9Ypg0K-sZhoC",
    "marker": "Deanna",
    "start": "Deanna Reynolds has"
  },
  {
    "id": "1426",
    "editionId": "1489",
    "locale": "en",
    "title": "Sonnets",
    "author": "William Shakespeare",
    "isbn": "9780521075558",
    "isbn10": null,
    "sourceKey": "9780521075558",
    "source": "official_catalog",
    "href": "https://www.folger.edu/explore/shakespeares-works/shakespeares-sonnets/about-shakespeares-sonnets/",
    "marker": "154",
    "start": "Shakespeare's sequence of"
  },
  {
    "id": "1503",
    "editionId": "1600",
    "locale": "en",
    "title": "Richard III",
    "author": "William Shakespeare",
    "isbn": "9781929142156",
    "isbn10": null,
    "sourceKey": "9781929142156",
    "source": "official_catalog",
    "href": "https://www.folger.edu/explore/shakespeares-works/richard-iii/read/",
    "marker": "Richard",
    "start": "Richard, Duke of"
  },
  {
    "id": "1799",
    "editionId": "1949",
    "locale": "en",
    "title": "Fantastic Mr. Fox (Windrush)",
    "author": "Roald Dahl",
    "isbn": "9781850899808",
    "isbn10": null,
    "sourceKey": "9781850899808",
    "source": "official_publisher",
    "href": "https://shop.roalddahlmuseum.org/products/fantastic-mr-fox-paperback",
    "marker": "Boggis",
    "start": "Three farmers, Boggis,"
  },
  {
    "id": "1830",
    "editionId": "1984",
    "locale": "en",
    "title": "James and the Giant Peach",
    "author": "Roald Dahl",
    "isbn": "9781557361554",
    "isbn10": null,
    "sourceKey": "9781557361554",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/289651/james-and-the-giant-peach-by-roald-dahl/9780451480798/",
    "marker": "James",
    "start": "After losing his"
  },
  {
    "id": "1950",
    "editionId": "2132",
    "locale": "en",
    "title": "Romeo and Juliet",
    "author": "William Shakespeare",
    "isbn": "9780197290392",
    "isbn10": null,
    "sourceKey": "9780197290392",
    "source": "official_catalog",
    "href": "https://www.folger.edu/explore/shakespeares-works/romeo-and-juliet/read/",
    "marker": "Montagues",
    "start": "The Montagues and"
  },
  {
    "id": "2074",
    "editionId": "2275",
    "locale": "en",
    "title": "Henry V",
    "author": "William Shakespeare",
    "isbn": "9780521063579",
    "isbn10": null,
    "sourceKey": "9780521063579",
    "source": "official_catalog",
    "href": "https://www.folger.edu/explore/shakespeares-works/henry-v/read/",
    "marker": "French",
    "start": "Having become king"
  },
  {
    "id": "2803",
    "editionId": "2962",
    "locale": "en",
    "title": "Maximum Security (CHERUB)",
    "author": "Robert Muchamore",
    "isbn": "9780340884355",
    "isbn10": null,
    "sourceKey": "9780340884355",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.net/books/Maximum-Security/Robert-Muchamore/CHERUB/9781442413627",
    "marker": "Arizona",
    "start": "James's third CHERUB"
  },
  {
    "id": "4149",
    "editionId": "4308",
    "locale": "en",
    "title": "Wishtree",
    "author": "Katherine Applegate",
    "isbn": "9781250247063",
    "isbn10": null,
    "sourceKey": "9781250247063",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9781250233899/wishtree/",
    "marker": "Red",
    "start": "Red is an"
  },
  {
    "id": "4183",
    "editionId": "4342",
    "locale": "en",
    "title": "God of Wrath",
    "author": "Rina Kent",
    "isbn": "9781464237263",
    "isbn10": null,
    "sourceKey": "9781464237263",
    "source": "official_publisher",
    "href": "https://www.sourcebooks.com/9781464237263-god-of-wrath-standard-edition-tp.html",
    "marker": "Cecily",
    "start": "Cecily Knight enters"
  },
  {
    "id": "4340",
    "editionId": "4499",
    "locale": "en",
    "title": "Endless Night",
    "author": "Agatha Christie",
    "isbn": "9780671811297",
    "isbn10": null,
    "sourceKey": "9780671811297",
    "source": "official_publisher",
    "href": "https://www.agathachristie.com/en/stories/endless-night",
    "marker": "Michael",
    "start": "Michael Rogers imagines"
  },
  {
    "id": "4379",
    "editionId": "4538",
    "locale": "en",
    "title": "Winter",
    "author": "Marissa Meyer",
    "isbn": "9780312642983",
    "isbn10": null,
    "sourceKey": "9780312642983",
    "source": "official_publisher",
    "href": "https://www.marissameyer.com/books/winter/",
    "marker": "Levana",
    "start": "Princess Winter is"
  },
  {
    "id": "632",
    "editionId": "632",
    "locale": "en",
    "title": "Five Little Pigs",
    "author": "Agatha Christie",
    "isbn": "9781579127343",
    "isbn10": null,
    "sourceKey": "9781579127343",
    "source": "official_publisher",
    "href": "https://www.agathachristie.com/en/stories/five-little-pigs",
    "marker": "Caroline",
    "start": "Caroline Crale was"
  },
  {
    "id": "653",
    "editionId": "653",
    "locale": "en",
    "title": "Evil Under the Sun",
    "author": "Agatha Christie",
    "isbn": "9781579126285",
    "isbn10": null,
    "sourceKey": "9781579126285",
    "source": "official_publisher",
    "href": "https://www.agathachristie.com/en/stories/evil-under-the-sun",
    "marker": "Arlena",
    "start": "Hercule Poirot's seaside"
  },
  {
    "id": "8400",
    "editionId": "8559",
    "locale": "en",
    "title": "Bittersweet Passion",
    "author": "Lynne Graham",
    "isbn": "9780373170159",
    "isbn10": null,
    "sourceKey": "9780373170159",
    "source": "official_publisher",
    "href": "https://www.lynnegraham.com/book/bittersweet-passion/",
    "marker": "Claire",
    "start": "Claire Fletcher's grandfather"
  },
  {
    "id": "8541",
    "editionId": "8700",
    "locale": "en",
    "title": "The Other Woman",
    "author": "Jessica Steele",
    "isbn": "9780373023707",
    "isbn10": null,
    "sourceKey": "9780373023707",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL10691179M",
    "marker": "Georgina",
    "start": "Georgina's new boss,"
  },
  {
    "id": "8636",
    "editionId": "8795",
    "locale": "en",
    "title": "Immortal in death",
    "author": "Nora Roberts",
    "isbn": "9780753173817",
    "isbn10": null,
    "sourceKey": "9780753173817",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/300633/immortal-in-death-by-j-d-robb/",
    "marker": "Eve",
    "start": "A prominent model"
  },
  {
    "id": "8758",
    "editionId": "8917",
    "locale": "en",
    "title": "Towards Zero",
    "author": "Agatha Christie",
    "isbn": "9780671810092",
    "isbn10": null,
    "sourceKey": "9780671810092",
    "source": "official_publisher",
    "href": "https://www.agathachristie.com/en/stories/towards-zero",
    "marker": "Gull",
    "start": "An unsuccessful suicide"
  },
  {
    "id": "8781",
    "editionId": "8940",
    "locale": "en",
    "title": "The Arabian Mistress",
    "author": "Lynne Graham",
    "isbn": "9780263824896",
    "isbn10": null,
    "sourceKey": "9780263824896",
    "source": "official_publisher",
    "href": "https://www.lynnegraham.com/book/the-arabian-mistress/",
    "marker": "Faye",
    "start": "Faye has not"
  },
  {
    "id": "8800",
    "editionId": "8959",
    "locale": "en",
    "title": "Empire of Sin",
    "author": "Rina Kent",
    "isbn": "9781685450656",
    "isbn10": null,
    "sourceKey": "9781685450656",
    "source": "official_publisher",
    "href": "https://www.rinakent.com/throne-duet/empire-of-sin",
    "marker": "Knox",
    "start": "An anonymous encounter"
  },
  {
    "id": "8991",
    "editionId": "9150",
    "locale": "en",
    "title": "The killing",
    "author": "Robert Muchamore",
    "isbn": "9780329920012",
    "isbn10": null,
    "sourceKey": "9780329920012",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/The-Killing/Robert-Muchamore/CHERUB/9781416999430",
    "marker": "Leon",
    "start": "A small-time criminal"
  },
  {
    "id": "9162",
    "editionId": "9321",
    "locale": "en",
    "title": "Distrust Her Shadow",
    "author": "Jessica Steele",
    "isbn": "9780373025558",
    "isbn10": null,
    "sourceKey": "9780373025558",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL10691327M",
    "marker": "Darcy",
    "start": "Darcy agrees to"
  },
  {
    "id": "9184",
    "editionId": "9343",
    "locale": "en",
    "title": "Devil in Disguise",
    "author": "Jessica Steele",
    "isbn": "9780263741148",
    "isbn10": null,
    "sourceKey": "9780263741148",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL14977121M",
    "marker": "Clare",
    "start": "Clare Harper's time"
  },
  {
    "id": "9236",
    "editionId": "9395",
    "locale": "en",
    "title": "An Arabian Marriage",
    "author": "Lynne Graham",
    "isbn": "9780263174359",
    "isbn10": null,
    "sourceKey": "9780263174359",
    "source": "official_publisher",
    "href": "https://www.lynnegraham.com/book/an-arabian-marriage/",
    "marker": "Freddy",
    "start": "Frederica Sutton, known"
  },
  {
    "id": "9358",
    "editionId": "9517",
    "locale": "en",
    "title": "Dishonest Woman",
    "author": "Jessica Steele",
    "isbn": "9780373025022",
    "isbn10": null,
    "sourceKey": "9780373025022",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL10691288M",
    "marker": "Kimberley",
    "start": "Kimberley expects her"
  },
  {
    "id": "9406",
    "editionId": "9565",
    "locale": "en",
    "title": "Rise of a Queen",
    "author": "Rina Kent",
    "isbn": "9781685450151",
    "isbn10": null,
    "sourceKey": "9781685450151",
    "source": "official_publisher",
    "href": "https://www.rinakent.com/royal-elite-series/rise-of-a-queen",
    "marker": "Aurora",
    "start": "Aurora wants to"
  },
  {
    "id": "9822",
    "editionId": "9981",
    "locale": "en",
    "title": "The sleepwalker",
    "author": "Robert Muchamore",
    "isbn": "9780340931837",
    "isbn10": null,
    "sourceKey": "9780340931837",
    "source": "official_publisher",
    "href": "https://www.hachette.co.uk/titles/robert-muchamore/cherub-the-sleepwalker/9780340931837/",
    "marker": "Lauren",
    "start": "An airliner explodes"
  },
  {
    "id": "9930",
    "editionId": "10089",
    "locale": "en",
    "title": "How to Fight a Dragon’s Fury",
    "author": "Cressida Cowell",
    "isbn": "9781444927535",
    "isbn10": null,
    "sourceKey": "9781444927535",
    "source": "official_publisher",
    "href": "https://www.cressidacowell.co.uk/titles/cressida-cowell/how-to-train-your-dragon-how-to-fight-a-dragons-fury/9781444927535/",
    "marker": "Hiccup",
    "start": "On the Doomsday"
  },
  {
    "id": "9946",
    "editionId": "10105",
    "locale": "en",
    "title": "Throne of Power",
    "author": "Rina Kent",
    "isbn": "9781685450762",
    "isbn10": null,
    "sourceKey": "9781685450762",
    "source": "official_publisher",
    "href": "https://www.rinakent.com/villain-series/throne-of-power",
    "marker": "Kyle",
    "start": "A woman pursuing"
  },
  {
    "id": "5109",
    "editionId": "5268",
    "locale": "nl",
    "title": "Voetnoot",
    "author": "Arnon Grunberg",
    "isbn": "9789038894843",
    "isbn10": null,
    "sourceKey": "9789038894843",
    "source": "official_publisher",
    "href": "https://www.singeluitgeverijen.nl/nijgh-van-ditmar/boek/voetnoot-eerste-verzameling/",
    "marker": "eerste",
    "start": "Deze eerste verzameling"
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

  test(`recovery12 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery12 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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


test('all thirty-one recovery summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery12-tests', plugins: [react()],
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

