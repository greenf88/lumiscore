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

// Frozen round35 public identities; existing stored descriptions remain authoritative.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "3191",
    "editionId": "3350",
    "locale": "nl",
    "title": "Rode sneeuw in december",
    "author": "Simone van der Vlugt",
    "isbn": "9789041422668",
    "isbn10": "9041422668",
    "openLibraryWorkId": "OL19964028W",
    "openLibraryEditionId": "OL27144247M",
    "sourceKey": "9789041422668",
    "source": "official_catalog",
    "href": "https://www.bibliotheek.nl/catalogus/titel.425898490.html/rode-sneeuw-in-december/",
    "marker": "In het zestiende-eeuwse Leiden wordt een katholiek meisje verliefd op een jonge lutherse arts",
    "start": "In het zestiende-eeuwse"
  },
  {
    "id": "9257",
    "editionId": "9416",
    "locale": "en",
    "title": "Gray Mountain",
    "author": "John Grisham",
    "isbn": "9781444798821",
    "isbn10": "1444798820",
    "openLibraryWorkId": "OL17116913W",
    "openLibraryEditionId": "OL33955702M",
    "sourceKey": "9781444798821",
    "source": "official_publisher",
    "href": "https://jgrisham.com/gray-mountain",
    "marker": "The financial crisis interrupts Samantha Kofer’s career at a large New York law firm",
    "start": "The financial crisis"
  },
  {
    "id": "9048",
    "editionId": "9207",
    "locale": "en",
    "title": "Dopefiend",
    "author": "Donald Goines",
    "isbn": "9780870679384",
    "isbn10": "0870679384",
    "openLibraryWorkId": "OL2617862W",
    "openLibraryEditionId": "OL8344375M",
    "sourceKey": "9780870679384",
    "source": "official_publisher",
    "href": "https://www.kensingtonbooks.com/shop/dopefiend-9781496733290/",
    "marker": "Teddy and Terry begin their relationship with the prospect of a shared future",
    "start": "Teddy and Terry"
  },
  {
    "id": "1323",
    "editionId": "1341",
    "locale": "en",
    "title": "The Titan's Curse",
    "author": "Rick Riordan",
    "isbn": "9781423101451",
    "isbn10": "1423101456",
    "openLibraryWorkId": "OL492647W",
    "openLibraryEditionId": "OL8493301M",
    "sourceKey": "9781423101451",
    "source": "official_publisher",
    "href": "https://rickriordan.com/book/the-titans-curse/",
    "marker": "Grover discovers two young half-bloods and calls Percy Jackson for help",
    "start": "Grover discovers two"
  },
  {
    "id": "1499",
    "editionId": "1593",
    "locale": "en",
    "title": "Arrow of God",
    "author": "Chinua Achebe",
    "isbn": "9780141930688",
    "isbn10": null,
    "openLibraryWorkId": "OL891814W",
    "openLibraryEditionId": "OL24295791M",
    "sourceKey": "9780141930688",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/398/arrow-of-god-by-chinua-achebe/",
    "marker": "Ezeulu is the chief priest of Ulu, the deity worshipped by the villages of Umuaro",
    "start": "Ezeulu is the"
  },
  {
    "id": "2415",
    "editionId": "2645",
    "locale": "en",
    "title": "Fooled by Randomness",
    "author": "Nassim Nicholas Taleb",
    "isbn": "9781587991905",
    "isbn10": "158799190X",
    "openLibraryWorkId": "OL3295029W",
    "openLibraryEditionId": "OL8826555M",
    "sourceKey": "9781587991905",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/176225/fooled-by-randomness-by-nassim-nicholas-taleb/9781400067930/",
    "marker": "Nassim Nicholas Taleb asks how often success attributed to skill is actually a result of chance",
    "start": "Nassim Nicholas Taleb"
  },
  {
    "id": "3130",
    "editionId": "3289",
    "locale": "en",
    "title": "Night Film",
    "author": "Marisha Pessl",
    "isbn": "9780099559245",
    "isbn10": null,
    "openLibraryWorkId": "OL16805559W",
    "openLibraryEditionId": "OL28511569M",
    "sourceKey": "9780099559245",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/129972/night-film-by-marisha-pessl/",
    "marker": "Ashley Cordova is found dead in Manhattan, and the official conclusion is suicide",
    "start": "Ashley Cordova is"
  },
  {
    "id": "3497",
    "editionId": "3656",
    "locale": "nl",
    "title": "Toen wij wezen waren",
    "author": "Kazuo Ishiguro",
    "isbn": "9789045006512",
    "isbn10": "9045006510",
    "openLibraryWorkId": "OL59042W",
    "openLibraryEditionId": "OL35336431M",
    "sourceKey": "9789045006512",
    "source": "official_publisher",
    "href": "https://rcwlitagency.com/books/when-we-were-orphans/",
    "marker": "Christopher Banks heeft in het Engeland van de jaren dertig naam gemaakt als detective",
    "start": "Christopher Banks heeft"
  },
  {
    "id": "2427",
    "editionId": "11579",
    "locale": "en",
    "title": "Liar's poker",
    "author": "Michael Lewis",
    "isbn": "9780140143454",
    "isbn10": "0140143459",
    "openLibraryWorkId": "OL7944812W",
    "openLibraryEditionId": "OL1855208M",
    "sourceKey": "9780140143454",
    "source": "official_publisher",
    "href": "https://www.hachette.co.uk/titles/michael-lewis/liars-poker/9781848948808/",
    "marker": "Michael Lewis recalls his passage from trainee to bond salesman at Salomon Brothers during the financial boom of the 1980s",
    "start": "Michael Lewis recalls"
  },
  {
    "id": "4034",
    "editionId": "4193",
    "locale": "en",
    "title": "The Soul of a New Machine",
    "author": "Tracy Kidder",
    "isbn": "9780380599318",
    "isbn10": "0380599317",
    "openLibraryWorkId": "OL98218W",
    "openLibraryEditionId": "OL24951788M",
    "sourceKey": "9780380599318",
    "source": "official_publisher",
    "href": "https://www.hachettebookgroup.com/titles/tracy-kidder/the-soul-of-a-new-machine/9780316204552/",
    "marker": "Tracy Kidder follows a company’s effort to develop and bring a new computer to market",
    "start": "Tracy Kidder follows"
  },
  {
    "id": "1479",
    "editionId": "1558",
    "locale": "en",
    "title": "The Exorcist",
    "author": "William Peter Blatty",
    "isbn": "9781887368094",
    "isbn10": "1887368094",
    "openLibraryWorkId": "OL927199W",
    "openLibraryEditionId": "OL8708151M",
    "sourceKey": "9781887368094",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/The_Exorcist.html?id=EJeN8fch1l8C",
    "marker": "Regan, the daughter of an actress living in Washington, D",
    "start": "Regan, the daughter"
  },
  {
    "id": "3685",
    "editionId": "3844",
    "locale": "en",
    "title": "Bullet Journal Method",
    "author": "Ryder Carroll",
    "isbn": "9780008261405",
    "isbn10": null,
    "openLibraryWorkId": "OL19764772W",
    "openLibraryEditionId": "OL30156274M",
    "sourceKey": "9780008261405",
    "source": "official_publisher",
    "href": "https://bulletjournal.com/pages/book",
    "marker": "Ryder Carroll explains the thinking behind Bullet Journal, a paper-based approach to organising tasks and reflecting on priorities",
    "start": "Ryder Carroll explains"
  },
  {
    "id": "1636",
    "editionId": "1770",
    "locale": "nl",
    "title": "Danse Macabre",
    "author": "Paul van Loon",
    "isbn": "9789025888008",
    "isbn10": "9025888003",
    "openLibraryWorkId": "OL44107033W",
    "openLibraryEditionId": "OL60325510M",
    "sourceKey": "9789025888008",
    "source": "official_publisher",
    "href": "https://www.kinderboeken.nl/boek/danse-macabre/",
    "marker": "Florian en Isabella negeren het verbod van hun stiefvader en sluipen op een avond in 1876 een abdij binnen",
    "start": "Florian en Isabella"
  },
  {
    "id": "5794",
    "editionId": "5953",
    "locale": "nl",
    "title": "Museum van onvoorwaardelijke overgave",
    "author": "Dubravka Ugrešić",
    "isbn": "9789038811574",
    "isbn10": "9038811578",
    "openLibraryWorkId": "OL276301W",
    "openLibraryEditionId": "OL47319722M",
    "sourceKey": "9789038811574",
    "source": "official_publisher",
    "href": "https://www.uitgeverijathenaeum.nl/nijgh-van-ditmar/boek/museum-van-onvoorwaardelijke-overgave/",
    "marker": "Dubravka Ugrešić brengt herinneringen samen aan een wereld die door oorlog en ballingschap onbereikbaar is geworden",
    "start": "Dubravka Ugrešić brengt"
  },
  {
    "id": "3246",
    "editionId": "3405",
    "locale": "nl",
    "title": "Fata Morgana",
    "author": "Chika Unigwe",
    "isbn": "9789085420927",
    "isbn10": null,
    "openLibraryWorkId": "OL3152233W",
    "openLibraryEditionId": "OL16826718M",
    "sourceKey": "9789085420927",
    "source": "official_publisher",
    "href": "https://metadata.isbn.nl/326938/fata-morgana.html",
    "marker": "Vier Afrikaanse vrouwen vertrekken met de verwachting elders een beter leven op te bouwen",
    "start": "Vier Afrikaanse vrouwen"
  },
  {
    "id": "5838",
    "editionId": "5997",
    "locale": "nl",
    "title": "Larung",
    "author": "Ayu Utami",
    "isbn": "9789044503166",
    "isbn10": "9044503162",
    "openLibraryWorkId": "OL2325371W",
    "openLibraryEditionId": "OL32419168M",
    "sourceKey": "9789044503166",
    "source": "official_publisher",
    "href": "https://www.unionsverlag.com/info/title.asp?title_id=5357",
    "marker": "Ayu Utami verbindt de levens van Saman, Yasmin, Laila en hun vrienden met de politieke verhoudingen in Indonesië onder Soeharto",
    "start": "Ayu Utami verbindt"
  },
  {
    "id": "5959",
    "editionId": "6118",
    "locale": "nl",
    "title": "Ministerie van pijn",
    "author": "Dubravka Ugrešić",
    "isbn": "9789044505573",
    "isbn10": null,
    "openLibraryWorkId": "OL276299W",
    "openLibraryEditionId": "OL58467563M",
    "sourceKey": "9789044505573",
    "source": "official_publisher",
    "href": "https://bourgoisediteur.fr/catalogue/le-ministere-de-la-douleur",
    "marker": "Na haar vlucht uit het voormalige Joegoslavië geeft Tanja literatuuronderwijs aan de Universiteit van Amsterdam",
    "start": "Na haar vlucht"
  },
  {
    "id": "1743",
    "editionId": "1892",
    "locale": "nl",
    "title": "Dichtertje de Uitvreter Titaantjes",
    "author": "Nescio",
    "isbn": "9798712600991",
    "isbn10": null,
    "openLibraryWorkId": "OL30878398W",
    "openLibraryEditionId": "OL42422917M",
    "sourceKey": "9798712600991",
    "source": "official_publisher",
    "href": "https://www.uitgeverijathenaeum.nl/nijgh-van-ditmar/boek/de-uitvreter-titaantjes-dichtertje-mene-tekel/",
    "marker": "Nescio laat in Dichtertje, De uitvreter en Titaantjes zien hoe hoge verwachtingen botsen met een alledaags bestaan",
    "start": "Nescio laat in"
  },
  {
    "id": "7504",
    "editionId": "7663",
    "locale": "en",
    "title": "Technologists",
    "author": "Matthew Pearl",
    "isbn": "9781846550867",
    "isbn10": null,
    "openLibraryWorkId": "OL15933622W",
    "openLibraryEditionId": "OL28990890M",
    "sourceKey": "9781846550867",
    "source": "official_publisher",
    "href": "https://www.matthewpearl.com/mobile/",
    "marker": "In Boston in 1868, unexplained disasters turn attention towards the new Massachusetts Institute of Technology",
    "start": "In Boston in"
  },
  {
    "id": "7835",
    "editionId": "7994",
    "locale": "en",
    "title": "A history of the world in 6 glasses",
    "author": "Tom Standage",
    "isbn": "9780802714473",
    "isbn10": "0802714471",
    "openLibraryWorkId": "OL1906739W",
    "openLibraryEditionId": "OL3310815M",
    "sourceKey": "9780802714473",
    "source": "official_publisher",
    "href": "https://www.bloomsbury.com/us/history-of-the-world-in-6-glasses-9780802715524/",
    "marker": "Tom Standage follows beer, wine, spirits, coffee, tea and cola through different periods of world history",
    "start": "Tom Standage follows"
  },
  {
    "id": "8156",
    "editionId": "8315",
    "locale": "en",
    "title": "Psychopolitics: Neoliberalism and New Technologies of Power",
    "author": "Byung-Chul Han",
    "isbn": "9781784785772",
    "isbn10": null,
    "openLibraryWorkId": "OL20812815W",
    "openLibraryEditionId": "OL28375323M",
    "sourceKey": "9781784785772",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/557122/psychopolitics-by-byung-chul-han/",
    "marker": "Byung-Chul Han examines forms of power that work through people’s desires, emotions and sense of freedom",
    "start": "Byung-Chul Han examines"
  },
  {
    "id": "4809",
    "editionId": "4968",
    "locale": "en",
    "title": "Ake",
    "author": "Wole Soyinka",
    "isbn": "9780394722191",
    "isbn10": "0394722191",
    "openLibraryWorkId": "OL15125397W",
    "openLibraryEditionId": "OL7462254M",
    "sourceKey": "9780394722191",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/170640/ake-by-wole-soyinka/",
    "marker": "Wole Soyinka recalls his childhood in Aké, a Yoruba community in western Nigeria, in the years surrounding the Second World War",
    "start": "Wole Soyinka recalls"
  },
  {
    "id": "4260",
    "editionId": "4419",
    "locale": "en",
    "title": "Love from a to Z",
    "author": "S. K. Ali",
    "isbn": "9781663629661",
    "isbn10": null,
    "openLibraryWorkId": "OL20151297W",
    "openLibraryEditionId": "OL37679704M",
    "sourceKey": "9781663629661",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/Love-from-A-to-Z/S-K-Ali/A-Coming-of-Age-Romance/9781534442733",
    "marker": "After challenging an Islamophobic teacher, Zayneb is suspended and travels to stay with her aunt in Doha",
    "start": "After challenging an"
  },
  {
    "id": "7175",
    "editionId": "7334",
    "locale": "en",
    "title": "A Zoo in My Luggage",
    "author": "Gerald Malcolm Durrell",
    "isbn": "9780140020847",
    "isbn10": "0140020845",
    "openLibraryWorkId": "OL10509140W",
    "openLibraryEditionId": "OL9300578M",
    "sourceKey": "9780140020847",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/3920/a-zoo-in-my-luggage-by-durrell-gerald/9780241955826",
    "marker": "Gerald Durrell recounts an expedition to Cameroon undertaken with the ambition of establishing his own zoo",
    "start": "Gerald Durrell recounts"
  },
  {
    "id": "8188",
    "editionId": "8347",
    "locale": "en",
    "title": "Dogsbody",
    "author": "Diana Wynne Jones",
    "isbn": "9780688081911",
    "isbn10": "0688081916",
    "openLibraryWorkId": "OL60144W",
    "openLibraryEditionId": "OL7726165M",
    "sourceKey": "9780688081911",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/309797/dogsbody-by-diana-wynne-jones/9781101566985/",
    "marker": "Sirius, the Dog Star, is condemned for a murder he did not commit and sent to Earth in the body of a dog",
    "start": "Sirius, the Dog"
  },
  {
    "id": "2482",
    "editionId": "2718",
    "locale": "en",
    "title": "The Five Dysfunctions of a Team",
    "author": "Patrick Lencioni",
    "isbn": "9780787960759",
    "isbn10": "0787960756",
    "openLibraryWorkId": "OL1835386W",
    "openLibraryEditionId": "OL8148797M",
    "sourceKey": "9780787960759",
    "source": "official_publisher",
    "href": "https://www.tablegroup.com/product/dysfunctions/",
    "marker": "Patrick Lencioni uses a leadership fable to examine why talented people can struggle to work together",
    "start": "Patrick Lencioni uses"
  },
  {
    "id": "7581",
    "editionId": "7740",
    "locale": "en",
    "title": "Stuff Matters",
    "author": "Mark Miodownik",
    "isbn": "9780544236042",
    "isbn10": "0544236041",
    "openLibraryWorkId": "OL17778974W",
    "openLibraryEditionId": "OL26843837M",
    "sourceKey": "9780544236042",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/182165/stuff-matters-by-miodownik-mark/9780141970745",
    "marker": "Mark Miodownik examines the materials that make everyday objects possible",
    "start": "Mark Miodownik examines"
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

  test(`recovery35 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery35 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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
    cacheDir: root + '.wrangler/node_modules/recovery35-tests', plugins: [react()],
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
