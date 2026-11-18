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

// Frozen round27 public identities; existing stored descriptions remain authoritative.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "6664",
    "editionId": "6823",
    "locale": "en",
    "title": "Painting and experience in fifteenth century Italy",
    "author": "Michael Baxandall",
    "isbn": "9780198813293",
    "isbn10": "0198813295",
    "openLibraryWorkId": "OL16047060W",
    "openLibraryEditionId": "OL24947725M",
    "sourceKey": "9780198813293",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/Painting_and_Experience_in_Fifteenth_Cen.html?id=dmpMcyeEX5EC",
    "marker": "Baxandall",
    "start": "Michael Baxandall examines"
  },
  {
    "id": "6936",
    "editionId": "7095",
    "locale": "en",
    "title": "A history of Calcutta's streets",
    "author": "P. Thankappan Nair",
    "isbn": "9789381209097",
    "isbn10": null,
    "openLibraryWorkId": "OL3433416W",
    "openLibraryEditionId": "OL31233982M",
    "sourceKey": "9789381209097",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL31233982M",
    "marker": "Kolkata",
    "start": "P. Thankappan Nair"
  },
  {
    "id": "7234",
    "editionId": "7393",
    "locale": "en",
    "title": "Historical and Philosophical Foundations of Education",
    "author": "Gerald L. Gutek",
    "isbn": "9780132097437",
    "isbn10": "0132097435",
    "openLibraryWorkId": "OL7943161W",
    "openLibraryEditionId": "OL7339126M",
    "sourceKey": "9780132097437",
    "source": "official_catalog",
    "href": "https://campusstore.miamioh.edu/historical-philosophical-foundations/bk/9780132097437",
    "marker": "biographical",
    "start": "Gerald L. Gutek"
  },
  {
    "id": "7902",
    "editionId": "8061",
    "locale": "en",
    "title": "How Emotions Are Made",
    "author": "Lisa Feldman Barrett",
    "isbn": "9780544129962",
    "isbn10": null,
    "openLibraryWorkId": "OL20216664W",
    "openLibraryEditionId": "OL29711658M",
    "sourceKey": "9780544129962",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL29711658M",
    "marker": "Barrett",
    "start": "Lisa Feldman Barrett"
  },
  {
    "id": "8667",
    "editionId": "8826",
    "locale": "en",
    "title": "Girl in the Locked Room",
    "author": "Mary Downing Hahn",
    "isbn": "9780358097556",
    "isbn10": null,
    "openLibraryWorkId": "OL19752430W",
    "openLibraryEditionId": "OL28718119M",
    "sourceKey": "9780358097556",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL28718119M",
    "marker": "Jules",
    "start": "Jules moves into"
  },
  {
    "id": "8722",
    "editionId": "8881",
    "locale": "en",
    "title": "Christopher Pike's #2 tales of terror",
    "author": "Christopher Pike",
    "isbn": "9780671550769",
    "isbn10": "0671550764",
    "openLibraryWorkId": "OL16022496W",
    "openLibraryEditionId": "OL24926131M",
    "sourceKey": "9780671550769",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL24926131M",
    "marker": "Bamboo",
    "start": "This second Tales"
  },
  {
    "id": "8905",
    "editionId": "9064",
    "locale": "en",
    "title": "Furies of Calderon (Codex Alera)",
    "author": "Jim Butcher",
    "isbn": "9780441012688",
    "isbn10": "044101268X",
    "openLibraryWorkId": "OL5961774W",
    "openLibraryEditionId": "OL7524271M",
    "sourceKey": "9780441012688",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL7524271M",
    "marker": "Tavi",
    "start": "In Alera, people"
  },
  {
    "id": "6105",
    "editionId": "6264",
    "locale": "nl",
    "title": "Lage streken",
    "author": "Herta Müller",
    "isbn": "9789044517965",
    "isbn10": null,
    "openLibraryWorkId": "OL1732445W",
    "openLibraryEditionId": "OL62205795M",
    "sourceKey": "9789044517965",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL62205795M",
    "marker": "Roemenië",
    "start": "Herta Müller beschrijft"
  },
  {
    "id": "4461",
    "editionId": "4620",
    "locale": "en",
    "title": "Snow Treasure",
    "author": "Marie McSwigan",
    "isbn": "9780590425377",
    "isbn10": "0590425374",
    "openLibraryWorkId": "OL5844479W",
    "openLibraryEditionId": "OL7887485M",
    "sourceKey": "9780590425377",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/297448/snow-treasure-by-marie-mcswigan/",
    "marker": "Peter",
    "start": "When Nazi troops"
  },
  {
    "id": "8908",
    "editionId": "9067",
    "locale": "en",
    "title": "Mansion for My Love",
    "author": "Robyn Donald",
    "isbn": "9780373105670",
    "isbn10": "0373105673",
    "openLibraryWorkId": "OL3476079W",
    "openLibraryEditionId": "OL9604150M",
    "sourceKey": "9780373105670",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL9604150M",
    "marker": "Faine",
    "start": "Faine is warned"
  },
  {
    "id": "1689",
    "editionId": "1834",
    "locale": "nl",
    "title": "Slaap!",
    "author": "Annelies Verbeke",
    "isbn": null,
    "isbn10": "9044504320",
    "openLibraryWorkId": "OL9120965W",
    "openLibraryEditionId": "OL23000013M",
    "sourceKey": "9789044504323",
    "source": "official_publisher",
    "href": "https://www.singeluitgeverijen.nl/de-geus/boek/slaap/",
    "marker": "Maya",
    "start": "Maya kan niet"
  },
  {
    "id": "1877",
    "editionId": "2048",
    "locale": "en",
    "title": "David Golder",
    "author": "Irène Némirovsky",
    "isbn": "9780676979459",
    "isbn10": "0676979459",
    "openLibraryWorkId": "OL8299145W",
    "openLibraryEditionId": "OL7695301M",
    "sourceKey": "9780676979459",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL7695301M",
    "marker": "Joyce",
    "start": "David Golder has"
  },
  {
    "id": "2990",
    "editionId": "3149",
    "locale": "nl",
    "title": "Ronja de roversdochter",
    "author": "Astrid Lindgren",
    "isbn": "9789021674902",
    "isbn10": "9021674904",
    "openLibraryWorkId": "OL14872976W",
    "openLibraryEditionId": "OL26948981M",
    "sourceKey": "9789021674902",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL26948981M",
    "marker": "Ronja",
    "start": "Ronja groeit op"
  },
  {
    "id": "7781",
    "editionId": "7940",
    "locale": "en",
    "title": "The occult, witchcraft & magic",
    "author": "Christopher Dell",
    "isbn": "9780500518885",
    "isbn10": "0500518882",
    "openLibraryWorkId": "OL20048190W",
    "openLibraryEditionId": "OL27228215M",
    "sourceKey": "9780500518885",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL27228215M",
    "marker": "Christopher Dell",
    "start": "Christopher Dell surveys"
  },
  {
    "id": "5475",
    "editionId": "5634",
    "locale": "nl",
    "title": "Ferdinand Domela Nieuwenhuis",
    "author": "Jan Willem Stutje",
    "isbn": "9789089242044",
    "isbn10": null,
    "openLibraryWorkId": "OL23192240W",
    "openLibraryEditionId": "OL31026280M",
    "sourceKey": "9789089242044",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL31026280M",
    "marker": "Domela",
    "start": "Jan Willem Stutje"
  },
  {
    "id": "9859",
    "editionId": "10018",
    "locale": "en",
    "title": "Virgin on Her Wedding Night",
    "author": "Lynne Graham",
    "isbn": "9780263212365",
    "isbn10": "026321236X",
    "openLibraryWorkId": "OL15172352W",
    "openLibraryEditionId": "OL26433546M",
    "sourceKey": "9780263212365",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL26433546M",
    "marker": "Caroline",
    "start": "Caroline Hales once"
  },
  {
    "id": "3177",
    "editionId": "3336",
    "locale": "nl",
    "title": "Hester de witte heks",
    "author": "Simone van der Vlugt",
    "isbn": "9789027681805",
    "isbn10": "9027681805",
    "openLibraryWorkId": "OL24442457W",
    "openLibraryEditionId": "OL32373864M",
    "sourceKey": "9789027681805",
    "source": "official_catalog",
    "href": "https://www.dbnl.org/tekst/coil001lexi01_01/lvdj01060.php",
    "marker": "Fleur",
    "start": "Na een verhuizing"
  },
  {
    "id": "1705",
    "editionId": "1850",
    "locale": "nl",
    "title": "De dikke Lena Lijstje",
    "author": "Francine Oomen",
    "isbn": "9789045110974",
    "isbn10": "9045110970",
    "openLibraryWorkId": "OL27971079W",
    "openLibraryEditionId": "OL38240830M",
    "sourceKey": "9789045110974",
    "source": "official_catalog",
    "href": "https://www.bibliotheek.nl/catalogus/titel.393351017.html/de-dikke-lena-lijstje/",
    "marker": "Lena",
    "start": "Lena maakt lijstjes"
  },
  {
    "id": "1706",
    "editionId": "1851",
    "locale": "nl",
    "title": "Tien dagen in een gestolen auto",
    "author": "Anna Woltz",
    "isbn": "9789025852238",
    "isbn10": "9025852238",
    "openLibraryWorkId": "OL28166582W",
    "openLibraryEditionId": "OL38561063M",
    "sourceKey": "9789025852238",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL38561063M",
    "marker": "Camilla",
    "start": "Camilla ziet weinig"
  },
  {
    "id": "2660",
    "editionId": "2819",
    "locale": "nl",
    "title": "De sadist",
    "author": "Dean Koontz",
    "isbn": "9789024552993",
    "isbn10": "9024552990",
    "openLibraryWorkId": "OL263301W",
    "openLibraryEditionId": "OL32812154M",
    "sourceKey": "9789024552993",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL32812154M",
    "marker": "achtervolging",
    "start": "Een gezin wordt"
  },
  {
    "id": "7621",
    "editionId": "7780",
    "locale": "en",
    "title": "Case Study Research and Applications",
    "author": "Robert K. Yin",
    "isbn": "9781506336169",
    "isbn10": "1506336167",
    "openLibraryWorkId": "OL20221416W",
    "openLibraryEditionId": "OL27411977M",
    "sourceKey": "9781506336169",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL27411977M",
    "marker": "Yin",
    "start": "Robert K. Yin"
  },
  {
    "id": "4968",
    "editionId": "5127",
    "locale": "nl",
    "title": "De duif",
    "author": "Patrick Süskind",
    "isbn": "9789035109865",
    "isbn10": "9035109864",
    "openLibraryWorkId": "OL2182299W",
    "openLibraryEditionId": "OL32985880M",
    "sourceKey": "9789035109865",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL32985880M",
    "marker": "bewaker",
    "start": "Een bewaker bij"
  },
  {
    "id": "2035",
    "editionId": "2236",
    "locale": "nl",
    "title": "Het recht op terugkeer",
    "author": "Léon de Winter",
    "isbn": "9789023414469",
    "isbn10": "9023414462",
    "openLibraryWorkId": "OL1725559W",
    "openLibraryEditionId": "OL48060732M",
    "sourceKey": "9789023414469",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL48060732M",
    "marker": "Bram",
    "start": "Bram Mannheim rijdt"
  },
  {
    "id": "9941",
    "editionId": "10100",
    "locale": "en",
    "title": "Jim Button and Luke the engine driver",
    "author": "Michael Ende",
    "isbn": "9780879513917",
    "isbn10": "0879513918",
    "openLibraryWorkId": "OL2271583W",
    "openLibraryEditionId": "OL2227305M",
    "sourceKey": "9780879513917",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL2227305M",
    "marker": "Jim",
    "start": "Jim Button and"
  },
  {
    "id": "5515",
    "editionId": "5674",
    "locale": "nl",
    "title": "In naam van mijn zus",
    "author": "Nabela Benaïssa",
    "isbn": "9789064450334",
    "isbn10": "9064450331",
    "openLibraryWorkId": "OL24641593W",
    "openLibraryEditionId": "OL32700028M",
    "sourceKey": "9789064450334",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL32700028M",
    "marker": "Loubna",
    "start": "Nabela Benaïssa vertelt"
  },
  {
    "id": "4217",
    "editionId": "4376",
    "locale": "en",
    "title": "Stephen King's Danse Macabre",
    "author": "Stephen King",
    "isbn": "9780708821817",
    "isbn10": "0708821812",
    "openLibraryWorkId": "OL81605W",
    "openLibraryEditionId": "OL7777738M",
    "sourceKey": "9780708821817",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL7777738M",
    "marker": "King",
    "start": "Stephen King examines"
  },
  {
    "id": "5276",
    "editionId": "5435",
    "locale": "nl",
    "title": "Zestig jaar herrie om twee minuten stilte",
    "author": "Maud van de Reijt",
    "isbn": "9789035134911",
    "isbn10": "9035134915",
    "openLibraryWorkId": "OL33376622W",
    "openLibraryEditionId": "OL45283000M",
    "sourceKey": "9789035134911",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL45283000M",
    "marker": "herdenking",
    "start": "Maud van de"
  },
  {
    "id": "7546",
    "editionId": "7705",
    "locale": "en",
    "title": "The Global City",
    "author": "Saskia Sassen",
    "isbn": "9780691070636",
    "isbn10": "0691070636",
    "openLibraryWorkId": "OL94054W",
    "openLibraryEditionId": "OL7757627M",
    "sourceKey": "9780691070636",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL7757627M",
    "marker": "Sassen",
    "start": "Saskia Sassen compares"
  },
  {
    "id": "8132",
    "editionId": "8291",
    "locale": "en",
    "title": "It Gets Worse",
    "author": "Shane Dawson",
    "isbn": "9781501132841",
    "isbn10": "1501132849",
    "openLibraryWorkId": "OL20032218W",
    "openLibraryEditionId": "OL27212261M",
    "sourceKey": "9781501132841",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL27212261M",
    "marker": "Dawson",
    "start": "Shane Dawson returns"
  },
  {
    "id": "5950",
    "editionId": "6109",
    "locale": "nl",
    "title": "Het gym",
    "author": "Karin Amatmoekrim",
    "isbn": "9789044617191",
    "isbn10": "9044617192",
    "openLibraryWorkId": "OL26177419W",
    "openLibraryEditionId": "OL35326847M",
    "sourceKey": "9789044617191",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL35326847M",
    "marker": "Sandra",
    "start": "Sandra groeit op"
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

  test(`recovery27 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery27 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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


test('all thirty reviewed summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery27-tests', plugins: [react()],
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

