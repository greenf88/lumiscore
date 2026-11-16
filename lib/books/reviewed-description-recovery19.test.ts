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

// Frozen identities from the independently captured round19 candidate-audit.json.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "3078",
    "editionId": "3237",
    "locale": "en",
    "title": "Mister Monday",
    "author": "Garth Nix",
    "isbn": "9780439551236",
    "isbn10": null,
    "openLibraryWorkId": "OL2628760W",
    "openLibraryEditionId": "OL3379527M",
    "sourceKey": "9780439551236",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/122212/mister-monday-by-garth-nix/",
    "marker": "Arthur Penhaligon",
    "start": "Arthur Penhaligon survives"
  },
  {
    "id": "9844",
    "editionId": "10003",
    "locale": "en",
    "title": "The marriage surrender",
    "author": "Michelle Reid",
    "isbn": "9780263158045",
    "isbn10": null,
    "openLibraryWorkId": "OL4233139W",
    "openLibraryEditionId": "OL24765018M",
    "sourceKey": "9780263158045",
    "source": "official_publisher",
    "href": "https://harlequin.com/products/the-marriage-surrender",
    "marker": "Joanna",
    "start": "Joanna left Alessandro"
  },
  {
    "id": "3973",
    "editionId": "4132",
    "locale": "en",
    "title": "The Riddle-Master of Hed  (Riddle-Master #1)",
    "author": "Patricia A. McKillip",
    "isbn": "9780345331045",
    "isbn10": null,
    "openLibraryWorkId": "OL92495W",
    "openLibraryEditionId": "OL24218409M",
    "sourceKey": "9780345331045",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/The_Riddle_master_of_Hed.html?id=5fY_AAAACAAJ",
    "marker": "Morgon",
    "start": "Morgon, the prince"
  },
  {
    "id": "2433",
    "editionId": "2667",
    "locale": "en",
    "title": "SPQR",
    "author": "Mary Beard",
    "isbn": "9781846683800",
    "isbn10": null,
    "openLibraryWorkId": "OL17340134W",
    "openLibraryEditionId": "OL27511331M",
    "sourceKey": "9781846683800",
    "source": "official_publisher",
    "href": "https://profilebooks.com/work/spqr/",
    "marker": "Mary Beard",
    "start": "Mary Beard traces"
  },
  {
    "id": "8545",
    "editionId": "8704",
    "locale": "en",
    "title": "Wayward Son",
    "author": "Rainbow Rowell",
    "isbn": "9781250146076",
    "isbn10": null,
    "openLibraryWorkId": "OL20142351W",
    "openLibraryEditionId": "OL27322153M",
    "sourceKey": "9781250146076",
    "source": "official_publisher",
    "href": "https://www.rainbowrowell.com/wayward-son",
    "marker": "Simon Snow",
    "start": "Simon Snow has"
  },
  {
    "id": "8516",
    "editionId": "8675",
    "locale": "en",
    "title": "Chain Letter",
    "author": "Christopher Pike",
    "isbn": "9780380899685",
    "isbn10": null,
    "openLibraryWorkId": "OL1000782W",
    "openLibraryEditionId": "OL24934860M",
    "sourceKey": "9780380899685",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/Chain-Letter/Christopher-Pike/9781442472150",
    "marker": "Alison",
    "start": "Alison dismisses a"
  },
  {
    "id": "4849",
    "editionId": "5008",
    "locale": "en",
    "title": "The outsiders",
    "author": "William Thorndike",
    "isbn": "9781422162675",
    "isbn10": null,
    "openLibraryWorkId": "OL16599653W",
    "openLibraryEditionId": "OL25283027M",
    "sourceKey": "9781422162675",
    "source": "official_publisher",
    "href": "https://store.hbr.org/product/the-outsiders-eight-unconventional-ceos-and-their-radically-rational-blueprint-for-success/10344?sku=10344-HBK-ENG",
    "marker": "capital allocation",
    "start": "William Thorndike studies"
  },
  {
    "id": "8864",
    "editionId": "9023",
    "locale": "en",
    "title": "Open Water",
    "author": "Caleb Azumah Nelson",
    "isbn": "9780802157942",
    "isbn10": null,
    "openLibraryWorkId": "OL21696935W",
    "openLibraryEditionId": "OL31421754M",
    "sourceKey": "9780802157942",
    "source": "official_publisher",
    "href": "https://groveatlantic.com/book/open-water/",
    "marker": "photographer",
    "start": "A photographer and"
  },
  {
    "id": "9226",
    "editionId": "9385",
    "locale": "en",
    "title": "Untamed",
    "author": "Carole Mortimer",
    "isbn": "9780373107575",
    "isbn10": null,
    "openLibraryWorkId": "OL3775505W",
    "openLibraryEditionId": "OL10738324M",
    "sourceKey": "9780373107575",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL10738324M/Untamed",
    "marker": "Keilly",
    "start": "Keilly is determined"
  },
  {
    "id": "5520",
    "editionId": "5679",
    "locale": "nl",
    "title": "Het gevaar van de joodse erfenis",
    "author": "H. M. Reijzer",
    "isbn": "9789035132061",
    "isbn10": null,
    "openLibraryWorkId": "OL24117948W",
    "openLibraryEditionId": "OL31810694M",
    "sourceKey": "9789035132061",
    "source": "official_publisher",
    "href": "https://www.routledge.com/A-Dangerous-Legacy-Judaism-and-the-Psychoanalytic-Movement/Reijzer/p/book/9780367107093",
    "marker": "Hans Reijzer",
    "start": "Hans Reijzer onderzoekt"
  },
  {
    "id": "7716",
    "editionId": "7875",
    "locale": "en",
    "title": "Child neglect",
    "author": "Janet Anne Basarab-Horwath",
    "isbn": "9781403933461",
    "isbn10": null,
    "openLibraryWorkId": "OL15407787W",
    "openLibraryEditionId": "OL24378062M",
    "sourceKey": "9781403933461",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/Child_Neglect.html?id=uCJ2QgAACAAJ",
    "marker": "Jan Horwath",
    "start": "Jan Horwath examines"
  },
  {
    "id": "5707",
    "editionId": "5866",
    "locale": "nl",
    "title": "Activiteit en begrip",
    "author": "B. van Oers",
    "isbn": "9789062564903",
    "isbn10": null,
    "openLibraryWorkId": "OL39384526W",
    "openLibraryEditionId": "OL53594563M",
    "sourceKey": "9789062564903",
    "source": "official_catalog",
    "href": "https://pedagogischestudien.nl/article/download/15590/17046/33360",
    "marker": "Bert van Oers",
    "start": "Bert van Oers"
  },
  {
    "id": "2369",
    "editionId": "2589",
    "locale": "nl",
    "title": "Bergje",
    "author": "Bregje Hofstede",
    "isbn": "9789028210332",
    "isbn10": null,
    "openLibraryWorkId": "OL44381671W",
    "openLibraryEditionId": "OL60637094M",
    "sourceKey": "9789028210332",
    "source": "official_publisher",
    "href": "https://www.vanoorschot.nl/oorshop/bergje/",
    "marker": "Sass Songher",
    "start": "Bregje Hofstede keert"
  },
  {
    "id": "4206",
    "editionId": "4365",
    "locale": "en",
    "title": "Out of my mind",
    "author": "Sharon M. Draper",
    "isbn": "9781416971702",
    "isbn10": null,
    "openLibraryWorkId": "OL12489W",
    "openLibraryEditionId": "OL24378894M",
    "sourceKey": "9781416971702",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/Out-of-My-Mind/Sharon-M-Draper/The-Out-of-My-Mind-Series/9781416971702",
    "marker": "Melody",
    "start": "Eleven-year-old Melody has"
  },
  {
    "id": "2109",
    "editionId": "2311",
    "locale": "en",
    "title": "Anne of Avonlea",
    "author": "Lucy Maud Montgomery",
    "isbn": "9781582870137",
    "isbn10": null,
    "openLibraryWorkId": "OL77744W",
    "openLibraryEditionId": "OL8788539M",
    "sourceKey": "9781582870137",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/116230/anne-of-avonlea-by-lm-montgomery/paperback/",
    "marker": "Anne Shirley",
    "start": "Anne Shirley begins"
  },
  {
    "id": "3501",
    "editionId": "3660",
    "locale": "nl",
    "title": "Het zingende gras",
    "author": "Doris Lessing",
    "isbn": "9789044514421",
    "isbn10": null,
    "openLibraryWorkId": "OL31256W",
    "openLibraryEditionId": "OL37755649M",
    "sourceKey": "9789044514421",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL37755649M",
    "marker": "Mary Turner",
    "start": "Mary Turner verruilt"
  },
  {
    "id": "3305",
    "editionId": "3464",
    "locale": "nl",
    "title": "De droom van de Ier",
    "author": "Mario Vargas Llosa",
    "isbn": "9789029087551",
    "isbn10": null,
    "openLibraryWorkId": "OL15504299W",
    "openLibraryEditionId": "OL33338657M",
    "sourceKey": "9789029087551",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9781250033321/thedreamofthecelt/",
    "marker": "Roger Casement",
    "start": "Roger Casement onderzoekt"
  },
  {
    "id": "3016",
    "editionId": "3175",
    "locale": "nl",
    "title": "Ik mis mezelf",
    "author": "Lisa Genova",
    "isbn": "9789049951061",
    "isbn10": null,
    "openLibraryWorkId": "OL9475257W",
    "openLibraryEditionId": "OL35331179M",
    "sourceKey": "9789049951061",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/Still-Alice/Lisa-Genova/9781439102817",
    "marker": "Alice Howland",
    "start": "Alice Howland staat"
  },
  {
    "id": "5756",
    "editionId": "5915",
    "locale": "nl",
    "title": "Een tik op het raam",
    "author": "Linwood Barclay",
    "isbn": "9789022571170",
    "isbn10": null,
    "openLibraryWorkId": "OL17356081W",
    "openLibraryEditionId": "OL35331623M",
    "sourceKey": "9789022571170",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL35331623M",
    "marker": "Cal Weaver",
    "start": "Privédetective Cal Weaver"
  },
  {
    "id": "6094",
    "editionId": "6253",
    "locale": "nl",
    "title": "De verdwenen monnik",
    "author": "Peter Berresford Ellis",
    "isbn": "9789086060115",
    "isbn10": null,
    "openLibraryWorkId": "OL77057W",
    "openLibraryEditionId": "OL38244456M",
    "sourceKey": "9789086060115",
    "source": "official_catalog",
    "href": "https://metadata.isbn.nl/1339927/de-verdwenen-monnik.html",
    "marker": "Fidelma",
    "start": "In de abdij"
  },
  {
    "id": "6312",
    "editionId": "6471",
    "locale": "nl",
    "title": "Voltooid verleden",
    "author": "Robert Goddard",
    "isbn": "9789024549993",
    "isbn10": null,
    "openLibraryWorkId": "OL16717223W",
    "openLibraryEditionId": "OL32347392M",
    "sourceKey": "9789024549993",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/407880/fault-line-by-robert-goddard/9781409031154",
    "marker": "Jonathan Kellaway",
    "start": "Jonathan Kellaway krijgt"
  },
  {
    "id": "5923",
    "editionId": "6082",
    "locale": "nl",
    "title": "Bevrijdend lied",
    "author": "Karen Kingsbury",
    "isbn": "9789029720519",
    "isbn10": null,
    "openLibraryWorkId": "OL15369696W",
    "openLibraryEditionId": "OL35331524M",
    "sourceKey": "9789029720519",
    "source": "official_publisher",
    "href": "https://www.kokboekencentrum.nl/boek/bevrijdend-lied/",
    "marker": "Holden Harris",
    "start": "De achttienjarige Holden"
  },
  {
    "id": "6057",
    "editionId": "6216",
    "locale": "nl",
    "title": "Stad der engelen of The overcoat of Dr. Freud",
    "author": "Christa Wolf",
    "isbn": "9789461640246",
    "isbn10": null,
    "openLibraryWorkId": "OL16646051W",
    "openLibraryEditionId": "OL35328969M",
    "sourceKey": "9789461640246",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9780374534295/cityofangels/",
    "marker": "Los Angeles",
    "start": "Tijdens een verblijf"
  },
  {
    "id": "5536",
    "editionId": "5695",
    "locale": "nl",
    "title": "Hersenfuncties bij leer- en ontwikkelingsstoornissen",
    "author": "Peter van Vugt",
    "isbn": "9789044123678",
    "isbn10": null,
    "openLibraryWorkId": "OL24729349W",
    "openLibraryEditionId": "OL32829793M",
    "sourceKey": "9789044123678",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL32829793M",
    "marker": "Peter van Vugt",
    "start": "Peter van Vugt"
  },
  {
    "id": "2672",
    "editionId": "2831",
    "locale": "en",
    "title": "Perfume",
    "author": "Patrick Süskind",
    "isbn": "9780375725845",
    "isbn10": null,
    "openLibraryWorkId": "OL10834W",
    "openLibraryEditionId": "OL24833372M",
    "sourceKey": "9780375725845",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/175395/perfume-by-patrick-suskind/",
    "marker": "Jean-Baptiste Grenouille",
    "start": "Jean-Baptiste Grenouille grows"
  },
  {
    "id": "4219",
    "editionId": "4378",
    "locale": "en",
    "title": "Monster",
    "author": "Walter Dean Myers",
    "isbn": "9780064407311",
    "isbn10": null,
    "openLibraryWorkId": "OL98288W",
    "openLibraryEditionId": "OL3433121M",
    "sourceKey": "9780064407311",
    "source": "official_catalog",
    "href": "https://books.google.com/books?id=tcr0ii90BrcC",
    "marker": "Steve Harmon",
    "start": "Sixteen-year-old Steve Harmon"
  },
  {
    "id": "7643",
    "editionId": "7802",
    "locale": "en",
    "title": "An American Plague",
    "author": "Jim Murphy",
    "isbn": "9780395776087",
    "isbn10": null,
    "openLibraryWorkId": "OL7962230W",
    "openLibraryEditionId": "OL7467970M",
    "sourceKey": "9780395776087",
    "source": "official_publisher",
    "href": "https://jimmurphybooks.com/books/an-american-plague/",
    "marker": "1793",
    "start": "Jim Murphy reconstructs"
  },
  {
    "id": "2308",
    "editionId": "2525",
    "locale": "en",
    "title": "Imperium",
    "author": "Robert Harris",
    "isbn": "9780743266031",
    "isbn10": null,
    "openLibraryWorkId": "OL4297222W",
    "openLibraryEditionId": "OL7948132M",
    "sourceKey": "9780743266031",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/Imperium/Robert-Harris/9780743293877",
    "marker": "Tiro",
    "start": "Tiro, Cicero’s enslaved"
  },
  {
    "id": "4429",
    "editionId": "4588",
    "locale": "en",
    "title": "Harriet the Spy",
    "author": "Louise Fitzhugh",
    "isbn": "9780064403313",
    "isbn10": null,
    "openLibraryWorkId": "OL5277971W",
    "openLibraryEditionId": "OL36682713M",
    "sourceKey": "9780064403313",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/50095/harriet-the-spy-by-louise-fitzhugh/paperback/",
    "marker": "Harriet",
    "start": "Harriet keeps a"
  },
  {
    "id": "4584",
    "editionId": "4743",
    "locale": "en",
    "title": "Be More Chill",
    "author": "Ned Vizzini",
    "isbn": "9780786809967",
    "isbn10": null,
    "openLibraryWorkId": "OL5850282W",
    "openLibraryEditionId": "OL24201336M",
    "sourceKey": "9780786809967",
    "source": "official_publisher",
    "href": "https://books.disney.com/book/be-more-chill/",
    "marker": "Jeremy Heere",
    "start": "Jeremy Heere feels"
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

  test(`recovery19 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery19 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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


test('all thirty recovery summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery19-tests', plugins: [react()],
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
