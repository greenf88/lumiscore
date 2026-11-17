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

// Frozen round21 public identities; no catalogue identity changes are required.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "8702",
    "editionId": "8861",
    "locale": "en",
    "title": "Warriors : The Broken Code #1",
    "author": "Erin Hunter",
    "isbn": "9780062823533",
    "isbn10": "0062823531",
    "openLibraryWorkId": "OL20152848W",
    "openLibraryEditionId": "OL27958224M",
    "sourceKey": "9780062823533",
    "source": "official_catalog",
    "href": "https://warriorcats.com/books/lost-stars",
    "marker": "ShadowClan",
    "start": "A bitter winter"
  },
  {
    "id": "7895",
    "editionId": "8054",
    "locale": "en",
    "title": "The Diary of Frida Kahlo",
    "author": "Frida Kahlo",
    "isbn": "9780810959545",
    "isbn10": "0810959542",
    "openLibraryWorkId": "OL2815702W",
    "openLibraryEditionId": "OL7998943M",
    "sourceKey": "9780810959545",
    "source": "official_publisher",
    "href": "https://www.abramsbooks.com/product/diary-of-frida-kahlo_9780810959545/",
    "marker": "Carlos Fuentes",
    "start": "Frida Kahlo’s illustrated"
  },
  {
    "id": "7783",
    "editionId": "7942",
    "locale": "en",
    "title": "Theories of developmental psychology",
    "author": "Patricia H. Miller",
    "isbn": "9781429216340",
    "isbn10": "1429216344",
    "openLibraryWorkId": "OL16010083W",
    "openLibraryEditionId": "OL24913651M",
    "sourceKey": "9781429216340",
    "source": "official_catalog",
    "href": "https://www.ncbi.nlm.nih.gov/nlmcatalog/101608792",
    "marker": "Vygotsky",
    "start": "Patricia H. Miller"
  },
  {
    "id": "7120",
    "editionId": "7279",
    "locale": "en",
    "title": "The 8th Habit",
    "author": "Stephen R. Covey",
    "isbn": "9780743287937",
    "isbn10": "0743287932",
    "openLibraryWorkId": "OL2630077W",
    "openLibraryEditionId": "OL7948832M",
    "sourceKey": "9780743287937",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/The-8th-Habit/Stephen-R-Covey/The-Covey-Habits-Series/9780743287937",
    "marker": "personal voice",
    "start": "Stephen R. Covey"
  },
  {
    "id": "6900",
    "editionId": "7059",
    "locale": "en",
    "title": "Infotopia",
    "author": "Cass R. Sunstein",
    "isbn": "9780195340679",
    "isbn10": "0195340671",
    "openLibraryWorkId": "OL1952268W",
    "openLibraryEditionId": "OL9508542M",
    "sourceKey": "9780195340679",
    "source": "official_publisher",
    "href": "https://academic.oup.com/book/50393",
    "marker": "prediction markets",
    "start": "Cass R. Sunstein"
  },
  {
    "id": "7647",
    "editionId": "7806",
    "locale": "en",
    "title": "Witches",
    "author": "Michael Jordan",
    "isbn": "9781856261937",
    "isbn10": "185626193X",
    "openLibraryWorkId": "OL258177W",
    "openLibraryEditionId": "OL8995611M",
    "sourceKey": "9781856261937",
    "source": "official_catalog",
    "href": "https://wellcomecollection.org/works/anbf5qfv",
    "marker": "Sally Griffyn",
    "start": "Michael Jordan surveys"
  },
  {
    "id": "9077",
    "editionId": "9236",
    "locale": "en",
    "title": "People kill people",
    "author": "Ellen Hopkins",
    "isbn": "9781481442930",
    "isbn10": "1481442937",
    "openLibraryWorkId": "OL19751513W",
    "openLibraryEditionId": "OL26964560M",
    "sourceKey": "9781481442930",
    "source": "official_catalog",
    "href": "https://www.richlandlibrary.com/catalog/detail/1588761",
    "marker": "six teenagers",
    "start": "Over one tense"
  },
  {
    "id": "8802",
    "editionId": "8961",
    "locale": "en",
    "title": "Wolfsong",
    "author": "T. J. Klune",
    "isbn": "9781250890337",
    "isbn10": "1250890330",
    "openLibraryWorkId": "OL20565280W",
    "openLibraryEditionId": "OL50718113M",
    "sourceKey": "9781250890337",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9781250890337/wolfsong/",
    "marker": "Ox",
    "start": "Ox Matheson’s quiet"
  },
  {
    "id": "6609",
    "editionId": "6768",
    "locale": "en",
    "title": "Size 14 Is Not Fat Either",
    "author": "Meg Cabot",
    "isbn": "9780060525125",
    "isbn10": "0060525126",
    "openLibraryWorkId": "OL492831W",
    "openLibraryEditionId": "OL7277804M",
    "sourceKey": "9780060525125",
    "source": "official_publisher",
    "href": "https://www.panmacmillan.com/authors/meg-cabot/size-14-is-not-fat-either/9781447264774",
    "marker": "Heather Wells",
    "start": "Heather Wells expects"
  },
  {
    "id": "7627",
    "editionId": "7786",
    "locale": "en",
    "title": "Spoon-Fed",
    "author": "Tim Spector",
    "isbn": "9781529112733",
    "isbn10": null,
    "openLibraryWorkId": "OL21657779W",
    "openLibraryEditionId": "OL33810560M",
    "sourceKey": "9781529112733",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/441061/spoon-fed-by-tim-spector/9781529112733",
    "marker": "breakfast",
    "start": "Tim Spector examines"
  },
  {
    "id": "1492",
    "editionId": "1581",
    "locale": "en",
    "title": "Ararat",
    "author": "Frank Westerman",
    "isbn": "9781407019529",
    "isbn10": null,
    "openLibraryWorkId": "OL15170561W",
    "openLibraryEditionId": "OL24302252M",
    "sourceKey": "9781407019529",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/395994/ararat-by-frank-westerman/9780099512783",
    "marker": "Mount Ararat",
    "start": "Frank Westerman travels"
  },
  {
    "id": "4373",
    "editionId": "4532",
    "locale": "en",
    "title": "Always and Forever, Lara Jean",
    "author": "Jenny Han",
    "isbn": "9781534497252",
    "isbn10": "1534497250",
    "openLibraryWorkId": "OL19666031W",
    "openLibraryEditionId": "OL32601614M",
    "sourceKey": "9781534497252",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/Always-and-Forever-Lara-Jean/Jenny-Han/To-All-the-Boys-Ive-Loved-Before/9781534497252",
    "marker": "college",
    "start": "Lara Jean is"
  },
  {
    "id": "9325",
    "editionId": "9484",
    "locale": "en",
    "title": "Master and Apprentice (Star Wars)",
    "author": "Claudia Gray",
    "isbn": "9781787462403",
    "isbn10": "1787462404",
    "openLibraryWorkId": "OL20077655W",
    "openLibraryEditionId": "OL29448070M",
    "sourceKey": "9781787462403",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/439266/master-and-apprentice-star-wars-by-claudia-gray/9781787462403",
    "marker": "Pijal",
    "start": "Qui-Gon Jinn and"
  },
  {
    "id": "2107",
    "editionId": "2309",
    "locale": "en",
    "title": "Faust",
    "author": "Johann Wolfgang von Goethe",
    "isbn": "9780826407245",
    "isbn10": "0826407242",
    "openLibraryWorkId": "OL52456W",
    "openLibraryEditionId": "OL8167514M",
    "sourceKey": "9780826407245",
    "source": "official_catalog",
    "href": "https://ci.nii.ac.jp/ncid/BA53356838",
    "marker": "Mephistopheles",
    "start": "Dissatisfied with the"
  },
  {
    "id": "4159",
    "editionId": "4318",
    "locale": "en",
    "title": "Code Name Verity",
    "author": "Elizabeth Wein",
    "isbn": "9781423187097",
    "isbn10": null,
    "openLibraryWorkId": "OL16126144W",
    "openLibraryEditionId": "OL29869025M",
    "sourceKey": "9781423187097",
    "source": "official_catalog",
    "href": "https://elizabethwein.com/novel/code-name-verity/",
    "marker": "Maddie",
    "start": "Captured in enemy"
  },
  {
    "id": "7587",
    "editionId": "7746",
    "locale": "en",
    "title": "Somebody's Daughter",
    "author": "Ashley C. Ford",
    "isbn": "9781432890568",
    "isbn10": null,
    "openLibraryWorkId": "OL22061778W",
    "openLibraryEditionId": "OL34133347M",
    "sourceKey": "9781432890568",
    "source": "official_catalog",
    "href": "https://gc.wyldcatalog.org/Record/a2447042",
    "marker": "Indiana",
    "start": "Ashley C. Ford"
  },
  {
    "id": "4105",
    "editionId": "4264",
    "locale": "en",
    "title": "Discipline Equals Freedom",
    "author": "Jocko Willink",
    "isbn": "9781250276186",
    "isbn10": null,
    "openLibraryWorkId": "OL19716723W",
    "openLibraryEditionId": "OL30212473M",
    "sourceKey": "9781250276186",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9781250276186/disciplineequalsfreedom/",
    "marker": "procrastination",
    "start": "Jocko Willink presents"
  },
  {
    "id": "2170",
    "editionId": "2377",
    "locale": "en",
    "title": "The Horse and His Boy",
    "author": "C. S. Lewis",
    "isbn": "9780060234881",
    "isbn10": "0060234881",
    "openLibraryWorkId": "OL71058W",
    "openLibraryEditionId": "OL24380194M",
    "sourceKey": "9780060234881",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL24380194M",
    "marker": "Shasta",
    "start": "Shasta and the"
  },
  {
    "id": "1517",
    "editionId": "1620",
    "locale": "en",
    "title": "Genesis",
    "author": "Karin Slaughter",
    "isbn": "9781409061540",
    "isbn10": null,
    "openLibraryWorkId": "OL15171136W",
    "openLibraryEditionId": "OL24302828M",
    "sourceKey": "9781409061540",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/392838/genesis-by-karin-slaughter/9781409061540",
    "marker": "Sara Linton",
    "start": "Sara Linton hopes"
  },
  {
    "id": "2789",
    "editionId": "2948",
    "locale": "en",
    "title": "Cat and Mouse",
    "author": "James Patterson",
    "isbn": "9780747220220",
    "isbn10": "0747220220",
    "openLibraryWorkId": "OL167169W",
    "openLibraryEditionId": "OL7959399M",
    "sourceKey": "9780747220220",
    "source": "official_catalog",
    "href": "https://www.jamespatterson.com/titles/james-patterson/cat-mouse/9780316693295/",
    "marker": "Gary Soneji",
    "start": "Alex Cross faces"
  },
  {
    "id": "9042",
    "editionId": "9201",
    "locale": "en",
    "title": "16 Lighthouse Road",
    "author": "Debbie Macomber",
    "isbn": "9780373602964",
    "isbn10": null,
    "openLibraryWorkId": "OL1911536W",
    "openLibraryEditionId": "OL28978236M",
    "sourceKey": "9780373602964",
    "source": "official_catalog",
    "href": "https://debbiemacomber.com/books/16-lighthouse-road",
    "marker": "Olivia Lockhart",
    "start": "In Cedar Cove,"
  },
  {
    "id": "6780",
    "editionId": "6939",
    "locale": "en",
    "title": "The Trouble with Islam Today",
    "author": "Irshad Manji",
    "isbn": "9780312327002",
    "isbn10": "0312327005",
    "openLibraryWorkId": "OL2867231W",
    "openLibraryEditionId": "OL9350434M",
    "sourceKey": "9780312327002",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9780312327002/thetroublewithislamtoday/",
    "marker": "reform",
    "start": "Irshad Manji writes"
  },
  {
    "id": "669",
    "editionId": "669",
    "locale": "en",
    "title": "3rd Degree",
    "author": "James Patterson",
    "isbn": "9780755300235",
    "isbn10": "0755300238",
    "openLibraryWorkId": "OL167144W",
    "openLibraryEditionId": "OL7992784M",
    "sourceKey": "9780755300235",
    "source": "official_catalog",
    "href": "https://www.jamespatterson.com/titles/james-patterson/3rd-degree/9780446696647/",
    "marker": "Lindsay Boxer",
    "start": "An explosion in"
  },
  {
    "id": "649",
    "editionId": "649",
    "locale": "en",
    "title": "Double Cross",
    "author": "James Patterson",
    "isbn": "9780316004312",
    "isbn10": "0316004316",
    "openLibraryWorkId": "OL167150W",
    "openLibraryEditionId": "OL9684450M",
    "sourceKey": "9780316004312",
    "source": "official_catalog",
    "href": "https://www.jamespatterson.com/titles/james-patterson/double-cross/9780316026109/",
    "marker": "Brianna Stone",
    "start": "A series of"
  },
  {
    "id": "8872",
    "editionId": "9031",
    "locale": "en",
    "title": "Ash Princess",
    "author": "Laura Sebastian",
    "isbn": "9781524767082",
    "isbn10": null,
    "openLibraryWorkId": "OL19913987W",
    "openLibraryEditionId": "OL34059867M",
    "sourceKey": "9781524767082",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/556376/ash-princess-by-laura-sebastian/",
    "marker": "Theodosia",
    "start": "Theodosia has spent"
  },
  {
    "id": "9364",
    "editionId": "9523",
    "locale": "en",
    "title": "The Physician",
    "author": "Noah Gordon",
    "isbn": "9780449214268",
    "isbn10": "0449214265",
    "openLibraryWorkId": "OL2296577W",
    "openLibraryEditionId": "OL24948789M",
    "sourceKey": "9780449214268",
    "source": "official_catalog",
    "href": "https://noahgordon.com/",
    "marker": "Avicenna",
    "start": "In the eleventh"
  },
  {
    "id": "6072",
    "editionId": "6231",
    "locale": "nl",
    "title": "De orde van de dag",
    "author": "Éric Vuillard",
    "isbn": "9789029092708",
    "isbn10": "902909270X",
    "openLibraryWorkId": "OL19742698W",
    "openLibraryEditionId": "OL45297594M",
    "sourceKey": "9789029092708",
    "source": "official_publisher",
    "href": "https://www.lannoo.com/nl-be/literatuur-romans/de-orde-van-de-dag-9789402311228",
    "marker": "Oostenrijk",
    "start": "Éric Vuillard belicht"
  },
  {
    "id": "2526",
    "editionId": "2771",
    "locale": "en",
    "title": "The Secret Place",
    "author": "Tana French",
    "isbn": "9781444755619",
    "isbn10": "1444755617",
    "openLibraryWorkId": "OL17371637W",
    "openLibraryEditionId": "OL29402495M",
    "sourceKey": "9781444755619",
    "source": "official_publisher",
    "href": "https://www.hodder.co.uk/titles/tana-french/the-secret-place/9781444755619/",
    "marker": "Holly Mackey",
    "start": "A year after"
  },
  {
    "id": "4078",
    "editionId": "4237",
    "locale": "en",
    "title": "The Essential Ageless Body, Timeless Mind",
    "author": "Deepak Chopra",
    "isbn": "9780307407733",
    "isbn10": "030740773X",
    "openLibraryWorkId": "OL548765W",
    "openLibraryEditionId": "OL10353761M",
    "sourceKey": "9780307407733",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/27401/the-essential-ageless-body-timeless-mind-by-deepak-chopra/",
    "marker": "ageing",
    "start": "Deepak Chopra presents"
  },
  {
    "id": "2264",
    "editionId": "2481",
    "locale": "en",
    "title": "The Little Book of Common Sense Investing",
    "author": "John C. Bogle",
    "isbn": "9780470102107",
    "isbn10": "0470102101",
    "openLibraryWorkId": "OL3928758W",
    "openLibraryEditionId": "OL7596087M",
    "sourceKey": "9780470102107",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9781427201461/thelittlebookofcommonsenseinvesting/",
    "marker": "index funds",
    "start": "John C. Bogle"
  },
  {
    "id": "9752",
    "editionId": "9911",
    "locale": "en",
    "title": "Dirty",
    "author": "Megan Hart",
    "isbn": "9780373605132",
    "isbn10": "0373605137",
    "openLibraryWorkId": "OL8030158W",
    "openLibraryEditionId": "OL7417729M",
    "sourceKey": "9780373605132",
    "source": "official_catalog",
    "href": "https://www.meganhart.com/dirty/",
    "marker": "Elle",
    "start": "Elle keeps her"
  },
  {
    "id": "8277",
    "editionId": "8436",
    "locale": "en",
    "title": "Letters from Women Who Love Too Much",
    "author": "Robin Norwood",
    "isbn": "9780671661564",
    "isbn10": "0671661566",
    "openLibraryWorkId": "OL2647504W",
    "openLibraryEditionId": "OL7661435M",
    "sourceKey": "9780671661564",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/431132/letters-from-women-who-love-too-much-by-robin-norwood/9781784751616",
    "marker": "readers",
    "start": "Robin Norwood responds"
  },
  {
    "id": "8534",
    "editionId": "8693",
    "locale": "en",
    "title": "Pucking Around",
    "author": "Emily Rath",
    "isbn": "9781496752406",
    "isbn10": "1496752406",
    "openLibraryWorkId": "OL36042862W",
    "openLibraryEditionId": "OL50707114M",
    "sourceKey": "9781496752406",
    "source": "official_publisher",
    "href": "https://www.kensingtonbooks.com/shop/pucking-around-9781496758798/",
    "marker": "Rachel Price",
    "start": "Rachel Price arrives"
  },
  {
    "id": "7355",
    "editionId": "7514",
    "locale": "en",
    "title": "Boom",
    "author": "Michael Shnayerson",
    "isbn": "9781541758728",
    "isbn10": null,
    "openLibraryWorkId": "OL20149510W",
    "openLibraryEditionId": "OL29862766M",
    "sourceKey": "9781541758728",
    "source": "official_publisher",
    "href": "https://www.hachettebookgroup.com/titles/michael-shnayerson/boom/9781541758728/",
    "marker": "Larry Gagosian",
    "start": "Michael Shnayerson follows"
  },
  {
    "id": "2157",
    "editionId": "2360",
    "locale": "en",
    "title": "FAGGOTS",
    "author": "Larry Kramer",
    "isbn": "9780749390594",
    "isbn10": "074939059X",
    "openLibraryWorkId": "OL3138747W",
    "openLibraryEditionId": "OL7966580M",
    "sourceKey": "9780749390594",
    "source": "official_catalog",
    "href": "https://books.google.com/books?id=faKCFSlFbKkC",
    "marker": "Fred Lemish",
    "start": "Approaching forty, Fred"
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

  test(`recovery21 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery21 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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


test('all thirty-five recovery summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery21-tests', plugins: [react()],
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

