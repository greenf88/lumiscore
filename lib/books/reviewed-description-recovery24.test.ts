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

// Frozen round24 public identities; existing stored descriptions remain authoritative.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "3981",
    "editionId": "4140",
    "locale": "en",
    "title": "My Wicked Marquess",
    "author": "Gaelen Foley",
    "isbn": "9780061733956",
    "isbn10": "0061733954",
    "openLibraryWorkId": "OL5689029W",
    "openLibraryEditionId": "OL24404593M",
    "sourceKey": "9780061733956",
    "source": "official_catalog",
    "href": "https://www.gaelenfoley.com/the-inferno-club.html",
    "marker": "Daphne",
    "start": "Max, the Marquess"
  },
  {
    "id": "4220",
    "editionId": "4379",
    "locale": "en",
    "title": "Revolution 2020",
    "author": "Chetan Bhagat",
    "isbn": "9788129118806",
    "isbn10": null,
    "openLibraryWorkId": "OL16459607W",
    "openLibraryEditionId": "OL25441039M",
    "sourceKey": "9788129118806",
    "source": "official_catalog",
    "href": "https://www.chetanbhagat.com/books/revolution-2020/",
    "marker": "Varanasi",
    "start": "Gopal, Raghav and"
  },
  {
    "id": "4706",
    "editionId": "4865",
    "locale": "en",
    "title": "The Prisoner of Heaven",
    "author": "Carlos Ruiz Zafón",
    "isbn": "9781444815955",
    "isbn10": "1444815954",
    "openLibraryWorkId": "OL16708051W",
    "openLibraryEditionId": "OL32174508M",
    "sourceKey": "9781444815955",
    "source": "official_publisher",
    "href": "https://www.hachette.co.uk/titles/carlos-ruiz-zafon/the-prisoner-of-heaven/9781780222851/",
    "marker": "Fermín",
    "start": "A stranger arrives"
  },
  {
    "id": "6789",
    "editionId": "6948",
    "locale": "en",
    "title": "Human + machine",
    "author": "Paul R. Daugherty",
    "isbn": "9781633693869",
    "isbn10": "1633693864",
    "openLibraryWorkId": "OL17993541W",
    "openLibraryEditionId": "OL26574938M",
    "sourceKey": "9781633693869",
    "source": "official_catalog",
    "href": "https://books.google.com/books?id=SpECtAEACAAJ",
    "marker": "Wilson",
    "start": "Paul R. Daugherty"
  },
  {
    "id": "7168",
    "editionId": "7327",
    "locale": "en",
    "title": "Revolucion!",
    "author": "Lincoln Cushing",
    "isbn": "9780811835824",
    "isbn10": "0811835820",
    "openLibraryWorkId": "OL8485161W",
    "openLibraryEditionId": "OL8002245M",
    "sourceKey": "9780811835824",
    "source": "official_catalog",
    "href": "https://library.tcdc.or.th/record/view/b00005730",
    "marker": "posters",
    "start": "Lincoln Cushing brings"
  },
  {
    "id": "7696",
    "editionId": "7855",
    "locale": "en",
    "title": "The Diversity of Life",
    "author": "Edward Osborne Wilson",
    "isbn": "9780393035384",
    "isbn10": "0393035387",
    "openLibraryWorkId": "OL1378177W",
    "openLibraryEditionId": "OL10157186M",
    "sourceKey": "9780393035384",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/659354/e-o-wilson-biophilia-the-diversity-of-life-naturalist-loa-340-by-edward-o-wilson--david-quammen-editor/9781598536799/",
    "marker": "biodiversity",
    "start": "Edward O. Wilson"
  },
  {
    "id": "8337",
    "editionId": "8496",
    "locale": "en",
    "title": "Star Wars: The Clone Wars",
    "author": "Karen Traviss",
    "isbn": "9780345508980",
    "isbn10": "034550898X",
    "openLibraryWorkId": "OL17449003W",
    "openLibraryEditionId": "OL23081019M",
    "sourceKey": "9780345508980",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/180093/the-clone-wars-star-wars-by-karen-traviss/",
    "marker": "Ahsoka",
    "start": "Anakin Skywalker is"
  },
  {
    "id": "8770",
    "editionId": "8929",
    "locale": "en",
    "title": "Tempestuous Reunion",
    "author": "Lynne Graham",
    "isbn": "9780373115518",
    "isbn10": "0373115512",
    "openLibraryWorkId": "OL3773976W",
    "openLibraryEditionId": "OL9574009M",
    "sourceKey": "9780373115518",
    "source": "official_publisher",
    "href": "https://harlequin.com/products/tempestuous-reunion",
    "marker": "Catherine",
    "start": "Catherine Parrish left"
  },
  {
    "id": "8860",
    "editionId": "9019",
    "locale": "en",
    "title": "Share Your Smile",
    "author": "Raina Telgemeier",
    "isbn": "9781338353846",
    "isbn10": "1338353845",
    "openLibraryWorkId": "OL20162318W",
    "openLibraryEditionId": "OL27344087M",
    "sourceKey": "9781338353846",
    "source": "official_publisher",
    "href": "https://www.scholastic.com/content/dam/teachers/lesson-plans/19-20/guts-poster-and-guide.pdf",
    "marker": "interactive",
    "start": "Raina Telgemeier invites"
  },
  {
    "id": "9180",
    "editionId": "9339",
    "locale": "en",
    "title": "We need new names",
    "author": "NoViolet Bulawayo",
    "isbn": "9781471258466",
    "isbn10": "1471258467",
    "openLibraryWorkId": "OL16814507W",
    "openLibraryEditionId": "OL32153436M",
    "sourceKey": "9781471258466",
    "source": "official_publisher",
    "href": "https://www.littlebrown.com/wp-content/uploads/2017/10/littlebrown-rgg-weneednewnames_readinggroupguide.pdf",
    "marker": "Darling",
    "start": "Darling grows up"
  },
  {
    "id": "9765",
    "editionId": "9924",
    "locale": "en",
    "title": "Your second life begins when you realize you only have one",
    "author": "Raphaëlle Giordano",
    "isbn": "9780525535591",
    "isbn10": "0525535594",
    "openLibraryWorkId": "OL19750130W",
    "openLibraryEditionId": "OL26963176M",
    "sourceKey": "9780525535591",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/574586/your-second-life-begins-when-you-realize-you-only-have-one-by-raphaelle-giordano/",
    "marker": "Camille",
    "start": "Camille has a"
  },
  {
    "id": "5128",
    "editionId": "5287",
    "locale": "nl",
    "title": "In weerwil van de woorden",
    "author": "Dimitri Verhulst",
    "isbn": "9789083108247",
    "isbn10": "9083108244",
    "openLibraryWorkId": "OL44320396W",
    "openLibraryEditionId": "OL60566626M",
    "sourceKey": "9789083108247",
    "source": "official_publisher",
    "href": "https://uitgeverijpluim.nl/boeken/in-weerwil-van-woorden",
    "marker": "Pol Verholst",
    "start": "Pol Verholst is"
  },
  {
    "id": "5758",
    "editionId": "5917",
    "locale": "nl",
    "title": "Angel Fire",
    "author": "Lee Weatherly",
    "isbn": "9789022326831",
    "isbn10": "9022326837",
    "openLibraryWorkId": "OL16471215W",
    "openLibraryEditionId": "OL25651503M",
    "sourceKey": "9789022326831",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/214486/angel-fire-by-la-weatherly/",
    "marker": "Mexico",
    "start": "Na een nieuwe"
  },
  {
    "id": "2852",
    "editionId": "3011",
    "locale": "en",
    "title": "When she woke",
    "author": "Hillary Jordan",
    "isbn": "9781443408028",
    "isbn10": "1443408026",
    "openLibraryWorkId": "OL16099610W",
    "openLibraryEditionId": "OL33043357M",
    "sourceKey": "9781443408028",
    "source": "official_publisher",
    "href": "https://www.hachettebookgroup.com/titles/hillary-jordan/when-she-woke/9781616201937/",
    "marker": "Hannah",
    "start": "Hannah Payne wakes"
  },
  {
    "id": "2920",
    "editionId": "3079",
    "locale": "en",
    "title": "The other side of the island",
    "author": "Allegra Goodman",
    "isbn": "9781595141958",
    "isbn10": null,
    "openLibraryWorkId": "OL445765W",
    "openLibraryEditionId": "OL16471842M",
    "sourceKey": "9781595141958",
    "source": "official_catalog",
    "href": "https://allegragoodman.com/books/the-other-side-of-the-island/",
    "marker": "Honor",
    "start": "Honor arrives on"
  },
  {
    "id": "2003",
    "editionId": "2203",
    "locale": "en",
    "title": "Powerless",
    "author": "Elsie Silver",
    "isbn": "9780349437705",
    "isbn10": "034943770X",
    "openLibraryWorkId": "OL34030756W",
    "openLibraryEditionId": "OL46071314M",
    "sourceKey": "9780349437705",
    "source": "official_publisher",
    "href": "https://www.hachette.co.uk/titles/elsie-silver/powerless/9780349437712/",
    "marker": "Jasper",
    "start": "Sloane has loved"
  },
  {
    "id": "2877",
    "editionId": "3036",
    "locale": "en",
    "title": "The revolution of Ivy",
    "author": "Amy Engel",
    "isbn": "9781473629349",
    "isbn10": "1473629349",
    "openLibraryWorkId": "OL20871448W",
    "openLibraryEditionId": "OL28420066M",
    "sourceKey": "9781473629349",
    "source": "official_publisher",
    "href": "https://www.hachette.co.uk/titles/amy-engel/the-revolution-of-ivy/9781473629349/",
    "marker": "Westfall",
    "start": "Ivy Westfall has"
  },
  {
    "id": "3691",
    "editionId": "3850",
    "locale": "en",
    "title": "The strange case of the alchemist's daughter",
    "author": "Theodora Goss",
    "isbn": "9781481466509",
    "isbn10": "148146650X",
    "openLibraryWorkId": "OL20100879W",
    "openLibraryEditionId": "OL26923973M",
    "sourceKey": "9781481466509",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.net/books/The-Strange-Case-of-the-Alchemists-Daughter/Theodora-Goss/The-Extraordinary-Adventures-of-the-Athena-Club/9781481466516",
    "marker": "Mary Jekyll",
    "start": "Mary Jekyll investigates"
  },
  {
    "id": "1948",
    "editionId": "2128",
    "locale": "en",
    "title": "The Two Gentlemen of Verona",
    "author": "William Shakespeare",
    "isbn": "9781903436943",
    "isbn10": "190343694X",
    "openLibraryWorkId": "OL362671W",
    "openLibraryEditionId": "OL8768192M",
    "sourceKey": "9781903436943",
    "source": "official_publisher",
    "href": "https://www.bloomsbury.com/uk/two-gentlemen-of-verona-9781903436943/",
    "marker": "Julia",
    "start": "Shakespeare tests the"
  },
  {
    "id": "9729",
    "editionId": "9888",
    "locale": "en",
    "title": "Death in the stocks",
    "author": "Georgette Heyer",
    "isbn": "9781405645485",
    "isbn10": "1405645482",
    "openLibraryWorkId": "OL4092670W",
    "openLibraryEditionId": "OL30101238M",
    "sourceKey": "9781405645485",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/388798/death-in-the-stocks-by-heyer-georgette/9780099493624",
    "marker": "Vereker",
    "start": "A policeman finds"
  },
  {
    "id": "278",
    "editionId": "1326",
    "locale": "nl",
    "title": "Dageraad boven de boete",
    "author": "Suzanne Collins",
    "isbn": "9789000397266",
    "isbn10": "900039726X",
    "openLibraryWorkId": "OL43426400W",
    "openLibraryEditionId": "OL61050164M",
    "sourceKey": "9789000397266",
    "source": "official_publisher",
    "href": "https://www.lannoo.com/nl-nl/young-adult/dageraad-boven-de-boete-9789000397266",
    "marker": "Haymitch",
    "start": "Haymitch Abernathy hoopt"
  },
  {
    "id": "7033",
    "editionId": "7192",
    "locale": "en",
    "title": "Visual Culture",
    "author": "Alexis L. Boylan",
    "isbn": "9780262539364",
    "isbn10": null,
    "openLibraryWorkId": "OL21913149W",
    "openLibraryEditionId": "OL29888023M",
    "sourceKey": "9780262539364",
    "source": "official_publisher",
    "href": "https://mitpress.mit.edu/9780262539364/visual-culture/",
    "marker": "images",
    "start": "Alexis L. Boylan"
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

  test(`recovery24 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery24 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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


test('all twenty-two reviewed summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery24-tests', plugins: [react()],
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

