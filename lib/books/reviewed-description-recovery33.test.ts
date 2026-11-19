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

// Frozen round33 public identities; existing stored descriptions remain authoritative.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "3351",
    "editionId": "3510",
    "locale": "nl",
    "title": "Sambavoetbal",
    "author": "Alex Bellos",
    "isbn": "9789043916943",
    "isbn10": "9043916943",
    "openLibraryWorkId": "OL6017394W",
    "openLibraryEditionId": "OL35328002M",
    "sourceKey": "9789043916943",
    "source": "official_publisher",
    "href": "https://www.kosmosuitgevers.nl/boek/sambavoetbal/",
    "marker": "Alex Bellos reist door",
    "start": "Alex Bellos reist"
  },
  {
    "id": "3627",
    "editionId": "3786",
    "locale": "en",
    "title": "The Psychology of Death",
    "author": "Robert Kastenbaum",
    "isbn": "9780826102638",
    "isbn10": "0826102638",
    "openLibraryWorkId": "OL480577W",
    "openLibraryEditionId": "OL8165575M",
    "sourceKey": "9780826102638",
    "source": "official_catalog",
    "href": "https://www.overdrive.com/media/2504051/",
    "marker": "Robert Kastenbaum examines how",
    "start": "Robert Kastenbaum examines"
  },
  {
    "id": "3675",
    "editionId": "3834",
    "locale": "en",
    "title": "The Esoteric Orders and Their Work",
    "author": "Violet M. Firth (Dion Fortune)",
    "isbn": "9780850303100",
    "isbn10": "0850303109",
    "openLibraryWorkId": "OL114614W",
    "openLibraryEditionId": "OL8263818M",
    "sourceKey": "9780850303100",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/Esoteric_Orders_and_Their_Work.html?id=r7bgCKqMk1kC",
    "marker": "Dion Fortune examines the",
    "start": "Dion Fortune examines"
  },
  {
    "id": "3800",
    "editionId": "3959",
    "locale": "en",
    "title": "Urban Design",
    "author": "Cliff Moughtin",
    "isbn": "9780750642743",
    "isbn10": "0750642742",
    "openLibraryWorkId": "OL3239915W",
    "openLibraryEditionId": "OL9449740M",
    "sourceKey": "9780750642743",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/Urban_Design.html?id=HjpUAAAAMAAJ",
    "marker": "Cliff Moughtin studies streets",
    "start": "Cliff Moughtin studies"
  },
  {
    "id": "3910",
    "editionId": "4069",
    "locale": "en",
    "title": "Discrete Mathematics (Oxford Science Publications)",
    "author": "Norman Biggs",
    "isbn": "9780198534273",
    "isbn10": "0198534272",
    "openLibraryWorkId": "OL3584303W",
    "openLibraryEditionId": "OL7400647M",
    "sourceKey": "9780198534273",
    "source": "official_catalog",
    "href": "https://libcat.ferrum.edu/bib/14098",
    "marker": "Norman Biggs introduces discrete",
    "start": "Norman Biggs introduces"
  },
  {
    "id": "3621",
    "editionId": "3780",
    "locale": "en",
    "title": "Think Again",
    "author": "Adam Grant",
    "isbn": "9780593298749",
    "isbn10": "0593298748",
    "openLibraryWorkId": "OL22484556W",
    "openLibraryEditionId": "OL31987441M",
    "sourceKey": "9780593298749",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/607660/think-again-by-adam-grant/",
    "marker": "Adam Grant explores what",
    "start": "Adam Grant explores"
  },
  {
    "id": "4670",
    "editionId": "4829",
    "locale": "en",
    "title": "Jupiter War",
    "author": "Neal L. Asher",
    "isbn": "9780330524537",
    "isbn10": null,
    "openLibraryWorkId": "OL20791981W",
    "openLibraryEditionId": "OL25448403M",
    "sourceKey": "9780330524537",
    "source": "official_publisher",
    "href": "https://www.panmacmillan.com/authors/neal-asher/jupiter-war/9781509868568",
    "marker": "Alan Saul's transformation has",
    "start": "Alan Saul's transformation"
  },
  {
    "id": "4876",
    "editionId": "5035",
    "locale": "en",
    "title": "A Bright Shining Lie",
    "author": "Neil Sheehan",
    "isbn": "9780394484471",
    "isbn10": "0394484479",
    "openLibraryWorkId": "OL3063447W",
    "openLibraryEditionId": "OL18335754M",
    "sourceKey": "9780394484471",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/165414/a-bright-shining-lie-by-neil-sheehan/9780679724148/",
    "marker": "Neil Sheehan follows John",
    "start": "Neil Sheehan follows"
  },
  {
    "id": "4966",
    "editionId": "5125",
    "locale": "nl",
    "title": "Het moois dat we delen",
    "author": "Ish Ait Hamou",
    "isbn": "9789022336953",
    "isbn10": "9022336956",
    "openLibraryWorkId": "OL24317185W",
    "openLibraryEditionId": "OL32177800M",
    "sourceKey": "9789022336953",
    "source": "official_publisher",
    "href": "https://www.standaarduitgeverij.be/product/het-moois-dat-we-delen-9789022336953/",
    "marker": "Soumia probeert haar leven",
    "start": "Soumia probeert haar"
  },
  {
    "id": "5017",
    "editionId": "5176",
    "locale": "nl",
    "title": "De geschiedenis van de bijen",
    "author": "Maja Lunde",
    "isbn": "9789056726867",
    "isbn10": null,
    "openLibraryWorkId": "OL17801831W",
    "openLibraryEditionId": "OL58287809M",
    "sourceKey": "9789056726867",
    "source": "official_publisher",
    "href": "https://www.awbruna.nl/boek/romans/maja-lunde/de-geschiedenis-van-bijen/",
    "marker": "Een Engelse onderzoeker werkt",
    "start": "Een Engelse onderzoeker"
  },
  {
    "id": "5088",
    "editionId": "5247",
    "locale": "nl",
    "title": "Diplodocus Deks",
    "author": "Tom Lanoye",
    "isbn": "9789044604436",
    "isbn10": "9044604430",
    "openLibraryWorkId": "OL42349004W",
    "openLibraryEditionId": "OL57451747M",
    "sourceKey": "9789044604436",
    "source": "official_publisher",
    "href": "https://www.lanoye.be/diplodocus-deks-0",
    "marker": "In een grensstreek staat",
    "start": "In een grensstreek"
  },
  {
    "id": "5194",
    "editionId": "5353",
    "locale": "nl",
    "title": "In de schaduw",
    "author": "Doris Lessing",
    "isbn": "9789035119000",
    "isbn10": "9035119002",
    "openLibraryWorkId": "OL31216W",
    "openLibraryEditionId": "OL33333179M",
    "sourceKey": "9789035119000",
    "source": "official_catalog",
    "href": "https://books.google.com/books?id=fs8dSAAACAAJ",
    "marker": "Doris Lessing vervolgt haar",
    "start": "Doris Lessing vervolgt"
  },
  {
    "id": "5259",
    "editionId": "5418",
    "locale": "nl",
    "title": "Profiling",
    "author": "Danièle Zucker",
    "isbn": "9789020999631",
    "isbn10": null,
    "openLibraryWorkId": "OL23316987W",
    "openLibraryEditionId": "OL31165603M",
    "sourceKey": "9789020999631",
    "source": "official_catalog",
    "href": "https://www.deslegte.com/profiling-417310/",
    "marker": "Danièle Zucker onderzoekt hoe",
    "start": "Danièle Zucker onderzoekt"
  },
  {
    "id": "5317",
    "editionId": "5476",
    "locale": "nl",
    "title": "De Belgische beeldende kunstenaars van de 19de tot de 21e eeuw",
    "author": "Paul-L Piron",
    "isbn": "9789491819643",
    "isbn10": null,
    "openLibraryWorkId": "OL32716233W",
    "openLibraryEditionId": "OL44534028M",
    "sourceKey": "9789491819643",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/De_Belgische_beeldende_kunstenaars_van_d.html?id=M_Ug0AEACAAJ",
    "marker": "Paul L. Piron brengt",
    "start": "Paul L. Piron"
  },
  {
    "id": "5402",
    "editionId": "5561",
    "locale": "nl",
    "title": "Vorst tussen twee werelden",
    "author": "Madelon Djajadiningrat",
    "isbn": "9789054292203",
    "isbn10": "9054292202",
    "openLibraryWorkId": "OL27299571W",
    "openLibraryEditionId": "OL37057368M",
    "sourceKey": "9789054292203",
    "source": "official_catalog",
    "href": "https://www.bibliotheek.nl/catalogus/titel.292407858.html/vorst-tussen-twee-werelden/",
    "marker": "Madelon Djajadiningrat vertelt over",
    "start": "Madelon Djajadiningrat vertelt"
  },
  {
    "id": "5500",
    "editionId": "5659",
    "locale": "nl",
    "title": "De kinderen van Attila",
    "author": "Erdal Balci",
    "isbn": "9789085420385",
    "isbn10": null,
    "openLibraryWorkId": "OL12760191W",
    "openLibraryEditionId": "OL19428804M",
    "sourceKey": "9789085420385",
    "source": "official_catalog",
    "href": "https://www.dwars.be/index.php/en/artikel/van-ataturk-tot-de-zwarte-zee",
    "marker": "Erdal Balci verkent de",
    "start": "Erdal Balci verkent"
  },
  {
    "id": "5547",
    "editionId": "5706",
    "locale": "nl",
    "title": "Gij zult gelukkig zijn!",
    "author": "Pascal Bruckner",
    "isbn": "9789053527795",
    "isbn10": "9053527796",
    "openLibraryWorkId": "OL26180978W",
    "openLibraryEditionId": "OL35330662M",
    "sourceKey": "9789053527795",
    "source": "official_publisher",
    "href": "https://press.princeton.edu/books/ebook/9781400835973/perpetual-euphoria-0",
    "marker": "Pascal Bruckner onderzoekt hoe",
    "start": "Pascal Bruckner onderzoekt"
  },
  {
    "id": "5564",
    "editionId": "5723",
    "locale": "nl",
    "title": "Mooi is nuttig",
    "author": "Kristof van Gestel",
    "isbn": "9789490693701",
    "isbn10": null,
    "openLibraryWorkId": "OL23129204W",
    "openLibraryEditionId": "OL30969671M",
    "sourceKey": "9789490693701",
    "source": "official_catalog",
    "href": "https://schoolofartsgent.be/lees-kijk-luister/mooi-is-nuttig-de-kunstpraktijk-als-ervarings-en-reflectiemodel",
    "marker": "Kristof Van Gestel onderzoekt",
    "start": "Kristof Van Gestel"
  },
  {
    "id": "5630",
    "editionId": "5789",
    "locale": "nl",
    "title": "Schimmen met een ster",
    "author": "Hanne Hellemans",
    "isbn": "9789022319499",
    "isbn10": "9022319490",
    "openLibraryWorkId": "OL11803800W",
    "openLibraryEditionId": "OL16473794M",
    "sourceKey": "9789022319499",
    "source": "official_catalog",
    "href": "https://auschwitz.be/images/_sporen/sporen_v_h_49.pdf",
    "marker": "Hanne Hellemans onderzoekt de",
    "start": "Hanne Hellemans onderzoekt"
  },
  {
    "id": "5659",
    "editionId": "5818",
    "locale": "nl",
    "title": "Gouden jaren",
    "author": "Annegreet van Bergen",
    "isbn": "9789045023540",
    "isbn10": null,
    "openLibraryWorkId": "OL17606329W",
    "openLibraryEditionId": "OL26210222M",
    "sourceKey": "9789045023540",
    "source": "official_publisher",
    "href": "https://www.atlascontact.nl/boek/gouden-jaren/",
    "marker": "Annegreet van Bergen beschrijft",
    "start": "Annegreet van Bergen"
  },
  {
    "id": "5687",
    "editionId": "5846",
    "locale": "nl",
    "title": "Het teruggevonden kind",
    "author": "Eric de Kuyper",
    "isbn": "9789085064152",
    "isbn10": null,
    "openLibraryWorkId": "OL1714365W",
    "openLibraryEditionId": "OL16760418M",
    "sourceKey": "9789085064152",
    "source": "official_catalog",
    "href": "https://www.deslegte.com/het-teruggevonden-kind-343912/",
    "marker": "Eric de Kuyper keert",
    "start": "Eric de Kuyper"
  },
  {
    "id": "5843",
    "editionId": "6002",
    "locale": "nl",
    "title": "Rituelen van de Starling",
    "author": "Devney Perry",
    "isbn": "9789083585468",
    "isbn10": null,
    "openLibraryWorkId": "OL45101987W",
    "openLibraryEditionId": "OL62330723M",
    "sourceKey": "9789083585468",
    "source": "official_publisher",
    "href": "https://somanypages.nl/boeken/rituelen-van-de-starling-smp-limited-edition/",
    "marker": "Na een verwoestende aanval",
    "start": "Na een verwoestende"
  },
  {
    "id": "5957",
    "editionId": "6116",
    "locale": "nl",
    "title": "De strijd van Jenkins' oor",
    "author": "Michael Morpurgo",
    "isbn": "9789021611167",
    "isbn10": "9021611163",
    "openLibraryWorkId": "OL15857369W",
    "openLibraryEditionId": "OL35329331M",
    "sourceKey": "9789021611167",
    "source": "official_publisher",
    "href": "https://www.michaelmorpurgo.com/products/the-war-of-jenkins-ear-michael-morpurgo-9781780311500-2/",
    "marker": "Toby Jenkins voelt zich",
    "start": "Toby Jenkins voelt"
  },
  {
    "id": "6280",
    "editionId": "6439",
    "locale": "nl",
    "title": "De hormoonfabriek",
    "author": "Saskia Goldschmidt",
    "isbn": "9789059363694",
    "isbn10": "9059363698",
    "openLibraryWorkId": "OL23133615W",
    "openLibraryEditionId": "OL30973476M",
    "sourceKey": "9789059363694",
    "source": "official_publisher",
    "href": "https://www.uitgeverijcossee.nl/de-hormoonfabriek/9789059364882",
    "marker": "Ondernemer Mordechai de Paauw",
    "start": "Ondernemer Mordechai de"
  },
  {
    "id": "6357",
    "editionId": "6516",
    "locale": "nl",
    "title": "De oefenaar",
    "author": "Louis Ferron",
    "isbn": "9789023438854",
    "isbn10": "902343885X",
    "openLibraryWorkId": "OL846588W",
    "openLibraryEditionId": "OL9087075M",
    "sourceKey": "9789023438854",
    "source": "official_catalog",
    "href": "https://www.bibliotheek.nl/catalogus/titel.191274909.html/de-oefenaar/",
    "marker": "Een germanist verdiept zich",
    "start": "Een germanist verdiept"
  },
  {
    "id": "6479",
    "editionId": "6638",
    "locale": "nl",
    "title": "Hotel Linda",
    "author": "Arjan Visser",
    "isbn": "9789029585019",
    "isbn10": "9029585013",
    "openLibraryWorkId": "OL23233150W",
    "openLibraryEditionId": "OL31069322M",
    "sourceKey": "9789029585019",
    "source": "official_publisher",
    "href": "https://www.singeluitgeverijen.nl/de-arbeiderspers/boek/hotel-linda/",
    "marker": "Na vijfenzestig jaar keert",
    "start": "Na vijfenzestig jaar"
  },
  {
    "id": "6502",
    "editionId": "6661",
    "locale": "nl",
    "title": "Zadelpijn en ander damesleed",
    "author": "Liza van Sambeek",
    "isbn": "9789044603521",
    "isbn10": "9044603523",
    "openLibraryWorkId": "OL13753222W",
    "openLibraryEditionId": "OL23119404M",
    "sourceKey": "9789044603521",
    "source": "official_publisher",
    "href": "https://uitgeverijprometheus.nl/boeken/zadelpijn-en-ander-damesleed-e-boek/",
    "marker": "Zeven vrouwen van rond",
    "start": "Zeven vrouwen van"
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

  test(`recovery33 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
    assert.match(edition.sourceKey, /^97[89]\d{10}$/);
    assert.equal([...edition.sourceKey].reduce((sum, digit, i) => sum + Number(digit) * (i % 2 ? 3 : 1), 0) % 10, 0, 'attribution uses a valid ISBN-13 checksum');
    assert.equal(edition.sourceKey, edition.isbn, 'attribution retains the selected ISBN-13');
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

  test(`recovery33 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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


test('all 27 reviewed summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery33-tests', plugins: [react()],
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
      const renderedMarker = renderToStaticMarkup(createElement('span', null, edition.marker)).replace(/^<span>|<\/span>$/g, '');
      assert.ok(html.includes(renderedMarker), edition.id);
      assert.ok(description);
      const renderedParagraphs = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(match => match[1]);
      const expectedText = renderToStaticMarkup(createElement('span', null, description.text)).replace(/^<span>|<\/span>$/g, '');
      assert.equal(renderedParagraphs.join(' ').replace(/\s+/g, ' ').trim(), expectedText.replace(/\s+/g, ' ').trim(), `${edition.id}: paragraph formatting preserves the complete text and punctuation`);
      assert.ok(html.includes('href="' + edition.href.replaceAll('&', '&amp;') + '"'), edition.id);
      assert.match(html, /class="description-source"/);
      assert.doesNotMatch(html, /Loading the description|De beschrijving wordt geladen|could not load|kon tijdelijk niet|not available yet|geen geverifieerde|<[^>]+\shidden(?:\s|=|>)/);
    }
  } finally { await vite.close(); }
});

