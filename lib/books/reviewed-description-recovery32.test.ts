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

// Frozen round32 public identities; existing stored descriptions remain authoritative.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "1371",
    "editionId": "1406",
    "locale": "en",
    "title": "Maurice",
    "author": "E. M. Forster",
    "isbn": "9780848804909",
    "isbn10": "0848804902",
    "openLibraryWorkId": "OL88877W",
    "openLibraryEditionId": "OL8258173M",
    "sourceKey": "9780848804909",
    "source": "official_publisher",
    "href": "https://www.penguin.com.au/books/maurice-9780141441139",
    "marker": "Maurice Hall has",
    "start": "Maurice Hall has"
  },
  {
    "id": "3148",
    "editionId": "3307",
    "locale": "en",
    "title": "Criss Cross",
    "author": "James Patterson",
    "isbn": "9781787461857",
    "isbn10": null,
    "openLibraryWorkId": "OL20493672W",
    "openLibraryEditionId": "OL29461464M",
    "sourceKey": "9781787461857",
    "source": "official_publisher",
    "href": "https://www.jamespatterson.com/titles/james-patterson/criss-cross/9781538715390/",
    "marker": "Alex Cross and",
    "start": "Alex Cross and"
  },
  {
    "id": "3254",
    "editionId": "3413",
    "locale": "nl",
    "title": "Samen hier",
    "author": "Oliver Jeffers",
    "isbn": "9789026146565",
    "isbn10": "9026146566",
    "openLibraryWorkId": "OL19663638W",
    "openLibraryEditionId": "OL44895910M",
    "sourceKey": "9789026146565",
    "source": "official_publisher",
    "href": "https://www.uitgeverijdefontein.nl/boek/samen-hier/",
    "marker": "Hoe leg je",
    "start": "Hoe leg je"
  },
  {
    "id": "3256",
    "editionId": "3415",
    "locale": "nl",
    "title": "De wildernis in",
    "author": "Erin Hunter",
    "isbn": "9789078345176",
    "isbn10": null,
    "openLibraryWorkId": "OL265501W",
    "openLibraryEditionId": "OL37843740M",
    "sourceKey": "9789078345176",
    "source": "official_publisher",
    "href": "https://www.pelckmansuitgevers.be/warrior-cats-de-wildernis-in.html",
    "marker": "Huiskat Rufus ontdekt",
    "start": "Huiskat Rufus ontdekt"
  },
  {
    "id": "3312",
    "editionId": "3471",
    "locale": "nl",
    "title": "De rebel van de familie",
    "author": "Frank J. Sulloway",
    "isbn": "9789053335918",
    "isbn10": "9053335919",
    "openLibraryWorkId": "OL2633582W",
    "openLibraryEditionId": "OL35330929M",
    "sourceKey": "9789053335918",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/175232/born-to-rebel-by-frank-j-sulloway/",
    "marker": "Waarom kunnen kinderen",
    "start": "Waarom kunnen kinderen"
  },
  {
    "id": "3438",
    "editionId": "3597",
    "locale": "nl",
    "title": "Winterzon",
    "author": "John Grisham",
    "isbn": "9789046112687",
    "isbn10": "9046112683",
    "openLibraryWorkId": "OL76976W",
    "openLibraryEditionId": "OL33220340M",
    "sourceKey": "9789046112687",
    "source": "official_publisher",
    "href": "https://www.awbruna.nl/boek/romans/john-grisham/winterzon/",
    "marker": "Nu hun dochter",
    "start": "Nu hun dochter"
  },
  {
    "id": "3478",
    "editionId": "3637",
    "locale": "nl",
    "title": "De witte wijven van Eastwick",
    "author": "John Updike",
    "isbn": "9789026970412",
    "isbn10": "9026970412",
    "openLibraryWorkId": "OL463636W",
    "openLibraryEditionId": "OL45272709M",
    "sourceKey": "9789026970412",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/181963/the-witches-of-eastwick-by-john-updike/",
    "marker": "In het kustplaatsje",
    "start": "In het kustplaatsje"
  },
  {
    "id": "3517",
    "editionId": "3676",
    "locale": "nl",
    "title": "Twee verstrengelde kronen",
    "author": "Rachel Gillig",
    "isbn": "9789464823769",
    "isbn10": null,
    "openLibraryWorkId": "OL35780604W",
    "openLibraryEditionId": "OL62083490M",
    "sourceKey": "9789464823769",
    "source": "official_publisher",
    "href": "https://www.hachettebookgroup.com/titles/rachel-gillig/two-twisted-crowns/9780316312882/",
    "marker": "Elspeth en Ravyn",
    "start": "Elspeth en Ravyn"
  },
  {
    "id": "3579",
    "editionId": "3738",
    "locale": "en",
    "title": "Beowulf",
    "author": "Seamus Heaney",
    "isbn": "9780393320978",
    "isbn10": "0393320979",
    "openLibraryWorkId": "OL1810107W",
    "openLibraryEditionId": "OL7457254M",
    "sourceKey": "9780393320978",
    "source": "official_publisher",
    "href": "https://wwnorton.co.uk/books/9780393320978-beowulf",
    "marker": "The warrior Beowulf",
    "start": "The warrior Beowulf"
  },
  {
    "id": "3597",
    "editionId": "3756",
    "locale": "en",
    "title": "Mastery",
    "author": "Robert Greene",
    "isbn": "9780670024964",
    "isbn10": "0670024961",
    "openLibraryWorkId": "OL17429337W",
    "openLibraryEditionId": "OL27139399M",
    "sourceKey": "9780670024964",
    "source": "official_publisher",
    "href": "https://profilebooks.com/work/mastery/",
    "marker": "Robert Greene examines",
    "start": "Robert Greene examines"
  },
  {
    "id": "3666",
    "editionId": "3825",
    "locale": "en",
    "title": "Escape from evil",
    "author": "Ernest Becker",
    "isbn": "9780029023006",
    "isbn10": "0029023009",
    "openLibraryWorkId": "OL154567W",
    "openLibraryEditionId": "OL21226724M",
    "sourceKey": "9780029023006",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/Escape-from-Evil/Ernest-Becker/9780029024508",
    "marker": "Ernest Becker extends",
    "start": "Ernest Becker extends"
  },
  {
    "id": "3694",
    "editionId": "3853",
    "locale": "en",
    "title": "Race and Reunion",
    "author": "David W. Blight",
    "isbn": "9780674008199",
    "isbn10": "0674008197",
    "openLibraryWorkId": "OL4640578W",
    "openLibraryEditionId": "OL7670719M",
    "sourceKey": "9780674008199",
    "source": "official_catalog",
    "href": "https://blackstudies.yale.edu/publications/race-and-reunion-civil-war-american-memory",
    "marker": "David Blight examines",
    "start": "David Blight examines"
  },
  {
    "id": "3723",
    "editionId": "3882",
    "locale": "en",
    "title": "The Whole World Is Watching",
    "author": "Todd Gitlin",
    "isbn": "9780520040243",
    "isbn10": "0520040244",
    "openLibraryWorkId": "OL15215145W",
    "openLibraryEditionId": "OL7708607M",
    "sourceKey": "9780520040243",
    "source": "official_publisher",
    "href": "https://www.ucpress.edu/books/the-whole-world-is-watching/paper",
    "marker": "Todd Gitlin investigates",
    "start": "Todd Gitlin investigates"
  },
  {
    "id": "3729",
    "editionId": "3888",
    "locale": "en",
    "title": "Fatal invention",
    "author": "Dorothy E. Roberts",
    "isbn": "9781595584953",
    "isbn10": "1595584951",
    "openLibraryWorkId": "OL16214686W",
    "openLibraryEditionId": "OL25077585M",
    "sourceKey": "9781595584953",
    "source": "official_publisher",
    "href": "https://thenewpress.org/books/fatal-invention/",
    "marker": "Dorothy Roberts investigates",
    "start": "Dorothy Roberts investigates"
  },
  {
    "id": "3748",
    "editionId": "3907",
    "locale": "en",
    "title": "The Code Book",
    "author": "Simon Singh",
    "isbn": "9780385495325",
    "isbn10": "0385495323",
    "openLibraryWorkId": "OL31157W",
    "openLibraryEditionId": "OL7440495M",
    "sourceKey": "9780385495325",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/168002/the-code-book-by-simon-singh/",
    "marker": "Simon Singh traces",
    "start": "Simon Singh traces"
  },
  {
    "id": "3767",
    "editionId": "3926",
    "locale": "en",
    "title": "Boys In The Boat",
    "author": "Daniel James Brown",
    "isbn": "9781447210986",
    "isbn10": "1447210980",
    "openLibraryWorkId": "OL17038299W",
    "openLibraryEditionId": "OL28136821M",
    "sourceKey": "9781447210986",
    "source": "official_publisher",
    "href": "https://www.panmacmillan.com/authors/daniel-james-brown/the-boys-in-the-boat/9781447210986",
    "marker": "A University of",
    "start": "A University of"
  },
  {
    "id": "3785",
    "editionId": "3944",
    "locale": "en",
    "title": "Wise Guy",
    "author": "Nicholas Pileggi",
    "isbn": "9780671633929",
    "isbn10": "0671633929",
    "openLibraryWorkId": "OL2958812W",
    "openLibraryEditionId": "OL7660706M",
    "sourceKey": "9780671633929",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/Wiseguy/Nicholas-Pileggi/9781982129903",
    "marker": "Nicholas Pileggi reconstructs",
    "start": "Nicholas Pileggi reconstructs"
  },
  {
    "id": "3875",
    "editionId": "4034",
    "locale": "en",
    "title": "Storytelling with Data",
    "author": "Cole Nussbaumer Knaflic",
    "isbn": "9781119002253",
    "isbn10": "1119002257",
    "openLibraryWorkId": "OL17659741W",
    "openLibraryEditionId": "OL26264405M",
    "sourceKey": "9781119002253",
    "source": "official_publisher",
    "href": "https://www.wiley.com/en-us/storytelling-with-data-a-data-visualization-guide-for-business-professionals-p-9781119002062",
    "marker": "Cole Nussbaumer Knaflic",
    "start": "Cole Nussbaumer Knaflic"
  },
  {
    "id": "3898",
    "editionId": "4057",
    "locale": "en",
    "title": "Band of Brothers",
    "author": "Stephen E. Ambrose",
    "isbn": "9781501179402",
    "isbn10": null,
    "openLibraryWorkId": "OL478550W",
    "openLibraryEditionId": "OL28869123M",
    "sourceKey": "9781501179402",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.net/books/Band-of-Brothers/Stephen-E-Ambrose/9781501179402",
    "marker": "Stephen Ambrose follows",
    "start": "Stephen Ambrose follows"
  },
  {
    "id": "7688",
    "editionId": "7847",
    "locale": "en",
    "title": "Dry",
    "author": "Augusten Burroughs",
    "isbn": "9780312272050",
    "isbn10": "0312272057",
    "openLibraryWorkId": "OL5728454W",
    "openLibraryEditionId": "OL24856738M",
    "sourceKey": "9780312272050",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9781250034403/dry/",
    "marker": "Augusten Burroughs is",
    "start": "Augusten Burroughs is"
  },
  {
    "id": "6945",
    "editionId": "7104",
    "locale": "en",
    "title": "The seven magpies",
    "author": "Monica Hughes",
    "isbn": "9780006393665",
    "isbn10": "0006393667",
    "openLibraryWorkId": "OL574845W",
    "openLibraryEditionId": "OL35736409M",
    "sourceKey": "9780006393665",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/The_Seven_Magpies.html?id=0VpO5MpEzq4C",
    "marker": "A girl sent",
    "start": "A girl sent"
  },
  {
    "id": "3972",
    "editionId": "4131",
    "locale": "en",
    "title": "The Pilgrimage",
    "author": "Paulo Coelho",
    "isbn": "9780007639540",
    "isbn10": "0007639546",
    "openLibraryWorkId": "OL796594W",
    "openLibraryEditionId": "OL32133444M",
    "sourceKey": "9780007639540",
    "source": "official_publisher",
    "href": "https://www.harperreach.com/products/the-pilgrimage-paulo-coelho-9780007222575/",
    "marker": "Paulo Coelho travels",
    "start": "Paulo Coelho travels"
  },
  {
    "id": "3974",
    "editionId": "4133",
    "locale": "en",
    "title": "Why Fish Don't Exist",
    "author": "Lulu Miller",
    "isbn": "9781501160370",
    "isbn10": null,
    "openLibraryWorkId": "OL20732649W",
    "openLibraryEditionId": "OL29822227M",
    "sourceKey": "9781501160370",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/Why-Fish-Dont-Exist/Lulu-Miller/9781501160370",
    "marker": "Lulu Miller turns",
    "start": "Lulu Miller turns"
  },
  {
    "id": "4013",
    "editionId": "4172",
    "locale": "en",
    "title": "A mother's reckoning",
    "author": "Sue Klebold",
    "isbn": "9781101902752",
    "isbn10": "1101902752",
    "openLibraryWorkId": "OL17891134W",
    "openLibraryEditionId": "OL27198824M",
    "sourceKey": "9781101902752",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/430398/a-mothers-reckoning-by-sue-klebold/9780753551974",
    "marker": "Sue Klebold looks",
    "start": "Sue Klebold looks"
  },
  {
    "id": "4036",
    "editionId": "4195",
    "locale": "en",
    "title": "I Used to Have a Plan",
    "author": "Alessandra Olanow",
    "isbn": "9780062973634",
    "isbn10": null,
    "openLibraryWorkId": "OL21913102W",
    "openLibraryEditionId": "OL30247638M",
    "sourceKey": "9780062973634",
    "source": "official_catalog",
    "href": "https://alessandraolanow.com/books/",
    "marker": "Alessandra Olanow combines",
    "start": "Alessandra Olanow combines"
  },
  {
    "id": "4042",
    "editionId": "4201",
    "locale": "en",
    "title": "The Daily Book of Positive Quotations",
    "author": "Linda Picone",
    "isbn": "9781577491743",
    "isbn10": "1577491742",
    "openLibraryWorkId": "OL9442774W",
    "openLibraryEditionId": "OL12241798M",
    "sourceKey": "9781577491743",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.com/books/The-Daily-Book-of-Positive-Quotations/Linda-Picone/9781577491743",
    "marker": "Linda Picone gathers",
    "start": "Linda Picone gathers"
  },
  {
    "id": "4044",
    "editionId": "4203",
    "locale": "en",
    "title": "Clean Architecture",
    "author": "Robert C. Martin",
    "isbn": "9780134494166",
    "isbn10": "0134494164",
    "openLibraryWorkId": "OL19809141W",
    "openLibraryEditionId": "OL31838215M",
    "sourceKey": "9780134494166",
    "source": "official_publisher",
    "href": "https://www.informit.com/store/clean-architecture-a-craftsmans-guide-to-software-structure-9780134494166",
    "marker": "Robert C. Martin",
    "start": "Robert C. Martin"
  },
  {
    "id": "4241",
    "editionId": "4400",
    "locale": "en",
    "title": "Happy Place",
    "author": "Emily Henry",
    "isbn": "9780593638446",
    "isbn10": "0593638441",
    "openLibraryWorkId": "OL28607665W",
    "openLibraryEditionId": "OL47295567M",
    "sourceKey": "9780593638446",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/704944/happy-place-by-emily-henry/9780593441190/",
    "marker": "Harriet and Wyn",
    "start": "Harriet and Wyn"
  },
  {
    "id": "4257",
    "editionId": "4416",
    "locale": "en",
    "title": "Birchbark House, The",
    "author": "Louise Erdrich",
    "isbn": "9780786803002",
    "isbn10": "0786803002",
    "openLibraryWorkId": "OL479039W",
    "openLibraryEditionId": "OL8141870M",
    "sourceKey": "9780786803002",
    "source": "official_catalog",
    "href": "https://www.si.edu/object/birchbark-house-louise-erdrich-illustrations-author:siris_sil_767292",
    "marker": "Seven-year-old Omakayas lives",
    "start": "Seven-year-old Omakayas lives"
  },
  {
    "id": "4268",
    "editionId": "4427",
    "locale": "en",
    "title": "Love Story",
    "author": "Erich Segal",
    "isbn": "9780553275285",
    "isbn10": "0553275283",
    "openLibraryWorkId": "OL2656058W",
    "openLibraryEditionId": "OL7824069M",
    "sourceKey": "9780553275285",
    "source": "official_publisher",
    "href": "https://www.penguinlibros.com/es/novela-romantica/8332-libro-love-story-9788490707869",
    "marker": "Oliver comes from",
    "start": "Oliver comes from"
  },
  {
    "id": "4300",
    "editionId": "4459",
    "locale": "en",
    "title": "Stone butch blues",
    "author": "Leslie Feinberg",
    "isbn": "9781459608450",
    "isbn10": "1459608453",
    "openLibraryWorkId": "OL1868110W",
    "openLibraryEditionId": "OL37064225M",
    "sourceKey": "9781459608450",
    "source": "official_catalog",
    "href": "https://search.worldcat.org/title/27336208",
    "marker": "Jess Goldberg grows",
    "start": "Jess Goldberg grows"
  },
  {
    "id": "4308",
    "editionId": "4467",
    "locale": "en",
    "title": "Quest Mode",
    "author": "Cube Kid",
    "isbn": "9781449492526",
    "isbn10": null,
    "openLibraryWorkId": "OL19368090W",
    "openLibraryEditionId": "OL30595689M",
    "sourceKey": "9781449492526",
    "source": "official_publisher",
    "href": "https://www.simonandschuster.net/books/Diary-of-an-8-Bit-Warrior-Quest-Mode/Cube-Kid/Diary-of-an-8-Bit-Warrior/9781449492526",
    "marker": "Runt must put",
    "start": "Runt must put"
  },
  {
    "id": "4402",
    "editionId": "4561",
    "locale": "en",
    "title": "The Dot",
    "author": "Peter H. Reynolds",
    "isbn": "9780763619619",
    "isbn10": "0763619612",
    "openLibraryWorkId": "OL2435178W",
    "openLibraryEditionId": "OL8036198M",
    "sourceKey": "9780763619619",
    "source": "official_publisher",
    "href": "https://www.candlewick.com/9780763619619/the-dot/",
    "marker": "Vashti sits before",
    "start": "Vashti sits before"
  },
  {
    "id": "4404",
    "editionId": "4563",
    "locale": "en",
    "title": "Scarred",
    "author": "Emily McIntire",
    "isbn": "9781728278353",
    "isbn10": "172827835X",
    "openLibraryWorkId": "OL27245840W",
    "openLibraryEditionId": "OL44188615M",
    "sourceKey": "9781728278353",
    "source": "official_publisher",
    "href": "https://www.sourcebooks.com/9798985138023-scarred-tp.html",
    "marker": "Prince Tristan intends",
    "start": "Prince Tristan intends"
  },
  {
    "id": "4411",
    "editionId": "4570",
    "locale": "en",
    "title": "Hogg",
    "author": "Samuel R. Delany",
    "isbn": "9781573661195",
    "isbn10": "1573661198",
    "openLibraryWorkId": "OL56830W",
    "openLibraryEditionId": "OL8739325M",
    "sourceKey": "9781573661195",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL3290697M/Hogg",
    "marker": "Samuel R. Delany's",
    "start": "Samuel R. Delany's"
  },
  {
    "id": "4422",
    "editionId": "4581",
    "locale": "en",
    "title": "Ski Weekend",
    "author": "Robert Lawrence Stine",
    "isbn": "9780671724801",
    "isbn10": "0671724800",
    "openLibraryWorkId": "OL11912264W",
    "openLibraryEditionId": "OL24279581M",
    "sourceKey": "9780671724801",
    "source": "official_catalog",
    "href": "https://rlstine.com/bookshelf/ski-weekend",
    "marker": "Ariel, Doug and",
    "start": "Ariel, Doug and"
  },
  {
    "id": "4573",
    "editionId": "4732",
    "locale": "en",
    "title": "The Farming of Bones",
    "author": "Edwidge Danticat",
    "isbn": "9781616953492",
    "isbn10": "1616953497",
    "openLibraryWorkId": "OL1806966W",
    "openLibraryEditionId": "OL27571369M",
    "sourceKey": "9781616953492",
    "source": "official_publisher",
    "href": "https://sohopress.com/books/the-farming-of-bones/",
    "marker": "Amabelle Désir has",
    "start": "Amabelle Désir has"
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

  test(`recovery32 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery32 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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


test('all 37 reviewed summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery32-tests', plugins: [react()],
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

