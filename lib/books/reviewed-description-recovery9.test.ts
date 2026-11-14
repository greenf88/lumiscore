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

// Frozen identities from the independently captured round9 candidate-audit.json.
// These fixtures do not read the runtime registry or private audit files at test time.
// Source links and distinguishing concepts come from the separately reviewed evidence.
const editions = [
  {
    "id": "8249",
    "editionId": "8408",
    "locale": "en",
    "title": "How to Talk to a Narcissist",
    "author": "Joan Lachkar",
    "isbn": "9780415958554",
    "isbn10": null,
    "sourceKey": "9780415958554",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/How_to_Talk_to_a_Narcissist.html?id=MTQgKt79EHQC",
    "marker": "communication in clinical practice",
    "start": "Joan Lachkar examines"
  },
  {
    "id": "2376",
    "editionId": "2596",
    "locale": "nl",
    "title": "Binnen spelen",
    "author": "Alma Mathijsen",
    "isbn": null,
    "isbn10": "9044607839",
    "sourceKey": "9789044607833",
    "source": "official_publisher",
    "href": "https://debezigebij.nl/boek/binnen-spelen-paperback/",
    "marker": "dertien verhalen",
    "start": "In haar debuutbundel"
  },
  {
    "id": "9652",
    "editionId": "9811",
    "locale": "en",
    "title": "The Iron Man",
    "author": "Kay Thorpe",
    "isbn": "9780373150441",
    "isbn10": null,
    "sourceKey": "9780373150441",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL37755966M/The_Iron_Man",
    "marker": "Kimberly Freeman",
    "start": "When her fiancé"
  },
  {
    "id": "8605",
    "editionId": "8764",
    "locale": "en",
    "title": "CHERUB",
    "author": "Robert Muchamore",
    "isbn": "9781405662871",
    "isbn10": null,
    "sourceKey": "9781405662871",
    "source": "official_publisher",
    "href": "https://www.muchamore.com/cherub-test-2",
    "marker": "Class A",
    "start": "This CHERUB volume"
  },
  {
    "id": "9124",
    "editionId": "9283",
    "locale": "en",
    "title": "Ring Shout",
    "author": "P. Djèlí Clark",
    "isbn": "9781250767011",
    "isbn10": null,
    "sourceKey": "9781250767011",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9781250767011/ringshout/",
    "marker": "Maryse Boudreaux",
    "start": "In a supernatural"
  },
  {
    "id": "8315",
    "editionId": "8474",
    "locale": "en",
    "title": "I Survived The Japanese Tsunami, 2011",
    "author": "Lauren Tarshis",
    "isbn": "9780545459372",
    "isbn10": null,
    "sourceKey": "9780545459372",
    "source": "official_publisher",
    "href": "https://kids.scholastic.com/content/kids64/en/books/i-survived/books.html",
    "marker": "Ben visits Japan",
    "start": "Ben visits Japan"
  },
  {
    "id": "8971",
    "editionId": "9130",
    "locale": "en",
    "title": "Fairest",
    "author": "Marissa Meyer",
    "isbn": "9781250060556",
    "isbn10": null,
    "sourceKey": "9781250060556",
    "source": "official_publisher",
    "href": "https://www.marissameyer.com/the-lunar-chronicles-books/",
    "marker": "Queen Levana",
    "start": "Before she becomes"
  },
  {
    "id": "1508",
    "editionId": "1607",
    "locale": "en",
    "title": "Night train to Lisbon",
    "author": "Pascal Mercier",
    "isbn": "9781843547136",
    "isbn10": null,
    "sourceKey": "9781843547136",
    "source": "official_publisher",
    "href": "https://groveatlantic.com/book/night-train-to-lisbon/",
    "marker": "Raimund Gregorius",
    "start": "A chance encounter"
  },
  {
    "id": "2958",
    "editionId": "3117",
    "locale": "en",
    "title": "The Silenced",
    "author": "James Devita",
    "isbn": "9780060784645",
    "isbn10": null,
    "sourceKey": "9780060784645",
    "source": "official_publisher",
    "href": "https://milkweed.org/book/the-silenced",
    "marker": "Marena",
    "start": "Marena lives under"
  },
  {
    "id": "6690",
    "editionId": "6849",
    "locale": "en",
    "title": "Understanding New Media",
    "author": "Eugenia Siapera",
    "isbn": "9781446297094",
    "isbn10": null,
    "sourceKey": "9781446297094",
    "source": "official_publisher",
    "href": "https://uk.sagepub.com/sites/default/files/media_communication_2018_web_0.pdf",
    "marker": "digital participation",
    "start": "Eugenia Siapera examines"
  },
  {
    "id": "4853",
    "editionId": "5012",
    "locale": "en",
    "title": "Sophie's Choice",
    "author": "William Styron",
    "isbn": "9780099285526",
    "isbn10": null,
    "sourceKey": "9780099285526",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/175062/sophies-choice-national-book-award-winner-by-william-styron/9780679736370/",
    "marker": "postwar Brooklyn",
    "start": "An aspiring writer"
  },
  {
    "id": "1609",
    "editionId": "1736",
    "locale": "en",
    "title": "The Mists of Avalon",
    "author": "Marion Zimmer Bradley",
    "isbn": "9780785787136",
    "isbn10": null,
    "sourceKey": "9780785787136",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/17254/the-mists-of-avalon-by-marion-zimmer-bradley/9780345448163/",
    "marker": "Morgaine and Gwenhwyfar",
    "start": "The legends of"
  },
  {
    "id": "8138",
    "editionId": "8297",
    "locale": "en",
    "title": "Elementary Solid State Physics",
    "author": "M. Ali Omar",
    "isbn": "9780201607338",
    "isbn10": null,
    "sourceKey": "9780201607338",
    "source": "official_publisher",
    "href": "https://in.pearson.com/content/dam/region-growth/india/pearson-india/in-pdc/pdf/new-catalog-pdf/Catalogue-Math-Phys-Chem-Bio-2026.pdf",
    "marker": "crystal structure",
    "start": "M. Ali Omar"
  },
  {
    "id": "9119",
    "editionId": "9278",
    "locale": "en",
    "title": "A Pocket Full of Rye",
    "author": "Agatha Christie",
    "isbn": "9780671756277",
    "isbn10": null,
    "sourceKey": "9780671756277",
    "source": "official_publisher",
    "href": "https://www.agathachristie.com/stories/a-pocket-full-of-rye",
    "marker": "Rex Fortescue",
    "start": "Businessman Rex Fortescue"
  },
  {
    "id": "9312",
    "editionId": "9471",
    "locale": "en",
    "title": "Vicious Prince",
    "author": "Rina Kent",
    "isbn": "9781685450588",
    "isbn10": null,
    "sourceKey": "9781685450588",
    "source": "official_publisher",
    "href": "https://www.rinakent.com/vipers-series/vicious-prince",
    "marker": "Teal Van Doren",
    "start": "Teal Van Doren"
  },
  {
    "id": "1847",
    "editionId": "2009",
    "locale": "en",
    "title": "Tim",
    "author": "Colleen McCullough",
    "isbn": "9780060128913",
    "isbn10": null,
    "sourceKey": "9780060128913",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/Tim.html?id=Ra-fEAAAQBAJ",
    "marker": "Mary Horton",
    "start": "Mary Horton has"
  },
  {
    "id": "9804",
    "editionId": "9963",
    "locale": "en",
    "title": "Touch Me in the Morning",
    "author": "Catherine George",
    "isbn": "9780373110650",
    "isbn10": null,
    "sourceKey": "9780373110650",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL10738548M/Touch_Me_in_the_Morning",
    "marker": "Theodora",
    "start": "During office hours,"
  },
  {
    "id": "6820",
    "editionId": "6979",
    "locale": "en",
    "title": "The Gothic Body",
    "author": "Kelly Hurley",
    "isbn": "9780521607117",
    "isbn10": null,
    "sourceKey": "9780521607117",
    "source": "official_publisher",
    "href": "https://www.cambridge.org/core/books/gothic-body/834B835259BBFA4D3CA68122F63236D9",
    "marker": "Kelly Hurley",
    "start": "Kelly Hurley studies"
  },
  {
    "id": "7652",
    "editionId": "7811",
    "locale": "en",
    "title": "The film encyclopedia",
    "author": "Ephraim Katz",
    "isbn": "9780061432859",
    "isbn10": null,
    "sourceKey": "9780061432859",
    "source": "official_catalog",
    "href": "https://books.google.com/books?id=IrczAQAAIAAJ",
    "marker": "Ronald Dean Nolen",
    "start": "Ephraim Katz’s reference"
  },
  {
    "id": "9301",
    "editionId": "9460",
    "locale": "en",
    "title": "Somewhere in time",
    "author": "Richard Matheson",
    "isbn": "9780765361394",
    "isbn10": null,
    "sourceKey": "9780765361394",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9780765361394/somewhereintime/",
    "marker": "Richard Collier",
    "start": "Writer Richard Collier"
  },
  {
    "id": "1506",
    "editionId": "1604",
    "locale": "en",
    "title": "Richard II",
    "author": "William Shakespeare",
    "isbn": "9780521063692",
    "isbn10": null,
    "sourceKey": "9780521063692",
    "source": "official_catalog",
    "href": "https://folgerpedia.folger.edu/Richard_II",
    "marker": "Henry Bolingbroke",
    "start": "King Richard’s treatment"
  },
  {
    "id": "1341",
    "editionId": "1366",
    "locale": "en",
    "title": "The Let Them Theory",
    "author": "Mel Robbins",
    "isbn": "9781401971366",
    "isbn10": null,
    "sourceKey": "9781401971366",
    "source": "official_publisher",
    "href": "https://www.melrobbins.com/book/the-let-them-theory/",
    "marker": "other people’s opinions",
    "start": "Mel Robbins presents"
  },
  {
    "id": "2743",
    "editionId": "2902",
    "locale": "en",
    "title": "Uprooted: A Novel",
    "author": "Naomi Novik",
    "isbn": "9780804179058",
    "isbn10": null,
    "sourceKey": "9780804179058",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/236925/uprooted-by-naomi-novik/9780804179041/",
    "marker": "Agnieszka",
    "start": "Agnieszka’s village depends"
  },
  {
    "id": "8384",
    "editionId": "8543",
    "locale": "en",
    "title": "Funny Boy",
    "author": "Shyam Selvadurai",
    "isbn": "9780771079504",
    "isbn10": null,
    "sourceKey": "9780771079504",
    "source": "official_publisher",
    "href": "https://shyamselvadurai.com/books/",
    "marker": "Arjie",
    "start": "Growing up in"
  },
  {
    "id": "8184",
    "editionId": "8343",
    "locale": "en",
    "title": "In My Father's Arms",
    "author": "Walter De Milly",
    "isbn": "9780299165109",
    "isbn10": null,
    "sourceKey": "9780299165109",
    "source": "official_catalog",
    "href": "https://cincinnatilibrary.overdrive.com/media/919839",
    "marker": "Walter de Milly",
    "start": "Walter de Milly"
  },
  {
    "id": "8683",
    "editionId": "8842",
    "locale": "en",
    "title": "Little Blue Truck",
    "author": "Alice Schertle",
    "isbn": "9780152056612",
    "isbn10": null,
    "sourceKey": "9780152056612",
    "source": "official_publisher",
    "href": "https://aliceschertle.com/",
    "marker": "muddy road",
    "start": "A friendly blue"
  },
  {
    "id": "2399",
    "editionId": "2626",
    "locale": "en",
    "title": "The Grand Design",
    "author": "Stephen Hawking",
    "isbn": "9780593058299",
    "isbn10": null,
    "sourceKey": "9780593058299",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/77018/the-grand-design-by-stephen-hawking-and-leonard-mlodinow/9780553384666/",
    "marker": "Leonard Mlodinow",
    "start": "Stephen Hawking and"
  },
  {
    "id": "9323",
    "editionId": "9482",
    "locale": "en",
    "title": "Unfriendly Alliance",
    "author": "Jessica Steele",
    "isbn": "9780373029167",
    "isbn10": null,
    "sourceKey": "9780373029167",
    "source": "official_catalog",
    "href": "https://openlibrary.org/books/OL10691603M/Unfriendly_Alliance",
    "marker": "Anstey Eldridge",
    "start": "Anstey Eldridge is"
  },
  {
    "id": "9547",
    "editionId": "9706",
    "locale": "en",
    "title": "A Perfect Marriage",
    "author": "Daphne Clair",
    "isbn": "9780373076215",
    "isbn10": null,
    "sourceKey": "9780373076215",
    "source": "official_catalog",
    "href": "https://books.google.com/books?id=dqCVynkJlrIC",
    "marker": "Celine and Max Archer",
    "start": "To those around"
  },
  {
    "id": "4323",
    "editionId": "4482",
    "locale": "en",
    "title": "The war that Saved my Life",
    "author": "Kimberly Brubaker Bradley",
    "isbn": "9780803740815",
    "isbn10": null,
    "sourceKey": "9780803740815",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/314816/the-war-that-saved-my-life-by-kimberly-brubaker-bradley/",
    "marker": "Ada",
    "start": "Ada has spent"
  },
  {
    "id": "4166",
    "editionId": "4325",
    "locale": "en",
    "title": "No Longer Human",
    "author": "太宰 治",
    "isbn": "9780811204811",
    "isbn10": null,
    "sourceKey": "9780811204811",
    "source": "official_publisher",
    "href": "https://www.ndbooks.com/book/no-longer-human/",
    "marker": "Oba Yozo",
    "start": "Oba Yozo feels"
  },
  {
    "id": "8296",
    "editionId": "8455",
    "locale": "en",
    "title": "Everworld",
    "author": "Katherine Applegate",
    "isbn": "9780590877435",
    "isbn10": null,
    "sourceKey": "9780590877435",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/Search_for_Senna.html?id=Pd0LAAAACAAJ",
    "marker": "Search for Senna",
    "start": "This Everworld volume"
  },
  {
    "id": "8240",
    "editionId": "8399",
    "locale": "en",
    "title": "The Gate to Women's Country",
    "author": "Sheri S. Tepper",
    "isbn": "9780553280647",
    "isbn10": null,
    "sourceKey": "9780553280647",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/177292/the-gate-to-womens-country-by-sheri-s-tepper/",
    "marker": "walled towns",
    "start": "Centuries after a"
  },
  {
    "id": "8438",
    "editionId": "8597",
    "locale": "en",
    "title": "GB: Werewolf Of Fever Swamp",
    "author": "Robert Lawrence Stine",
    "isbn": "9780439796354",
    "isbn10": null,
    "sourceKey": "9780439796354",
    "source": "official_publisher",
    "href": "https://www.scholastic.com/goosebumps/books_audio/index.html",
    "marker": "Grady",
    "start": "Strange howling and"
  },
  {
    "id": "3654",
    "editionId": "3813",
    "locale": "en",
    "title": "My Inventions",
    "author": "Nikola Tesla",
    "isbn": "9781600964237",
    "isbn10": null,
    "sourceKey": "9781600964237",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/832077/my-inventions-autobiography-of-nikola-tesla-by-nikola-tesla/",
    "marker": "Nikola Tesla",
    "start": "Nikola Tesla reflects"
  },
  {
    "id": "4807",
    "editionId": "4966",
    "locale": "en",
    "title": "The Hours",
    "author": "Michael Cunningham",
    "isbn": "9780374172893",
    "isbn10": null,
    "sourceKey": "9780374172893",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9780312243029/thehours/",
    "marker": "Virginia Woolf",
    "start": "The life and"
  },
  {
    "id": "8505",
    "editionId": "8664",
    "locale": "en",
    "title": "The dragon can't dance",
    "author": "Earl Lovelace",
    "isbn": "9780582642317",
    "isbn10": null,
    "sourceKey": "9780582642317",
    "source": "official_publisher",
    "href": "https://www.perseabooks.com/the-dragon-cant-dance",
    "marker": "Calvary Hill",
    "start": "In the Trinidadian"
  },
  {
    "id": "1453",
    "editionId": "1520",
    "locale": "en",
    "title": "The Solitude of Prime Numbers",
    "author": "Paolo Giordano",
    "isbn": "9780385616256",
    "isbn10": null,
    "sourceKey": "9780385616256",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/306080/the-solitude-of-prime-numbers-by-paolo-giordano/9780143118596/",
    "marker": "Alice and Mattia",
    "start": "Alice and Mattia"
  },
  {
    "id": "7299",
    "editionId": "7458",
    "locale": "en",
    "title": "Thinking with Things",
    "author": "Esther Pasztory",
    "isbn": "9780292765979",
    "isbn10": null,
    "sourceKey": "9780292765979",
    "source": "official_publisher",
    "href": "https://utpress.utexas.edu/9780292706910/",
    "marker": "Esther Pasztory",
    "start": "Esther Pasztory asks"
  },
  {
    "id": "6621",
    "editionId": "6780",
    "locale": "en",
    "title": "Stanlake's Introductory Economics",
    "author": "G.F. Stanlake",
    "isbn": "9780582405486",
    "isbn10": null,
    "sourceKey": "9780582405486",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/Stanlake_s_Introductory_Economics.html?id=YvrVAQAACAAJ",
    "marker": "Susan Grant",
    "start": "G. F. Stanlake"
  },
  {
    "id": "8093",
    "editionId": "8252",
    "locale": "en",
    "title": "Moses Orimolade Tunolase",
    "author": "Moses Oludele Idowu",
    "isbn": "9789783570450",
    "isbn10": null,
    "sourceKey": "9789783570450",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/Moses_Orimolade_Tunolase.html?id=6JZCAQAAIAAJ",
    "marker": "Moses Oludele Idowu",
    "start": "Moses Oludele Idowu"
  },
  {
    "id": "4252",
    "editionId": "4411",
    "locale": "en",
    "title": "Front Desk",
    "author": "Kelly Yang",
    "isbn": "9781432893255",
    "isbn10": null,
    "sourceKey": "9781432893255",
    "source": "official_publisher",
    "href": "https://clubs.scholastic.com/front-desk/9781338157826-rco-us.html",
    "marker": "Mia Tang",
    "start": "Ten-year-old Mia Tang"
  },
  {
    "id": "8332",
    "editionId": "8491",
    "locale": "en",
    "title": "Ethics (Penguin Classics)",
    "author": "Benedictus de Spinoza",
    "isbn": "9780140435719",
    "isbn10": null,
    "sourceKey": "9780140435719",
    "source": "official_publisher",
    "href": "https://www.penguinrandomhouse.com/books/286292/ethics-by-benedict-de-spinoza/",
    "marker": "Edwin Curley",
    "start": "Spinoza develops a"
  },
  {
    "id": "4322",
    "editionId": "4481",
    "locale": "en",
    "title": "The Kiss Thief",
    "author": "L.J. Shen",
    "isbn": "9781732624719",
    "isbn10": null,
    "sourceKey": "9781732624719",
    "source": "official_catalog",
    "href": "https://books.google.com/books/about/The_Kiss_Thief.html?id=SDDHwAEACAAJ",
    "marker": "Francesca Rossi",
    "start": "Francesca Rossi expects"
  },
  {
    "id": "7279",
    "editionId": "7438",
    "locale": "en",
    "title": "The End of Faith",
    "author": "Sam Harris",
    "isbn": "9780743268097",
    "isbn10": null,
    "sourceKey": "9780743268097",
    "source": "official_publisher",
    "href": "https://www.samharris.org/books/the-end-of-faith",
    "marker": "Sam Harris",
    "start": "Sam Harris argues"
  },
  {
    "id": "10100",
    "editionId": "10259",
    "locale": "en",
    "title": "Irish Thoroughbred (Silhouette Romance, #81)",
    "author": "Nora Roberts",
    "isbn": "9780671507015",
    "isbn10": null,
    "sourceKey": "9780671507015",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9781250775443/irishthoroughbred/",
    "marker": "Adelia Cunnane",
    "start": "After the death"
  },
  {
    "id": "9484",
    "editionId": "9643",
    "locale": "en",
    "title": "The Mysterious Benedict Society and the Perilous Journey",
    "author": "Trenton Lee Stewart",
    "isbn": "9780316036733",
    "isbn10": null,
    "sourceKey": "9780316036733",
    "source": "official_publisher",
    "href": "https://www.hachettebookgroup.com/wp-content/uploads/2017/06/HBGLBYR_Trenton-Lee-Stewart_Content-Image_Mysterious-Benedict-Society_Educator-Guide.pdf",
    "marker": "Number Two",
    "start": "Reynie, Kate, Sticky"
  },
  {
    "id": "9799",
    "editionId": "9958",
    "locale": "en",
    "title": "A Little Hatred",
    "author": "Joe Abercrombie",
    "isbn": "9780316187169",
    "isbn10": null,
    "sourceKey": "9780316187169",
    "source": "official_publisher",
    "href": "https://www.hachettebookgroup.com/titles/joe-abercrombie/a-little-hatred/9780316187169/",
    "marker": "Savine dan Glokta",
    "start": "Industry is changing"
  },
  {
    "id": "8329",
    "editionId": "8488",
    "locale": "en",
    "title": "Your best life now",
    "author": "Joel Osteen",
    "isbn": "9780446696159",
    "isbn10": null,
    "sourceKey": "9780446696159",
    "source": "official_publisher",
    "href": "https://www.hachettebookgroup.com/titles/joel-osteen/your-best-life-now/9781594831416/",
    "marker": "Joel Osteen",
    "start": "Joel Osteen presents"
  },
  {
    "id": "2683",
    "editionId": "2842",
    "locale": "en",
    "title": "How to train your dragon",
    "author": "Cressida Cowell",
    "isbn": "9780316407472",
    "isbn10": null,
    "sourceKey": "9780316407472",
    "source": "official_publisher",
    "href": "https://www.hachettebookgroup.com/books/how-to-train-your-dragon-series/",
    "marker": "Toothless",
    "start": "Hiccup Horrendous Haddock"
  },
  {
    "id": "9706",
    "editionId": "9865",
    "locale": "en",
    "title": "Tomorrow died yesterday",
    "author": "Chimeka Garricks",
    "isbn": "9789789010127",
    "isbn10": null,
    "sourceKey": "9789789010127",
    "source": "official_catalog",
    "href": "https://virtuall.nln.gov.ng/resource/NLN-XAHRYKHBLLNH93AX",
    "marker": "Niger Delta",
    "start": "Set in Nigeria’s"
  },
  {
    "id": "8466",
    "editionId": "8625",
    "locale": "en",
    "title": "The Thief",
    "author": "Megan Whalen Turner",
    "isbn": "9780060824976",
    "isbn10": null,
    "sourceKey": "9780060824976",
    "source": "official_catalog",
    "href": "https://dam.assets.ohio.gov/image/upload/library.ohio.gov/ctro-files/2013-2014/Thief_toolkit.pdf",
    "marker": "Gen",
    "start": "Gen’s reputation as"
  },
  {
    "id": "1624",
    "editionId": "1756",
    "locale": "en",
    "title": "The Path of Daggers",
    "author": "Robert Jordan",
    "isbn": "9780312857691",
    "isbn10": null,
    "sourceKey": "9780312857691",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9781429960595/thepathofdaggers/",
    "marker": "Seanchan",
    "start": "Rand al’Thor faces"
  },
  {
    "id": "1876",
    "editionId": "2046",
    "locale": "en",
    "title": "The Shadow Rising",
    "author": "Robert Jordan",
    "isbn": "9780312854317",
    "isbn10": null,
    "sourceKey": "9780312854317",
    "source": "official_publisher",
    "href": "https://us.macmillan.com/books/9780765334671/theshadowrising/",
    "marker": "Rhuidean",
    "start": "Now recognised as"
  },
  {
    "id": "4274",
    "editionId": "4433",
    "locale": "en",
    "title": "Mort",
    "author": "Terry Pratchett",
    "isbn": "9780061020681",
    "isbn10": null,
    "sourceKey": "9780061020681",
    "source": "official_publisher",
    "href": "https://terrypratchett.com/books/mort/",
    "marker": "Ysabell",
    "start": "Mort receives an"
  },
  {
    "id": "8472",
    "editionId": "8631",
    "locale": "en",
    "title": "Night Watch",
    "author": "Terry Pratchett",
    "isbn": "9780060013127",
    "isbn10": null,
    "sourceKey": "9780060013127",
    "source": "official_publisher",
    "href": "https://terrypratchett.com/books/night-watch/",
    "marker": "Sam Vimes",
    "start": "Sam Vimes is"
  },
  {
    "id": "9504",
    "editionId": "9663",
    "locale": "en",
    "title": "Snuff",
    "author": "Terry Pratchett",
    "isbn": "9780062011848",
    "isbn10": null,
    "sourceKey": "9780062011848",
    "source": "official_publisher",
    "href": "https://terrypratchett.com/books/snuff/",
    "marker": "Sam Vimes",
    "start": "A country holiday"
  },
  {
    "id": "2532",
    "editionId": "2783",
    "locale": "en",
    "title": "Armour of Light",
    "author": "Ken Follett",
    "isbn": "9781447278832",
    "isbn10": null,
    "sourceKey": "9781447278832",
    "source": "official_publisher",
    "href": "https://ken-follett.com/books/the-armour-of-light/",
    "marker": "Sal Clitheroe",
    "start": "Beginning in 1792,"
  },
  {
    "id": "2466",
    "editionId": "2701",
    "locale": "en",
    "title": "Man from St Petersburg",
    "author": "Ken Follett",
    "isbn": "9780517435199",
    "isbn10": null,
    "sourceKey": "9780517435199",
    "source": "official_publisher",
    "href": "https://ken-follett.com/books/the-man-from-st-petersburg/",
    "marker": "Prince Aleksei",
    "start": "In 1914, Prince"
  },
  {
    "id": "5074",
    "editionId": "5233",
    "locale": "nl",
    "title": "Kamermeisjes en soldaten",
    "author": "Arnon Grunberg",
    "isbn": "9789038890883",
    "isbn10": null,
    "sourceKey": "9789038890883",
    "source": "official_publisher",
    "href": "https://www.arnongrunberg.com/words/1-netherlands-belgium/8-columns/176-grunberg-onder-de-mensen",
    "marker": "Beiers hotel",
    "start": "Arnon Grunberg zoekt"
  },
  {
    "id": "5079",
    "editionId": "5238",
    "locale": "nl",
    "title": "Karel heeft echt bestaan",
    "author": "Arnon Grunberg",
    "isbn": "9789028240971",
    "isbn10": null,
    "sourceKey": "9789028240971",
    "source": "official_publisher",
    "href": "https://www.vanoorschot.nl/grunberg-en-karel/",
    "marker": "Karel van het Reve",
    "start": "Arnon Grunberg schrijft"
  },
  {
    "id": "2767",
    "editionId": "2926",
    "locale": "en",
    "title": "Whiteout",
    "author": "Ken Follett",
    "isbn": "9780330544153",
    "isbn10": null,
    "sourceKey": "9780330544153",
    "source": "official_publisher",
    "href": "https://ken-follett.com/books/whiteout/",
    "marker": "Toni Gallo",
    "start": "A Christmas blizzard"
  },
  {
    "id": "9515",
    "editionId": "9674",
    "locale": "en",
    "title": "Switch Bitch",
    "author": "Roald Dahl",
    "isbn": "9780140041798",
    "isbn10": null,
    "sourceKey": "9780140041798",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/5967/switch-bitch-by-roald-dahl/9780241955727",
    "marker": "Oswald",
    "start": "Four stories bring"
  },
  {
    "id": "1405",
    "editionId": "1454",
    "locale": "en",
    "title": "The Bfg (Handi-read)",
    "author": "Roald Dahl",
    "isbn": "9781850899570",
    "isbn10": null,
    "sourceKey": "9781850899570",
    "source": "official_publisher",
    "href": "https://shop.roalddahl.com/products/the-bfg-softback-book",
    "marker": "Sophie",
    "start": "When Sophie is"
  },
  {
    "id": "9264",
    "editionId": "9423",
    "locale": "en",
    "title": "Beauty and the Beast",
    "author": "Hannah Howell",
    "isbn": "9780843933246",
    "isbn10": null,
    "sourceKey": "9780843933246",
    "source": "official_publisher",
    "href": "https://books.apple.com/us/book/beauty-and-the-beast/id947986364",
    "marker": "Gytha",
    "start": "Gytha expects to"
  },
  {
    "id": "9416",
    "editionId": "9575",
    "locale": "en",
    "title": "Highland Wedding",
    "author": "Hannah Howell",
    "isbn": "9780821780022",
    "isbn10": null,
    "sourceKey": "9780821780022",
    "source": "official_publisher",
    "href": "https://www.kensingtonbooks.com/shop/highland-wedding-9781420133301/",
    "marker": "Islaen MacRoth",
    "start": "Ordered by Scotland’s"
  },
  {
    "id": "4500",
    "editionId": "4659",
    "locale": "en",
    "title": "The Spanish Groom",
    "author": "Lynne Graham",
    "isbn": "9780373120376",
    "isbn10": null,
    "sourceKey": "9780373120376",
    "source": "official_publisher",
    "href": "https://www.lynnegraham.com/book/the-spanish-groom/",
    "marker": "Dixie Robinson",
    "start": "César Valverde agrees"
  },
  {
    "id": "8725",
    "editionId": "8884",
    "locale": "en",
    "title": "The Winter Bride",
    "author": "Lynne Graham",
    "isbn": "9780373119899",
    "isbn10": null,
    "sourceKey": "9780373119899",
    "source": "official_publisher",
    "href": "https://www.lynnegraham.com/book/the-winter-bride/",
    "marker": "Leo Demetrios",
    "start": "Angie has spent"
  },
  {
    "id": "9507",
    "editionId": "9666",
    "locale": "en",
    "title": "Roald Dahl's Book of Ghost Stories (Mainstream Series)",
    "author": "Roald Dahl",
    "isbn": "9781850891789",
    "isbn10": null,
    "sourceKey": "9781850891789",
    "source": "official_publisher",
    "href": "https://www.penguin.co.uk/books/8542/roald-dahls-book-of-ghost-stories/9780241955710",
    "marker": "Edith Wharton",
    "start": "Roald Dahl brings"
  }
] as const;

function selectedBook(edition: typeof editions[number]): Book {
  return {
    id: 'work-' + edition.id, source: 'supabase', workId: edition.id, title: edition.title,
    editionTitle: edition.title, author: edition.author, isbn13: edition.isbn, editionAvailable: true,
    isbn10: edition.isbn10,
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

  test(`recovery9 ${edition.id}: synchronous synopsis and metadata match the recorded edition without external reads`, async () => {
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

  test(`recovery9 ${edition.id}: wrong ISBN, author, title, edition language or locale cannot reuse the text`, async () => {
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


test('all sixty-nine recovery summaries render as visible initial HTML with attribution, without a streaming fallback', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const vite = await createServer({ root, configFile: false, envFile: false,
    cacheDir: root + '.wrangler/node_modules/recovery9-tests', plugins: [react()],
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
