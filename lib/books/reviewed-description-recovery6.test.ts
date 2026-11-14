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

// Frozen identities from the independently captured round6 candidate-audit.json.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "10138",
    "editionId": "10298",
    "locale": "en",
    "title": "The Mirror of Infinite Endings",
    "author": "Stephanie Garber",
    "isbn": "9781250462039",
    "sourceKey": "9781250462039",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9781250462039/themirrorofinfiniteendings/",
    "marker": "companion novella",
    "start": "Jacks and Evangeline"
  },
  {
    "id": "1519",
    "editionId": "1623",
    "locale": "en",
    "title": "A Curse for True Love",
    "author": "Stephanie Garber",
    "isbn": "9781250851208",
    "sourceKey": "9781250851208",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9781250851208/acursefortruelove/",
    "marker": "missing memories",
    "start": "Evangeline Fox"
  },
  {
    "id": "1914",
    "editionId": "2090",
    "locale": "en",
    "title": "Reckless",
    "author": "Lauren Roberts",
    "isbn": "9781398530126",
    "sourceKey": "9781398530126",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.co.uk/books/Reckless/Lauren-Roberts/The-Powerless-Trilogy/9781398530126",
    "marker": "Enforcer",
    "start": "Paedyn Gray"
  },
  {
    "id": "1915",
    "editionId": "2091",
    "locale": "en",
    "title": "Fearless",
    "author": "Lauren Roberts",
    "isbn": "9781665955461",
    "sourceKey": "9781665955461",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/Fearless/Lauren-Roberts/The-Powerless-Trilogy/9781665955461",
    "marker": "concluding novel",
    "start": "Paedyn and Kai"
  },
  {
    "id": "2699",
    "editionId": "2858",
    "locale": "en",
    "title": "Inheritance",
    "author": "Christopher Paolini",
    "isbn": "9780307976642",
    "sourceKey": "9780307976642",
    "source": "official_catalog",
    "href": "https://www.paolini.net/works/",
    "marker": "Galbatorix",
    "start": "Eragon and his"
  },
  {
    "id": "1620",
    "editionId": "1750",
    "locale": "en",
    "title": "Crossroads of Twilight (The Wheel of Time, Number 10)",
    "author": "Robert Jordan",
    "isbn": "9780681112438",
    "sourceKey": "9780681112438",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9780765337818/crossroadsoftwilight/",
    "marker": "Daughter of the Nine Moons",
    "start": "Mat tries"
  },
  {
    "id": "1892",
    "editionId": "2066",
    "locale": "en",
    "title": "Lord of Chaos (The Wheel of Time, Book 6)",
    "author": "Robert Jordan",
    "isbn": "9780613176392",
    "sourceKey": "9780613176392",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9781250251978/lordofchaos/",
    "marker": "Aes Sedai",
    "start": "Rand al'Thor"
  },
  {
    "id": "8467",
    "editionId": "8626",
    "locale": "en",
    "title": "Going postal",
    "author": "Terry Pratchett",
    "isbn": "9780060502935",
    "sourceKey": "9780060502935",
    "source": "official_catalog",
    "href": "https://www.terrypratchettbooks.com/books/going-postal/",
    "marker": "Moist von Lipwig",
    "start": "Condemned conman"
  },
  {
    "id": "2114",
    "editionId": "2316",
    "locale": "en",
    "title": "Captains Courageous (Lake Illustrated Classics, Collection 3)",
    "author": "Rudyard Kipling",
    "isbn": "9780785406945",
    "sourceKey": "9780785406945",
    "source": "official_catalog",
    "href": "https://www.gutenberg.org/files/2186/2186-h/2186-h.htm",
    "marker": "Harvey Cheyne",
    "start": "Harvey Cheyne"
  },
  {
    "id": "2118",
    "editionId": "2320",
    "locale": "en",
    "title": "Kim",
    "author": "Rudyard Kipling",
    "isbn": "9789380703077",
    "sourceKey": "9789380703077",
    "source": "official_publisher",
    "href": "https://www.panmacmillan.com/authors/rudyard-kipling/kim/9781509842360",
    "marker": "Tibetan lama",
    "start": "Kim, an orphan"
  },
  {
    "id": "2206",
    "editionId": "2418",
    "locale": "en",
    "title": "Edge Of Eternity",
    "author": "Ken Follett",
    "isbn": "9780606394543",
    "sourceKey": "9780606394543",
    "source": "official_publisher",
    "href": "https://www.panmacmillan.com/authors/ken-follett/edge-of-eternity/9781035034260",
    "marker": "Cold War",
    "start": "Five interconnected"
  },
  {
    "id": "2493",
    "editionId": "2729",
    "locale": "en",
    "title": "Winter of the World",
    "author": "Ken Follett",
    "isbn": "9780230710108",
    "sourceKey": "9780230710108",
    "source": "official_catalog",
    "href": "https://ken-follett.com/books/winter-of-the-world-2/",
    "marker": "1933",
    "start": "Five families"
  },
  {
    "id": "2251",
    "editionId": "2468",
    "locale": "en",
    "title": "Evening and the Morning",
    "author": "Ken Follett",
    "isbn": "9780525954989",
    "sourceKey": "9780525954989",
    "source": "official_catalog",
    "href": "https://ken-follett.com/books/the-evening-and-the-morning/",
    "marker": "boatbuilder",
    "start": "In England"
  },
  {
    "id": "3505",
    "editionId": "3664",
    "locale": "nl",
    "title": "Code Rebecca",
    "author": "Ken Follett",
    "isbn": "9789026974939",
    "sourceKey": "9789026974939",
    "source": "official_catalog",
    "href": "https://ken-follett.com/books/the-key-to-rebecca/",
    "marker": "Alex Wolff",
    "start": "In Caïro"
  },
  {
    "id": "5021",
    "editionId": "5180",
    "locale": "nl",
    "title": "Het Modigliani-schandaal",
    "author": "Ken Follett",
    "isbn": "9789044924299",
    "sourceKey": "9789044924299",
    "source": "official_catalog",
    "href": "https://ken-follett.com/books/the-modigliani-scandal/",
    "marker": "Dee Sleign",
    "start": "Kunsthistorica Dee"
  },
  {
    "id": "1654",
    "editionId": "1790",
    "locale": "nl",
    "title": "Figuranten",
    "author": "Arnon Grunberg",
    "isbn": "9789038826929",
    "sourceKey": "9789038826929",
    "source": "official_publisher",
    "href": "https://www.singeluitgeverijen.nl/nijgh-van-ditmar/boek/figuranten/",
    "marker": "Operatie Brando",
    "start": "Elvira Lopez"
  },
  {
    "id": "1724",
    "editionId": "1873",
    "locale": "nl",
    "title": "Het aapje dat geluk pakt",
    "author": "Arnon Grunberg",
    "isbn": "9789038827162",
    "sourceKey": "9789038827162",
    "source": "official_publisher",
    "href": "https://www.singeluitgeverijen.nl/nijgh-van-ditmar/boek/het-aapje-dat-geluk-pakt/",
    "marker": "Malena",
    "start": "Jean Baptist"
  },
  {
    "id": "3168",
    "editionId": "3327",
    "locale": "nl",
    "title": "De overgave",
    "author": "Arthur Japin",
    "isbn": "9789029565295",
    "sourceKey": "9789029565295",
    "source": "official_catalog",
    "href": "https://www.arthurjapin.nl/de-overgave",
    "marker": "familie Parker",
    "start": "In Texas"
  },
  {
    "id": "4481",
    "editionId": "4640",
    "locale": "en",
    "title": "Play it as it lays",
    "author": "Joan Didion",
    "isbn": "9780374234447",
    "sourceKey": "9780374234447",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9780374608774/playitasitlays/",
    "marker": "Mojave Desert",
    "start": "Joan Didion places"
  },
  {
    "id": "2265",
    "editionId": "2482",
    "locale": "en",
    "title": "The Dip",
    "author": "Seth Godin",
    "isbn": "9781591841661",
    "sourceKey": "9781591841661",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/300938/the-dip-by-seth-godin/",
    "marker": "temporary dip",
    "start": "Seth Godin asks"
  },
  {
    "id": "2266",
    "editionId": "2483",
    "locale": "en",
    "title": "Linchpin",
    "author": "Seth Godin",
    "isbn": "9781591843160",
    "sourceKey": "9781591843160",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/305744/linchpin-by-seth-godin/9781591844099/",
    "marker": "creative initiative",
    "start": "Seth Godin argues"
  },
  {
    "id": "2761",
    "editionId": "2920",
    "locale": "en",
    "title": "The Host",
    "author": "Stephenie Meyer",
    "isbn": "9780316034111",
    "sourceKey": "9780316034111",
    "source": "official_catalog",
    "href": "https://stepheniemeyer.com/project/the-host-book/",
    "marker": "Wanderer",
    "start": "An alien"
  },
  {
    "id": "8794",
    "editionId": "8953",
    "locale": "en",
    "title": "The Short Second Life of Bree Tanner",
    "author": "Stephenie Meyer",
    "isbn": "9780316243988",
    "sourceKey": "9780316243988",
    "source": "official_catalog",
    "href": "https://stepheniemeyer.com/2010/03/surprise-i-have-a-new-book-coming-out/",
    "marker": "Eclipse",
    "start": "Bree Tanner"
  },
  {
    "id": "4424",
    "editionId": "4583",
    "locale": "en",
    "title": "These Violent Delights",
    "author": "Chloe Gong",
    "isbn": "9781534457713",
    "sourceKey": "9781534457713",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/These-Violent-Delights/Chloe-Gong/These-Violent-Delights-Duet/9781534457713",
    "marker": "Juliette Cai",
    "start": "In Shanghai"
  },
  {
    "id": "7065",
    "editionId": "7224",
    "locale": "en",
    "title": "Find Your Why",
    "author": "Simon Sinek",
    "isbn": "9780143111726",
    "sourceKey": "9780143111726",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/539465/find-your-why-by-simon-sinek-with-david-mead-and-peter-docker/",
    "marker": "Peter Docker",
    "start": "Simon Sinek, David"
  },
  {
    "id": "2258",
    "editionId": "2475",
    "locale": "en",
    "title": "Leaders Eat Last: Why Some Teams Pull Together and Others Don't",
    "author": "Simon Sinek",
    "isbn": "9781591845324",
    "sourceKey": "9781591845324",
    "source": "official_catalog",
    "href": "https://simonsinek.com/books/leaders-eat-last",
    "marker": "cooperation",
    "start": "Simon Sinek examines"
  },
  {
    "id": "8563",
    "editionId": "8722",
    "locale": "en",
    "title": "I Want to Go Home!",
    "author": "Gordon Korman",
    "isbn": "9780590337656",
    "sourceKey": "9780590337656",
    "source": "official_catalog",
    "href": "https://gordonkorman.com/the-books/classics/i-want-to-go-home",
    "marker": "Rudy Miller",
    "start": "Rudy Miller"
  },
  {
    "id": "2539",
    "editionId": "2794",
    "locale": "en",
    "title": "Crown of Swords",
    "author": "Robert Jordan",
    "isbn": "9780765336460",
    "sourceKey": "9780765336460",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9780765336460/acrownofswords/",
    "marker": "Sammael",
    "start": "Rand al'Thor"
  },
  {
    "id": "8247",
    "editionId": "8406",
    "locale": "en",
    "title": "Dragons at Crumbling Castle",
    "author": "Terry Pratchett",
    "isbn": "9780544466593",
    "sourceKey": "9780544466593",
    "source": "official_catalog",
    "href": "https://www.terrypratchettbooks.com/books/dragons-at-crumbling-castle/",
    "marker": "fourteen stories",
    "start": "Dragons have appeared"
  },
  {
    "id": "2202",
    "editionId": "2414",
    "locale": "en",
    "title": "A Column of Fire",
    "author": "Ken Follett",
    "isbn": "9781447278757",
    "sourceKey": "9781447278757",
    "source": "official_catalog",
    "href": "https://ken-follett.com/books/a-column-of-fire/",
    "marker": "Ned Willard",
    "start": "Ned Willard"
  },
  {
    "id": "5117",
    "editionId": "5276",
    "locale": "nl",
    "title": "De mensendokter",
    "author": "Arnon Grunberg",
    "isbn": "9789038894393",
    "sourceKey": "9789038894393",
    "source": "official_publisher",
    "href": "https://www.singeluitgeverijen.nl/nijgh-van-ditmar/boek/de-mensendokter/",
    "marker": "Vrij Nederland",
    "start": "Arnon Grunberg beantwoordt"
  },
  {
    "id": "9483",
    "editionId": "9642",
    "locale": "en",
    "title": "Unteachables",
    "author": "Gordon Korman",
    "isbn": "9780062563910",
    "sourceKey": "9780062563910",
    "source": "official_catalog",
    "href": "https://gordonkorman.com/the-unteachables",
    "marker": "Zachary Kermit",
    "start": "The pupils"
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

  test(`recovery6 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery6 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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


test('all thirty-two recovery summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery6-tests', plugins: [react()],
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
